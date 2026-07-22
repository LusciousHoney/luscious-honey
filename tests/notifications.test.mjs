/* =============================================================================
   Notification services — the outbound layer on the submissions spine.
   Covers: arrival notice on a new submission, idempotency on retry, staleness
   detection at the threshold boundary, cooldown-bounded re-notification, and
   durable failure recording. Uses a small in-memory fake of the D1 surface the
   lib touches (prepare/bind/run/all) plus a fetch stub for Resend.
   ============================================================================= */

import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import {
  recordAndSendArrival, sweepStale, listNotifications,
  isStale, cooldownElapsed, sqliteUtc,
  staleAfterHours, staleCooldownHours, arrivalRecipient, sweepRecipient,
  DEFAULT_STALE_AFTER_HOURS, DEFAULT_STALE_COOLDOWN_HOURS,
} from '../functions/_lib/notifications.js'

/* --- a tiny fake of the D1 calls the lib makes ------------------------------ */

function fakeDb() {
  const db = {
    submissions: [],       // {id,type,status,name,created_at,updated_at}
    notifications: [],     // rows as inserted
    nextId: 1,
    prepare(sql) {
      return { bind: (...binds) => statement(db, sql, binds) }
    },
  }
  return db
}

function statement(db, sql, binds) {
  const s = sql.replace(/\s+/g, ' ').trim()
  return {
    async run() {
      if (s.startsWith('INSERT OR IGNORE INTO notifications')) {
        const [submission_id, ...rest] = binds
        if (db.notifications.some((n) => n.kind === 'arrival' && n.submission_id === submission_id)) {
          return { meta: { changes: 0 } }
        }
        const row = arrivalRow(db, s, binds)
        db.notifications.push(row)
        return { meta: { changes: 1, last_row_id: row.id } }
      }
      if (s.startsWith('INSERT INTO notifications')) {
        const [submission_id, recipient, subject, delivery_status] = binds
        const row = {
          id: db.nextId++, submission_id, kind: 'stale', channel: 'email',
          recipient, subject, delivery_status, delivery_error: null,
          provider_id: null, created_at: nowSql(), sent_at: null,
        }
        db.notifications.push(row)
        return { meta: { changes: 1, last_row_id: row.id } }
      }
      if (s.startsWith('UPDATE notifications SET delivery_status = \'sent\'')) {
        const [provider_id, id] = binds
        const n = db.notifications.find((x) => x.id === id)
        Object.assign(n, { delivery_status: 'sent', provider_id, delivery_error: null, sent_at: nowSql() })
        return { meta: { changes: 1 } }
      }
      if (s.startsWith('UPDATE notifications SET delivery_status = \'failed\'')) {
        const [delivery_error, id] = binds
        const n = db.notifications.find((x) => x.id === id)
        Object.assign(n, { delivery_status: 'failed', delivery_error })
        return { meta: { changes: 1 } }
      }
      throw new Error('fakeDb run: unrecognised SQL: ' + s)
    },
    async all() {
      if (s.includes('FROM submissions s')) {
        // the sweep query: non-terminal submissions + latest stale notice
        const finals = binds
        const results = db.submissions
          .filter((r) => !finals.includes(r.status))
          .map((r) => ({
            ...r,
            last_stale_at: db.notifications
              .filter((n) => n.kind === 'stale' && n.submission_id === r.id)
              .map((n) => n.created_at).sort().pop() || null,
          }))
        return { results }
      }
      if (s.includes('FROM notifications n')) {
        const results = [...db.notifications].reverse().map((n) => {
          const sub = db.submissions.find((x) => x.id === n.submission_id)
          return { ...n, type: sub?.type ?? null, status: sub?.status ?? null, name: sub?.name ?? null }
        })
        return { results }
      }
      throw new Error('fakeDb all: unrecognised SQL: ' + s)
    },
  }
}

function arrivalRow(db, s, binds) {
  // Two arrival INSERT OR IGNORE shapes exist: the normal path (recipient,
  // subject, delivery_status) and the failure-recording path (delivery_status,
  // delivery_error).
  const failurePath = s.includes('delivery_error')
  const [submission_id] = binds
  return failurePath
    ? { id: db.nextId++, submission_id, kind: 'arrival', channel: 'email', recipient: null,
        subject: null, delivery_status: 'failed', delivery_error: binds[1],
        provider_id: null, created_at: nowSql(), sent_at: null }
    : { id: db.nextId++, submission_id, kind: 'arrival', channel: 'email', recipient: binds[1],
        subject: binds[2], delivery_status: binds[3], delivery_error: null,
        provider_id: null, created_at: nowSql(), sent_at: null }
}

function nowSql(d = new Date()) {
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

/* --- fetch stub (Resend) ----------------------------------------------------- */

const realFetch = globalThis.fetch
let sends = []
let sendBehaviour = 'ok' // 'ok' | 'reject' | 'throw'

beforeEach(() => {
  sends = []
  sendBehaviour = 'ok'
  globalThis.fetch = async (url, opts) => {
    sends.push({ url, body: JSON.parse(opts.body) })
    if (sendBehaviour === 'throw') throw new Error('network down')
    if (sendBehaviour === 'reject') {
      return { ok: false, status: 422, json: async () => ({ message: 'bad address' }) }
    }
    return { ok: true, status: 200, json: async () => ({ id: 'msg_1' }) }
  }
})
afterEach(() => { globalThis.fetch = realFetch })

function envWith(db, extra = {}) {
  return {
    LHC_DB: db,
    RESEND_API_KEY: 'test-key',
    EMAIL_FROM: 'House <house@example.org>',
    ARRIVAL_NOTIFY_EMAIL: 'submission-desk@example.org',
    SWEEP_NOTIFY_EMAIL: 'sweep-desk@example.org',
    ...extra,
  }
}

const HOUR = 3600_000

/* --- configuration ------------------------------------------------------------ */

test('thresholds default and read from env; junk falls back', () => {
  assert.equal(staleAfterHours({}), DEFAULT_STALE_AFTER_HOURS)
  assert.equal(staleAfterHours({ STALE_AFTER_HOURS: '12' }), 12)
  assert.equal(staleAfterHours({ STALE_AFTER_HOURS: '-3' }), DEFAULT_STALE_AFTER_HOURS)
  assert.equal(staleCooldownHours({}), DEFAULT_STALE_COOLDOWN_HOURS)
  assert.equal(staleCooldownHours({ STALE_COOLDOWN_HOURS: '6' }), 6)
  assert.equal(arrivalRecipient({}), null)
  assert.equal(arrivalRecipient({ ARRIVAL_NOTIFY_EMAIL: '  a@b.c ' }), 'a@b.c')
  assert.equal(sweepRecipient({}), null)
  assert.equal(sweepRecipient({ SWEEP_NOTIFY_EMAIL: '  d@e.f ' }), 'd@e.f')
})

/* --- staleness boundary -------------------------------------------------------- */

test('isStale: inclusive at the threshold boundary, never for terminal statuses', () => {
  const now = new Date('2026-07-22T12:00:00Z')
  const at = (h) => nowSql(new Date(now.getTime() - h * HOUR))
  const sub = (status, hoursAgo) => ({ status, updated_at: at(hoursAgo) })

  assert.equal(isStale(sub('sent_for_review', 47.99), now, 48), false, 'just under')
  assert.equal(isStale(sub('sent_for_review', 48), now, 48), true, 'exactly at threshold')
  assert.equal(isStale(sub('under_review', 100), now, 48), true)
  assert.equal(isStale(sub('published', 500), now, 48), false, 'terminal: published')
  assert.equal(isStale(sub('not_accepted', 500), now, 48), false, 'terminal: not_accepted')
  assert.equal(isStale({ status: 'under_review', updated_at: 'garbage' }, now, 48), false, 'unparseable → not stale')
})

test('cooldownElapsed: inclusive boundary; absent last notice re-arms', () => {
  const now = new Date('2026-07-22T12:00:00Z')
  const at = (h) => nowSql(new Date(now.getTime() - h * HOUR))
  assert.equal(cooldownElapsed(null, now, 72), true)
  assert.equal(cooldownElapsed(at(71.99), now, 72), false)
  assert.equal(cooldownElapsed(at(72), now, 72), true)
})

test('sqliteUtc normalises bare D1 datetimes to UTC and passes ISO through', () => {
  assert.equal(sqliteUtc('2026-07-22 08:00:00'), '2026-07-22T08:00:00Z')
  assert.equal(sqliteUtc('2026-07-22T08:00:00Z'), '2026-07-22T08:00:00Z')
})

/* --- arrival notice ------------------------------------------------------------ */

test('a new submission records exactly one arrival notice and sends it', async () => {
  const db = fakeDb()
  const r = await recordAndSendArrival(envWith(db), { id: 7, type: 'music', name: 'Ada' })
  assert.equal(r.ok, true)
  assert.equal(db.notifications.length, 1)
  assert.equal(db.notifications[0].kind, 'arrival')
  assert.equal(db.notifications[0].delivery_status, 'sent')
  assert.equal(sends.length, 1)
  assert.equal(sends[0].body.to, 'submission-desk@example.org', 'arrival goes to the submissions desk')
  assert.match(sends[0].body.subject, /music/i)
})

test('idempotency: a retried arrival neither duplicates the row nor re-sends', async () => {
  const db = fakeDb()
  const env = envWith(db)
  await recordAndSendArrival(env, { id: 7, type: 'music', name: 'Ada' })
  const again = await recordAndSendArrival(env, { id: 7, type: 'music', name: 'Ada' })
  assert.equal(again.ok, true)
  assert.equal(again.duplicate, true)
  assert.equal(db.notifications.length, 1, 'one row ever')
  assert.equal(sends.length, 1, 'one email ever')
})

test('no recipient configured: the arrival is still durably recorded, honestly', async () => {
  const db = fakeDb()
  const r = await recordAndSendArrival(envWith(db, { ARRIVAL_NOTIFY_EMAIL: '' }), { id: 3, type: 'book', name: 'Kim' })
  assert.equal(r.ok, true)
  assert.equal(db.notifications[0].delivery_status, 'not_configured')
  assert.equal(sends.length, 0)
})

test('failure path: a rejected send is recorded as a durable failed row', async () => {
  sendBehaviour = 'reject'
  const db = fakeDb()
  const r = await recordAndSendArrival(envWith(db), { id: 9, type: 'event', name: 'Lee' })
  assert.equal(r.ok, true, 'the caller is never failed by a send failure')
  assert.equal(db.notifications[0].delivery_status, 'failed')
  assert.match(db.notifications[0].delivery_error, /Resend rejected/)
})

test('failure path: a thrown send is recorded, not swallowed', async () => {
  sendBehaviour = 'throw'
  const db = fakeDb()
  await recordAndSendArrival(envWith(db), { id: 9, type: 'event', name: 'Lee' })
  assert.equal(db.notifications[0].delivery_status, 'failed')
  assert.match(db.notifications[0].delivery_error, /network down/)
})

/* --- stale sweep ---------------------------------------------------------------- */

function seed(db, id, status, hoursAgo, now) {
  db.submissions.push({
    id, type: 'music', status, name: `S${id}`,
    created_at: nowSql(new Date(now.getTime() - (hoursAgo + 1) * HOUR)),
    updated_at: nowSql(new Date(now.getTime() - hoursAgo * HOUR)),
  })
}

test('sweep notifies each newly-due stale submission once, as one digest', async () => {
  const now = new Date('2026-07-22T12:00:00Z')
  const db = fakeDb()
  seed(db, 1, 'sent_for_review', 49, now)   // stale
  seed(db, 2, 'under_review', 50, now)      // stale
  seed(db, 3, 'sent_for_review', 2, now)    // fresh
  seed(db, 4, 'published', 500, now)        // terminal

  const r = await sweepStale(envWith(db), now)
  assert.deepEqual({ ok: r.ok, stale: r.stale, notified: r.notified, skipped: r.skippedCooldown },
    { ok: true, stale: 2, notified: 2, skipped: 0 })
  const staleRows = db.notifications.filter((n) => n.kind === 'stale')
  assert.equal(staleRows.length, 2)
  assert.ok(staleRows.every((n) => n.delivery_status === 'sent'))
  assert.equal(sends.length, 1, 'one digest email, not one per item')
  assert.equal(sends[0].body.to, 'sweep-desk@example.org', 'digest goes to the sweep desk')
  assert.match(sends[0].body.text, /S1/)
  assert.match(sends[0].body.text, /S2/)
})

test('cooldown: a still-stale item is not re-notified until the cooldown elapses', async () => {
  const now = new Date('2026-07-22T12:00:00Z')
  const db = fakeDb()
  seed(db, 1, 'sent_for_review', 100, now)
  const env = envWith(db)

  const first = await sweepStale(env, now)
  assert.equal(first.notified, 1)

  const soon = new Date(now.getTime() + 1 * HOUR)
  const second = await sweepStale(env, soon)
  assert.deepEqual({ notified: second.notified, skipped: second.skippedCooldown }, { notified: 0, skipped: 1 })
  assert.equal(sends.length, 1, 'no second email inside the cooldown')

  const later = new Date(now.getTime() + (DEFAULT_STALE_COOLDOWN_HOURS + 1) * HOUR)
  const third = await sweepStale(env, later)
  assert.equal(third.notified, 1, 're-notifies after the cooldown')
  assert.equal(sends.length, 2)
})

test('sweep failure to send records failed rows and still reports honestly', async () => {
  sendBehaviour = 'reject'
  const now = new Date('2026-07-22T12:00:00Z')
  const db = fakeDb()
  seed(db, 1, 'under_review', 60, now)
  const r = await sweepStale(envWith(db), now)
  assert.equal(r.ok, true)
  const row = db.notifications.find((n) => n.kind === 'stale')
  assert.equal(row.delivery_status, 'failed')
  assert.match(row.delivery_error, /Resend rejected/)
})

/* --- panel read ------------------------------------------------------------------ */

test('listNotifications joins submission context, newest first', async () => {
  const now = new Date('2026-07-22T12:00:00Z')
  const db = fakeDb()
  seed(db, 1, 'sent_for_review', 60, now)
  await recordAndSendArrival(envWith(db), { id: 1, type: 'music', name: 'S1' })
  await sweepStale(envWith(db), now)
  const rows = await listNotifications(envWith(db))
  assert.equal(rows.length, 2)
  assert.equal(rows[0].kind, 'stale', 'newest first')
  assert.equal(rows[1].kind, 'arrival')
  assert.equal(rows[1].name, 'S1')
})
