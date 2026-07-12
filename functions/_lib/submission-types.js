/**
 * Submission-type registry — the reusable intake framework.
 *
 * Each entry defines ONE editorial submission type: how to validate its public
 * form server-side, how to shape the stored `fields` payload, and the branded
 * acknowledgment it sends. Adding a future type (Author Features, Creator
 * Spotlights, Partnership/Speaking Requests, Residencies) is a new entry here
 * plus its own public form — storage, workflow, correspondence, audit, and auth
 * are all inherited unchanged.
 *
 * A type module exports:
 *   id            stable machine id (matches submissions.type and the intake URL)
 *   title         human name (institutional, e.g. "Artist Feature")
 *   description   one line — what this intake is for
 *   icon          a single emoji/glyph for nav + cards (presentation-only)
 *   category      grouping for future Office navigation (e.g. "Features")
 *   fields        [{ key, label, kind }] — the field schema (drives config-based UI)
 *   validate(raw) → { ok, fields?, name, email, errors? }  (server-side, authoritative)
 *   acknowledgment({ name }) → { subject, html, text } | null   (confirmation template)
 *   editorSummary(fields) → short one-line summary for editorial lists
 *
 * `describeType()` projects the presentation metadata (no functions) so the
 * future Editorial Office can render navigation and dashboards from config
 * rather than a hard-coded module list.
 */

import { escapeHtml } from './email.js'

// ── Artist Features — the first submission type ────────────────────────────
const INTERESTS = ['Interview', 'Live Performance', 'Interview + Live Performance']

const LIMITS = { name: 80, email: 160, music: 400, social: 160, promoting: 2000, notes: 2000 }

const artistFeature = {
  id: 'artist_feature',
  title: 'Artist Feature',
  description: 'Independent artists introducing themselves for a feature or conversation.',
  icon: '🎙️',
  category: 'Features',

  // Field schema — the shape the public form collects (drives config-based UI).
  fields: [
    { key: 'musicUrl',  label: 'Music',          kind: 'url' },
    { key: 'social',    label: 'Social',         kind: 'text' },
    { key: 'interest',  label: 'Interested in',  kind: 'choice' },
    { key: 'promoting', label: 'Promoting now',  kind: 'longtext' },
    { key: 'notes',     label: 'Before we talk', kind: 'longtext' },
  ],

  // One-line editorial summary for lists.
  editorSummary(fields) {
    const f = fields || {}
    const promoting = String(f.promoting || '').replace(/\s+/g, ' ').trim()
    const short = promoting.length > 80 ? promoting.slice(0, 79) + '…' : promoting
    return [f.interest, short].filter(Boolean).join(' · ')
  },

  validate(raw) {
    const name      = clean(raw.artistName, LIMITS.name)
    const email     = clean(raw.email, LIMITS.email).toLowerCase()
    const musicUrl  = clean(raw.musicUrl, LIMITS.music)
    const social    = clean(raw.social, LIMITS.social)
    const interest  = clean(raw.interest, 60)
    const promoting = clean(raw.promoting, LIMITS.promoting)
    const notes     = clean(raw.notes, LIMITS.notes)

    const errors = {}
    if (!name || name.length < 2) errors.artistName = 'Please share your artist or stage name.'
    if (!isEmail(email)) errors.email = 'Please enter a valid email address.'
    if (!isHttpUrl(musicUrl)) errors.musicUrl = 'Please share a link (starting with http:// or https://) where I can hear your music.'
    if (!INTERESTS.includes(interest)) errors.interest = 'Please choose what you’re interested in.'
    if (!promoting || promoting.length < 2) errors.promoting = 'Tell me a little about what you’re promoting right now.'

    if (Object.keys(errors).length) return { ok: false, errors }

    // The stored, type-specific payload (submissions.fields, as JSON).
    return {
      ok: true,
      name,
      email,
      fields: { musicUrl, social: social || null, interest, promoting, notes: notes || null },
    }
  },

  // Branded, warm, promises nothing (no acceptance, timeline, interview, publication).
  acknowledgment({ name }) {
    const who = (name && String(name).trim()) || 'there'
    const gold = '#b08a4f'
    const subject = 'Your introduction has reached the editor’s desk'

    const text = [
      `Hi ${who},`,
      '',
      'Thank you for taking the time to introduce yourself to Luscious Honey',
      'Collective.',
      '',
      'I’ll spend some time with your work, and if it feels like the right fit for',
      'a feature or conversation, you’ll hear from me.',
      '',
      'Warmly,',
      'Luscious Honey Collective',
    ].join('\n')

    const html = `
    <div style="font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:0 auto;color:#2b2620;line-height:1.65;">
      <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:${gold};">Luscious Honey Collective</p>
      <h1 style="font-size:21px;font-weight:normal;letter-spacing:.01em;color:#2b2620;margin:0 0 16px;">Your introduction has reached the desk.</h1>
      <p style="margin:0 0 14px;">Hi ${escapeHtml(who)},</p>
      <p style="margin:0 0 14px;">Thank you for taking the time to introduce yourself to Luscious&nbsp;Honey&nbsp;Collective.</p>
      <p style="margin:0 0 14px;">I’ll spend some time with your work, and if it feels like the right fit for a feature or conversation, you’ll hear from me.</p>
      <p style="margin:22px 0 0;font-style:italic;color:#6b6152;">Warmly,<br/>Luscious Honey Collective</p>
    </div>`

    return { subject, html, text }
  },
}

// ── Registry ───────────────────────────────────────────────────────────────
const TYPES = {
  [artistFeature.id]: artistFeature,
}

export function getSubmissionType(id) {
  return TYPES[id] || null
}

// Presentation metadata only (no functions) — safe to serialize to the client
// so future navigation/dashboards are generated from config.
export function describeType(type) {
  if (!type) return null
  return {
    id: type.id,
    title: type.title,
    description: type.description,
    icon: type.icon,
    category: type.category,
    fields: type.fields || [],
  }
}

// All registered types, as config. The future Editorial Office renders its
// intake navigation from this rather than a hard-coded list.
export function listSubmissionTypes() {
  return Object.values(TYPES).map(describeType)
}

// ── shared field helpers ────────────────────────────────────────────────────
function clean(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max)
}
function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}
function isHttpUrl(s) {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
