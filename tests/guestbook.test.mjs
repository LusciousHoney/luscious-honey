/* =============================================================================
   TK Guest Book — pure submission-logic tests.

   Exercises functions/_lib/guestbook.js directly (no Worker, no D1, no network):
     - empty / whitespace-only reflection is rejected
     - over-length reflection and name are rejected
     - honeypot (`website`) filled → flagged as spam (caller silently accepts)
     - blank name defaults to 'Anonymous'
     - control characters are stripped; angle brackets are preserved verbatim
     - a well-formed submission passes and is normalized

   Run with:  npm test   (Node's built-in runner, no framework)
   ============================================================================= */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  validate,
  normalizeText,
  isHoneypotTripped,
  LIMITS,
  DEFAULT_NAME,
  TRIBUTE_ID,
} from '../functions/_lib/guestbook.js'

// ── Constants ────────────────────────────────────────────────────────────────
test('tribute id and limits are as specified', () => {
  assert.equal(TRIBUTE_ID, 'tk')
  assert.equal(LIMITS.reflection, 2000)
  assert.equal(LIMITS.name, 80)
})

// ── Empty / whitespace reflection ────────────────────────────────────────────
test('empty reflection is rejected', () => {
  const r = validate({ reflection: '' })
  assert.equal(r.ok, false)
  assert.ok(r.error)
  assert.ok(!r.spam)
})

test('whitespace-only reflection is rejected', () => {
  const r = validate({ reflection: '   \n\t  ' })
  assert.equal(r.ok, false)
  assert.ok(r.error)
})

test('missing / non-object body is rejected, not thrown', () => {
  assert.equal(validate(undefined).ok, false)
  assert.equal(validate(null).ok, false)
  assert.equal(validate('nope').ok, false)
})

// ── Length limits ────────────────────────────────────────────────────────────
test('over-length reflection is rejected', () => {
  const r = validate({ reflection: 'x'.repeat(LIMITS.reflection + 1) })
  assert.equal(r.ok, false)
  assert.match(r.error, /2000/)
})

test('reflection exactly at the limit is accepted', () => {
  const r = validate({ reflection: 'x'.repeat(LIMITS.reflection) })
  assert.equal(r.ok, true)
  assert.equal(r.value.reflection.length, LIMITS.reflection)
})

test('over-length name is rejected', () => {
  const r = validate({ reflection: 'hello', display_name: 'n'.repeat(LIMITS.name + 1) })
  assert.equal(r.ok, false)
  assert.match(r.error, /80/)
})

// ── Honeypot ─────────────────────────────────────────────────────────────────
test('honeypot filled → spam flag, no error, not ok', () => {
  const r = validate({ reflection: 'a real message', website: 'http://spam.example' })
  assert.equal(r.ok, false)
  assert.equal(r.spam, true)
})

test('isHoneypotTripped: empty / missing website is not spam', () => {
  assert.equal(isHoneypotTripped({ website: '' }), false)
  assert.equal(isHoneypotTripped({ website: '   ' }), false)
  assert.equal(isHoneypotTripped({}), false)
  assert.equal(isHoneypotTripped({ website: 'anything' }), true)
})

// ── Name defaulting ──────────────────────────────────────────────────────────
test('blank name defaults to Anonymous', () => {
  const r = validate({ reflection: 'thank you', display_name: '' })
  assert.equal(r.ok, true)
  assert.equal(r.value.display_name, DEFAULT_NAME)
})

test('missing name defaults to Anonymous', () => {
  const r = validate({ reflection: 'thank you' })
  assert.equal(r.ok, true)
  assert.equal(r.value.display_name, DEFAULT_NAME)
})

test('provided name is preserved (trimmed)', () => {
  const r = validate({ reflection: 'thank you', display_name: '  Melody  ' })
  assert.equal(r.ok, true)
  assert.equal(r.value.display_name, 'Melody')
})

// ── Normalization / injection safety ─────────────────────────────────────────
test('control characters are stripped from stored text', () => {
  const dirty = 'line one\x00\x07 still here\x1F end'
  const clean = normalizeText(dirty)
  assert.ok(!/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(clean))
  assert.match(clean, /line one/)
  assert.match(clean, /end/)
})

test('angle brackets are preserved verbatim (renderer escapes, not storage)', () => {
  const r = validate({ reflection: 'i <3 this <b>so</b> much' })
  assert.equal(r.ok, true)
  assert.equal(r.value.reflection, 'i <3 this <b>so</b> much')
})

test('CRLF is normalized to LF and excess blank lines collapsed', () => {
  const r = validate({ reflection: 'a\r\n\r\n\r\n\r\nb' })
  assert.equal(r.ok, true)
  assert.equal(r.value.reflection, 'a\n\nb')
})

test('a well-formed submission passes with normalized values', () => {
  const r = validate({ reflection: '  A quiet thank you.  ', display_name: 'A Friend', website: '' })
  assert.deepEqual(r, { ok: true, value: { reflection: 'A quiet thank you.', display_name: 'A Friend' } })
})
