/* =============================================================================
   Submission-type registry — the Collective Creative Intake Activation.
   Focused tests for the new framework-built types (Music, Book, Podcast, Visual
   Art, Event, Other Proposal) and confirmation the retained artist_feature
   pathway is unchanged. Pure: no D1, no network.
   ============================================================================= */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  getSubmissionType,
  listSubmissionTypes,
  describeType,
} from '../functions/_lib/submission-types.js'
import { SUBMISSION_FORMS } from '../shared/submission-forms.js'

const NEW_IDS = ['music', 'book', 'podcast', 'visual_art', 'event', 'other_proposal']

test('registry exposes the retained artist_feature plus all Version 1 pathways', () => {
  const ids = listSubmissionTypes().map((t) => t.id)
  assert.ok(ids.includes('artist_feature'), 'artist_feature retained')
  for (const id of NEW_IDS) assert.ok(ids.includes(id), `registered: ${id}`)
  assert.equal(ids.length, 1 + NEW_IDS.length)
})

test('the shared spec and the registry stay in lockstep', () => {
  assert.equal(SUBMISSION_FORMS.length, NEW_IDS.length)
  for (const id of NEW_IDS) assert.ok(getSubmissionType(id), `built from spec: ${id}`)
})

test('each new type projects shared + type-specific fields to the client', () => {
  const music = describeType(getSubmissionType('music'))
  const keys = music.fields.map((f) => f.key)
  // shared fields present
  for (const k of ['submitterName', 'email', 'artistName', 'title', 'description', 'involvement']) {
    assert.ok(keys.includes(k), `shared field ${k}`)
  }
  // type-specific fields present
  for (const k of ['format', 'listeningLink', 'releaseStatus']) assert.ok(keys.includes(k), `music field ${k}`)
  // involvement carries its options for the form
  const involvement = music.fields.find((f) => f.key === 'involvement')
  assert.ok(Array.isArray(involvement.options) && involvement.options.length > 0)
})

function baseMusic(extra = {}) {
  return {
    submitterRole: 'self',
    submitterName: 'Ada Vaughn',
    email: 'ADA@Example.com',
    artistName: 'Ada V',
    title: 'Midnight Hours',
    description: 'A late-night single about leaving a city behind.',
    format: 'Single',
    listeningLink: 'https://example.com/track',
    involvement: ['Editorial', 'Production'],
    ...extra,
  }
}

test('a valid music submission validates and shapes the stored payload', () => {
  const music = getSubmissionType('music')
  const v = music.validate(baseMusic())
  assert.equal(v.ok, true)
  assert.equal(v.name, 'Ada V', 'submission name is the artist/creator')
  assert.equal(v.email, 'ada@example.com', 'email normalised to lowercase')
  // artistName + email are columns, never duplicated into fields
  assert.equal(v.fields.artistName, undefined)
  assert.equal(v.fields.email, undefined)
  // the human submitter role leads so a reviewer never infers it
  assert.equal(v.fields.submittedBy, 'The artist — submitting my own work')
  assert.equal(v.fields.title, 'Midnight Hours')
  assert.equal(v.fields.format, 'Single')
  assert.deepEqual(v.fields.involvement, ['Editorial', 'Production'])
})

test('missing required fields are reported, not silently accepted', () => {
  const music = getSubmissionType('music')
  const v = music.validate(baseMusic({ title: '', listeningLink: '' }))
  assert.equal(v.ok, false)
  assert.ok(v.errors.title)
  assert.ok(v.errors.listeningLink)
})

test('an unknown submitter role is rejected', () => {
  const music = getSubmissionType('music')
  const v = music.validate(baseMusic({ submitterRole: 'nobody' }))
  assert.equal(v.ok, false)
  assert.ok(v.errors.submitterRole)
})

test('a non-http listening link is rejected', () => {
  const music = getSubmissionType('music')
  const v = music.validate(baseMusic({ listeningLink: 'ftp://nope' }))
  assert.equal(v.ok, false)
  assert.ok(v.errors.listeningLink)
})

test('an out-of-set choice is rejected', () => {
  const music = getSubmissionType('music')
  const v = music.validate(baseMusic({ format: 'Symphony' }))
  assert.equal(v.ok, false)
  assert.ok(v.errors.format)
})

test('unknown involvement options are dropped, valid ones kept', () => {
  const music = getSubmissionType('music')
  const v = music.validate(baseMusic({ involvement: ['Editorial', 'Mind Control'] }))
  assert.equal(v.ok, true)
  assert.deepEqual(v.fields.involvement, ['Editorial'])
})

test('a Founder can propose an artist who is not submitting personally', () => {
  const book = getSubmissionType('book')
  const v = book.validate({
    submitterRole: 'representative',
    submitterName: 'Melody',
    email: 'melody@example.com',
    artistName: 'Toni Okafor',
    relationship: 'I admire her work',
    title: 'The Long Room',
    description: 'A debut novel the House should hold.',
    author: 'Toni Okafor',
    pubStatus: 'Forthcoming',
  })
  assert.equal(v.ok, true)
  assert.equal(v.name, 'Toni Okafor', 'the subject is the proposed artist')
  assert.equal(v.fields.submittedBy, 'A Collective representative proposing an artist')
  assert.equal(v.fields.relationship, 'I admire her work')
})

test('every new type carries a branded acknowledgment and an editor summary', () => {
  for (const id of NEW_IDS) {
    const type = getSubmissionType(id)
    const ack = type.acknowledgment({ name: 'Ren' })
    assert.ok(ack.subject && ack.html && ack.text, `${id} acknowledgment`)
    const summary = type.editorSummary({ title: 'A Piece', involvement: ['Editorial'] })
    assert.ok(summary.includes('A Piece'), `${id} summary names the title`)
  }
})

test('the retained artist_feature pathway still validates as before', () => {
  const af = getSubmissionType('artist_feature')
  const v = af.validate({
    artistName: 'Nova',
    email: 'nova@example.com',
    musicUrl: 'https://example.com/nova',
    interest: 'Interview',
    promoting: 'A new EP about the coast.',
  })
  assert.equal(v.ok, true)
  assert.equal(v.name, 'Nova')
  assert.equal(v.fields.interest, 'Interview')
})
