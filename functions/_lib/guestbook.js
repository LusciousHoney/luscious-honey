/**
 * TK Guest Book — pure submission logic (no I/O, no Worker globals).
 *
 * Split out from the endpoint so it can be unit-tested with `node --test`
 * (see tests/guestbook.test.mjs). Everything here is deterministic string
 * work: normalization, length limits, honeypot detection, and validation.
 * No database, no request, no crypto — those live in the endpoint that
 * imports this module.
 */

// Which tribute these submissions belong to. The table is keyed by this so a
// second tribute can share the same schema without colliding.
export const TRIBUTE_ID = 'tk'

// Hard character ceilings. Enforced server-side even though the form also sets
// `maxlength` — the client attribute is a courtesy, not a guarantee.
export const LIMITS = { reflection: 2000, name: 80 }

// Shown in the ledger when a visitor leaves the name blank.
export const DEFAULT_NAME = 'Anonymous'

/**
 * Neutralize a raw string for safe storage.
 * - strips ASCII control characters (except we collapse them to spaces) so no
 *   NULs, escape sequences, or line-terminator tricks reach the database
 * - normalizes CRLF/CR to LF, then collapses runs of 3+ newlines to 2
 * - trims leading/trailing whitespace
 *
 * We deliberately do NOT strip `<` / `>` here — the value is stored verbatim
 * and only ever rendered via `textContent` (client) or as JSON (admin), so
 * there is no HTML sink to inject into. Mangling angle brackets would corrupt
 * legitimate reflections ("i <3 this"). Escaping is the renderer's job.
 */
export function normalizeText(input) {
  if (typeof input !== 'string') return ''
  let s = input.replace(/\r\n?/g, '\n')
  // Drop control chars except newline (\n = 0x0A) and tab (\x09 → space).
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  s = s.replace(/\t/g, ' ')
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trim()
}

/**
 * Was the honeypot tripped? The form ships an off-screen `website` input that
 * humans never see and bots tend to fill. Any non-empty value → treat as spam.
 */
export function isHoneypotTripped(body) {
  const hp = body && body.website
  return typeof hp === 'string' && hp.trim().length > 0
}

/**
 * Validate + normalize a submission body.
 *
 * Returns one of:
 *   { ok: true,  value: { reflection, display_name } }
 *   { ok: false, spam: true }                 // honeypot — caller silently accepts
 *   { ok: false, error: '<human message>' }   // real validation failure
 */
export function validate(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Malformed submission.' }
  }

  if (isHoneypotTripped(body)) {
    return { ok: false, spam: true }
  }

  const reflection = normalizeText(body.reflection)
  if (!reflection) {
    return { ok: false, error: 'Please write a reflection before submitting.' }
  }
  if (reflection.length > LIMITS.reflection) {
    return { ok: false, error: `Please keep your reflection under ${LIMITS.reflection} characters.` }
  }

  let display_name = normalizeText(body.display_name)
  if (display_name.length > LIMITS.name) {
    return { ok: false, error: `Please keep your name under ${LIMITS.name} characters.` }
  }
  if (!display_name) display_name = DEFAULT_NAME

  return { ok: true, value: { reflection, display_name } }
}
