/**
 * Resend email delivery — fetch only, no SDK dependency. Generic transport used
 * by the submission foundation; message CONTENT is supplied by the caller (e.g.
 * a submission type's acknowledgment template), never hardcoded here.
 *
 * POSTs to https://api.resend.com/emails with the server-side RESEND_API_KEY.
 * The key and the From address are read from env (Cloudflare Pages encrypted
 * environment variables) — never exposed to the client, never hardcoded.
 *
 * Required env:
 *   RESEND_API_KEY — secret API key
 *   EMAIL_FROM     — verified sender on an approved LHC domain,
 *                    e.g. "Luscious Honey Collective <features@luscioushoney.org>"
 *
 * Returns { ok:true, id } only when Resend confirms acceptance with a message
 * id; otherwise { ok:false, error } with a compact (<=200 char) reason.
 */

export async function sendEmail(env, { to, subject, html, text }) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    return { ok: false, error: 'Email not configured (RESEND_API_KEY / EMAIL_FROM missing).' }
  }

  let res, data
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, html, text }),
    })
  } catch (err) {
    return { ok: false, error: compact('Network error reaching Resend: ' + (err && err.message)) }
  }

  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (res.ok && data && data.id) {
    return { ok: true, id: String(data.id) }
  }

  const detail = (data && (data.message || data.error || data.name)) || `HTTP ${res.status}`
  return { ok: false, error: compact(`Resend rejected (${res.status}): ${detail}`) }
}

export function compact(s) {
  return String(s || 'Unknown error').replace(/\s+/g, ' ').trim().slice(0, 200)
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}
