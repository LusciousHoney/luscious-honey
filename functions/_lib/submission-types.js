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
import {
  COMMON_FIELDS,
  SUBMISSION_FORMS,
  SUBMITTER_ROLES,
  roleLabel,
} from '../../shared/submission-forms.js'

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

// ── Framework types — built from the shared field spec ──────────────────────
// Every Collective creative pathway (Music, Book, Podcast, Visual Art, Event,
// Other Proposal) is generated from shared/submission-forms.js. The field spec
// drives BOTH this authoritative server-side validation and the public form's
// rendering, so the two can never drift. The registered artist_feature pathway
// above keeps its own bespoke module and is intentionally not regenerated here.

const ROLE_IDS = SUBMITTER_ROLES.map((r) => r.id)

function buildType(form) {
  const allFields = [...COMMON_FIELDS, ...form.fields]

  return {
    id: form.id,
    title: form.title,
    description: form.description,
    icon: form.icon,
    category: form.category,

    // Config projection — shared + type-specific fields, presentation metadata only.
    fields: allFields.map((f) => ({
      key: f.key, label: f.label, kind: f.kind, ...(f.options ? { options: f.options } : {}),
    })),

    editorSummary(fields) {
      const f = fields || {}
      const involve = Array.isArray(f.involvement) ? f.involvement.join(', ') : ''
      const desc = String(f.description || '').replace(/\s+/g, ' ').trim()
      const short = desc.length > 72 ? desc.slice(0, 71) + '…' : desc
      return [f.title, involve || short].filter(Boolean).join(' · ').slice(0, 120)
    },

    validate(raw) {
      const errors = {}

      // Who is submitting — authoritative membership check.
      const role = clean(raw.submitterRole, 40)
      if (!ROLE_IDS.includes(role)) errors.submitterRole = 'Please tell us who is submitting.'

      const values = {}
      for (const f of allFields) {
        if (f.kind === 'multi') {
          const raw0 = raw[f.key]
          const arr = Array.isArray(raw0) ? raw0 : (raw0 ? [raw0] : [])
          const chosen = arr
            .map((x) => clean(x, 120))
            .filter(Boolean)
            .filter((x) => !f.options || f.options.includes(x))
          if (f.required && !chosen.length) errors[f.key] = `Please choose ${f.label.toLowerCase()}.`
          values[f.key] = chosen
          continue
        }

        const v = clean(raw[f.key], f.max || 400)
        if (f.required && (!v || v.length < 2)) {
          errors[f.key] = `Please add ${f.label.toLowerCase()}.`
        } else if (v && f.kind === 'url' && !isHttpUrl(v)) {
          errors[f.key] = 'Please share a link starting with http:// or https://.'
        } else if (v && f.kind === 'email' && !isEmail(v)) {
          errors[f.key] = 'Please enter a valid email address.'
        } else if (v && f.kind === 'choice' && f.options && !f.options.includes(v)) {
          errors[f.key] = `Please choose a valid ${f.label.toLowerCase()}.`
        }
        values[f.key] = v
      }

      if (Object.keys(errors).length) return { ok: false, errors }

      const name = values.artistName
      const email = String(values.email || '').toLowerCase()

      // Stored payload (submissions.fields). artistName/email become the
      // submission's name/contact columns, so they are not duplicated here.
      // The human role label + submitter identity lead, so a reviewer never has
      // to infer the creative type or who proposed it from free text.
      const fields = { submittedBy: roleLabel(role) }
      for (const f of allFields) {
        if (f.key === 'artistName' || f.key === 'email') continue
        const v = values[f.key]
        if (f.kind === 'multi') { if (v.length) fields[f.key] = v }
        else if (v) fields[f.key] = v
      }

      return { ok: true, name, email, fields }
    },

    acknowledgment({ name }) {
      const who = (name && String(name).trim()) || 'there'
      const gold = '#b08a4f'
      const subject = 'Your submission has reached the desk'

      const text = [
        `Hi ${who},`,
        '',
        'Thank you for bringing this to Luscious Honey Collective. It has reached',
        'the editor’s desk.',
        '',
        'I’ll spend real time with it, and if it feels like the right fit for the',
        'House, you’ll hear from me. Nothing is decided by an automated system —',
        'I read every submission myself.',
        '',
        'Warmly,',
        'Luscious Honey Collective',
      ].join('\n')

      const html = `
      <div style="font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:0 auto;color:#2b2620;line-height:1.65;">
        <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:${gold};">Luscious Honey Collective</p>
        <h1 style="font-size:21px;font-weight:normal;letter-spacing:.01em;color:#2b2620;margin:0 0 16px;">Your submission has reached the desk.</h1>
        <p style="margin:0 0 14px;">Hi ${escapeHtml(who)},</p>
        <p style="margin:0 0 14px;">Thank you for bringing this to Luscious&nbsp;Honey&nbsp;Collective. It has reached the editor’s desk.</p>
        <p style="margin:0 0 14px;">I’ll spend real time with it, and if it feels like the right fit for the House, you’ll hear from me. Nothing is decided by an automated system — I read every submission myself.</p>
        <p style="margin:22px 0 0;font-style:italic;color:#6b6152;">Warmly,<br/>Luscious Honey Collective</p>
      </div>`

      return { subject, html, text }
    },
  }
}

// ── Registry ───────────────────────────────────────────────────────────────
const TYPES = {
  [artistFeature.id]: artistFeature,
}
for (const form of SUBMISSION_FORMS) {
  const type = buildType(form)
  TYPES[type.id] = type
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
