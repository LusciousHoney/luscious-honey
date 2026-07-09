/* =============================================================================
   EDITORIAL OFFICE — document schemas.
   Each document type is data: named stages of thoughtful questions. Adding a
   future document type means adding an object here — nothing else changes.
   The Founder's Note is fully realised; the others carry genuine starter
   schemas that use the same engine.
   ============================================================================= */

import type { DocType } from './types';

const foundersNote: DocType = {
  id: 'founders-note',
  name: "Founder's Note",
  blurb: 'The first permanent voice of the House — why it exists, and what it believes.',
  stages: [
    {
      id: 'foundation', name: 'The Foundation',
      questions: [
        { id: 'fn-why', type: 'open',
          prompt: 'Before we talk about the House, tell me plainly — why does the Luscious Honey Collective need to exist?',
          placeholder: 'Say it the way you would to one person you trust.' },
        { id: 'fn-for', type: 'multi', allowOther: true,
          prompt: 'Which of these ring true about what the House is for?',
          help: 'Choose any number.',
          options: ['To give overlooked work a home', 'To slow readers down', 'To take creators seriously',
                    'To preserve what would otherwise be lost', 'To make a place, not a feed'] },
        { id: 'fn-oneline', type: 'choice', allowOther: true,
          prompt: 'If a stranger asked what the House is, in one breath, which comes closest?',
          options: ['A publishing house', 'An institution', 'A home for storytellers', 'A studio'] },
      ],
    },
    {
      id: 'philosophy', name: 'The Philosophy',
      questions: [
        { id: 'fn-belief', type: 'open',
          prompt: 'What belief about creative work are you unwilling to compromise on?',
          placeholder: 'The line you will not move.' },
        { id: 'fn-sides', type: 'choice', allowOther: true,
          prompt: 'When the work and the audience conflict, the House sides with —',
          options: ['The work', 'The audience', 'It depends'] },
        { id: 'fn-refuse', type: 'multi', allowOther: true,
          prompt: 'What does the House refuse to do?',
          options: ['Fake activity', 'Chase trends', 'Sell attention', 'Flatten voices', 'Rush the work'] },
      ],
    },
    {
      id: 'voice', name: 'The Voice',
      questions: [
        { id: 'fn-person', type: 'open',
          prompt: "Describe the House's voice as if it were a person in a room.",
          placeholder: 'How do they speak? What do they never do?' },
        { id: 'fn-sounds', type: 'multi', allowOther: true,
          prompt: 'The House sounds —',
          options: ['Warm', 'Exacting', 'Unhurried', 'Literary', 'Plainspoken', 'Reverent'] },
        { id: 'fn-never', type: 'open',
          prompt: "What is one thing the House would never say?" },
      ],
    },
    {
      id: 'house', name: 'The House',
      questions: [
        { id: 'fn-tenseconds', type: 'open',
          prompt: 'What should a person feel in the first ten seconds inside the House?' },
        { id: 'fn-happiest', type: 'choice', allowOther: true,
          prompt: 'The House is happiest when —',
          options: ['A reader lingers', 'A creator feels seen', 'A quiet piece finds its person'] },
      ],
    },
    {
      id: 'future', name: 'The Future',
      questions: [
        { id: 'fn-kept', type: 'open',
          prompt: 'Twenty years from now, what has the House kept that everyone else abandoned?' },
        { id: 'fn-outlive', type: 'open',
          prompt: 'What kind of work deserves to outlive you?' },
      ],
    },
  ],
};

const editorialCharter: DocType = {
  id: 'editorial-charter',
  name: 'Editorial Charter',
  blurb: 'The standing rules the House holds itself to — what it publishes, and what it will not.',
  stages: [
    { id: 'principles', name: 'The Principles',
      questions: [
        { id: 'ch-publish', type: 'open', prompt: 'What earns a place in the House? Describe the bar for publishing.' },
        { id: 'ch-refuse', type: 'multi', allowOther: true, prompt: 'What will the House never publish?',
          options: ['Filler', 'Ad-shaped content', 'Anything dishonest about who made it', 'Work rushed to hit a date'] },
        { id: 'ch-truth', type: 'open', prompt: 'How does the House stay truthful when a room is quiet or empty?' },
      ] },
    { id: 'care', name: 'The Care',
      questions: [
        { id: 'ch-creators', type: 'open', prompt: 'What does the House owe the people whose work it holds?' },
        { id: 'ch-readers', type: 'open', prompt: 'What does the House owe the person reading?' },
      ] },
  ],
};

const houseJournal: DocType = {
  id: 'house-journal',
  name: 'House Journal',
  blurb: 'A dated note from the desk — the founder’s voice, made physical.',
  stages: [
    { id: 'week', name: 'This Week',
      questions: [
        { id: 'hj-happened', type: 'open', prompt: 'What genuinely happened in the House this week? (Only what is real.)' },
        { id: 'hj-noticed', type: 'open', prompt: 'What did you notice, change your mind about, or almost get wrong?' },
        { id: 'hj-leave', type: 'open', prompt: 'What one line should a reader leave with?' },
      ] },
  ],
};

/** A concise, genuine starter for a document type still finding its shape. */
function starter(id: string, name: string, blurb: string, questions: DocType['stages'][number]['questions']): DocType {
  return { id, name, blurb, stages: [{ id: 'start', name: 'The Beginning', questions }] };
}

const lanternEssay = starter('lantern-essay', 'Lantern Room Essay',
  'The single held idea a featured work is really about.', [
    { id: 'le-work', type: 'open', prompt: 'Which work are we lighting, and what is it actually about beneath its subject?' },
    { id: 'le-why', type: 'open', prompt: 'Why does this deserve the one plinth, right now?' },
    { id: 'le-feel', type: 'open', prompt: 'What should someone carry out of the Lantern Room?' },
  ]);

const interview = starter('interview', 'Interview',
  'Preparation for a real conversation — who, why, and the questions worth asking.', [
    { id: 'iv-who', type: 'open', prompt: 'Who is the conversation with, and why them, why now?' },
    { id: 'iv-avoid', type: 'open', prompt: 'What conversation are people avoiding that this could open?' },
    { id: 'iv-questions', type: 'open', prompt: 'List the questions only you would think to ask.' },
  ]);

const artistFeature = starter('artist-feature', 'Artist Feature',
  'A portrait of a creator and the work that made you feel less alone.', [
    { id: 'af-who', type: 'open', prompt: 'Who is the artist, and what is the one thing most people miss about them?' },
    { id: 'af-work', type: 'open', prompt: 'Which piece of theirs would you put in the House first?' },
    { id: 'af-matters', type: 'open', prompt: 'Why does their work matter to the kind of reader the House is for?' },
  ]);

const newEditorial = starter('new-editorial', 'New Editorial',
  'A blank room for a document type the House has not named yet.', [
    { id: 'ne-title', type: 'open', prompt: 'Give this its working title.' },
    { id: 'ne-purpose', type: 'open', prompt: 'What is it for? What should exist after it is written that did not before?' },
    { id: 'ne-audience', type: 'open', prompt: 'Who is it for, exactly?' },
    { id: 'ne-notes', type: 'open', prompt: 'Anything else on your mind — fragments, references, half-thoughts.' },
  ]);

export const DOC_TYPES: DocType[] = [
  foundersNote, editorialCharter, houseJournal, lanternEssay, interview, artistFeature, newEditorial,
];

export function getDocType(id: string): DocType | undefined {
  return DOC_TYPES.find((d) => d.id === id);
}
