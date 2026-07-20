/**
 * Invitation decision endpoint — POST /api/invitation/decision
 *   { token, choice: 'accept'|'time'|'talk'|'decline', reminderPeriod? }
 *
 * Records the recipient's choice as durable state and notifies the Founder on the
 * genuine transitions (accept / talk / decline). Idempotent: repeating a choice
 * that is already the current state changes nothing and never re-notifies.
 *
 *   accept  → status accepted        (Founder notified; planning conversation next)
 *   time    → status reminder_scheduled, reminder_at set (no email; recipient returns)
 *   talk    → status conversation_requested (Founder notified; they meet, then decide)
 *   decline → status declined        (Founder notified; closes respectfully)
 *
 * Honest: no durable store → 503 retry, never a faked success. Non-disclosing on
 * an invalid token. The token is read from the body only, never logged.
 *
 * WORKSPACE RULE: acceptance never creates a desk. ready_for_workspace is reached
 * only by an explicit Founder authorization later (see advance.js).
 */

import { resolveInvitation, decisionNotification, founderNotifyAddress, phaseOf, STATUS } from '../../_lib/invitation.js';
import { sendEmail } from '../../_lib/email.js';

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' };
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: HEADERS });
const RETRY = () => json({ ok: false, retry: true, error: 'We could not record your response just yet. Please try again in a moment.' }, 503);

const PERIODS = { 'a few days': '+3 days', 'one week': '+7 days', 'two weeks': '+14 days' };
const TERMINAL = new Set([STATUS.ACCEPTED, STATUS.DECLINED, STATUS.PLANNING_COMPLETE, STATUS.READY_FOR_WORKSPACE]);

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false }, 200); }

  const inv = await resolveInvitation(env, body && body.token);
  if (!inv) return json({ ok: false }, 200);
  if (!env.LHC_DB) return RETRY();

  const choice = String(body.choice || '');
  const db = env.LHC_DB;
  const before = inv.status;

  try {
    if (choice === 'accept') {
      if (before !== STATUS.ACCEPTED && before !== STATUS.DECLINED) {
        await db.prepare(
          `UPDATE invitations SET status='accepted', decision='accept',
             accepted_at=datetime('now'), decided_at=datetime('now')
           WHERE id=? AND status NOT IN ('accepted','declined')`).bind(inv.id).run();
        await notifyOnce(db, env, inv, 'accept');
      }
      return json({ ok: true, phase: 'accepted' });
    }

    if (choice === 'decline') {
      if (before !== STATUS.DECLINED) {
        await db.prepare(
          `UPDATE invitations SET status='declined', decision='decline',
             declined_at=datetime('now'), decided_at=datetime('now')
           WHERE id=? AND status!='declined'`).bind(inv.id).run();
        await notifyOnce(db, env, inv, 'decline');
      }
      return json({ ok: true, phase: 'declined' });
    }

    if (choice === 'talk') {
      if (!TERMINAL.has(before)) {
        const fresh = before !== STATUS.CONVERSATION_REQUESTED;
        await db.prepare(
          `UPDATE invitations SET status='conversation_requested', decision='talk',
             conversation_requested_at=COALESCE(conversation_requested_at, datetime('now'))
           WHERE id=? AND status NOT IN ('accepted','declined')`).bind(inv.id).run();
        if (fresh) await notifyOnce(db, env, inv, 'talk');
      }
      return json({ ok: true, phase: 'conversation' });
    }

    if (choice === 'time') {
      const mod = PERIODS[body.reminderPeriod] || PERIODS['one week'];
      const period = PERIODS[body.reminderPeriod] ? body.reminderPeriod : 'one week';
      if (!TERMINAL.has(before)) {
        await db.prepare(
          `UPDATE invitations SET status='reminder_scheduled', decision='time',
             reminder_period=?, reminder_at=datetime('now', ?)
           WHERE id=? AND status NOT IN ('accepted','declined')`).bind(period, mod, inv.id).run();
      }
      return json({ ok: true, phase: 'reminder', reminder: { period } });
    }
  } catch {
    return RETRY();
  }

  return json({ ok: false, error: 'Unknown choice.' }, 400);
}

/** Send the Founder email for a transition and mark notified (best-effort). */
async function notifyOnce(db, env, inv, kind) {
  const to = founderNotifyAddress(env);
  if (!to) return;
  const msg = decisionNotification(kind, inv.recipient_name);
  if (!msg) return;
  const sent = await sendEmail(env, { to, ...msg });
  if (sent && sent.ok) {
    try { await db.prepare("UPDATE invitations SET notified_at=datetime('now') WHERE id=?").bind(inv.id).run(); }
    catch { /* best-effort */ }
  }
}
