/* =============================================================================
   EDITORIAL OFFICE — document schemas.
   Each document type is data: named stages of thoughtful questions. Adding a
   future document type means adding an object here — nothing else changes.
   The Founder's Note is fully realised; the others carry genuine starter
   schemas that use the same engine.
   ============================================================================= */

import type { DocType } from './types';

// The Founder's Interview — source material for the first public documents:
// the Founder's Note, the Editorial Charter, House Journal No. 1, Writing Wall
// Fragment No. 1, and Lantern Room Essay No. 1. One question per card; `category`
// also groups the generated packet by editorial theme.
const foundersNote: DocType = {
  id: 'founders-note',
  name: "Founder's Note",
  blurb: 'The founding interview — the origin, the beliefs, the people, the voice, and what it leaves behind.',
  stages: [
    {
      id: 'foundation', name: 'The Foundation',
      questions: [
        { id: 'fn-origin-moment', type: 'open', category: 'Origin story',
          prompt: 'Take me back to the moment the House first became necessary to you. Where were you, and what was happening?',
          help: 'A scene, not a summary.' },
        { id: 'fn-origin-work', type: 'open', category: 'Origin story',
          prompt: 'What piece of work — a book, a song, a film, a conversation — set you on this path? Describe your first encounter with it.' },
        { id: 'fn-name', type: 'open', category: 'Origin story',
          prompt: 'Where does the name Luscious Honey come from, and what does it hold that a plainer name would miss?' },
        { id: 'fn-hands', type: 'open', category: 'Origin story',
          prompt: 'Whose hands shaped you before this — a mentor, a family trade, a place? What did they teach you about making things well?' },
        { id: 'fn-why-plain', type: 'open', category: 'Why the House exists',
          prompt: 'Say plainly, in a sentence or two, why the Luscious Honey Collective needs to exist.',
          placeholder: 'The way you would say it to one person across a table.' },
        { id: 'fn-gap', type: 'open', category: 'Why the House exists',
          prompt: 'What was missing in the world that the House is meant to answer?' },
        { id: 'fn-for', type: 'multi', allowOther: true, category: 'Why the House exists',
          prompt: 'Which of these come closest to what the House is for?',
          help: 'Choose any that ring true.',
          options: ['To give overlooked work a home', 'To slow readers down', 'To take creators seriously',
                    'To preserve what would otherwise be lost', 'To make a place rather than a feed',
                    'To gather people around real work'] },
        { id: 'fn-oneline', type: 'choice', allowOther: true, category: 'Why the House exists',
          prompt: 'If a stranger asked what the House is, in one breath, which is nearest the truth?',
          options: ['A publishing house', 'An institution', 'A home for storytellers', 'A studio', 'A record of a community'] },
      ],
    },
    {
      id: 'philosophy', name: 'The Philosophy',
      questions: [
        { id: 'fn-belief', type: 'open', category: 'Editorial standards',
          prompt: 'What belief about creative work will you hold to, whatever it costs?',
          placeholder: 'The line you will not move.' },
        { id: 'fn-protect', type: 'open', category: 'What it protects',
          prompt: 'What is the House built to protect? Name the thing you would guard first.' },
        { id: 'fn-bar', type: 'open', category: 'Editorial standards',
          prompt: 'When you picture the bar a piece must clear to earn a place here, what does clearing it look like?' },
        { id: 'fn-refuse', type: 'multi', allowOther: true, category: 'Editorial standards',
          prompt: 'What does the House refuse to do?',
          options: ['Fake activity', 'Chase trends', 'Sell attention', 'Flatten voices', 'Rush the work',
                    'Pad the archive to look full'] },
        { id: 'fn-sides', type: 'choice', allowOther: true, category: 'Editorial standards',
          prompt: 'When the work and the audience pull in opposite directions, the House leans toward —',
          options: ['The work', 'The audience', 'Whichever the moment asks for'] },
        { id: 'fn-quiet-truth', type: 'open', category: 'What it protects',
          prompt: 'How does the House stay honest when a room is empty — no event, no new work, nothing to announce?' },
        { id: 'fn-danger', type: 'open', category: 'What it protects',
          prompt: 'What is the most likely way the House could lose its soul, and how will you catch it early?' },
        { id: 'fn-money', type: 'open', category: 'Editorial standards',
          prompt: 'Where does money belong in the House, and where must it never reach?' },
      ],
    },
    {
      id: 'community', name: 'The Community',
      questions: [
        { id: 'fn-who', type: 'open', category: 'Who it serves',
          prompt: 'Picture one person the House is truly for. Who are they, and what is their day like before they find you?' },
        { id: 'fn-serves', type: 'multi', allowOther: true, category: 'Who it serves',
          prompt: 'Who does the House serve first?',
          options: ['Creators making difficult work', 'Readers who want depth', 'People the mainstream overlooks',
                    'Craftspeople and their apprentices', 'Anyone willing to slow down'] },
        { id: 'fn-owe-creators', type: 'open', category: 'Community values',
          prompt: 'What does the House owe the people whose work it holds?' },
        { id: 'fn-owe-readers', type: 'open', category: 'Community values',
          prompt: 'What does the House owe the person reading, listening, or watching?' },
        { id: 'fn-belong', type: 'open', category: 'Community values',
          prompt: 'What should belonging here feel like — and what should it never require?' },
        { id: 'fn-conduct', type: 'multi', allowOther: true, category: 'Community values',
          prompt: 'The community is at its best when people are —',
          options: ['Generous with attention', 'Honest without cruelty', 'Patient with unfinished work',
                    'Loyal to the craft', 'Curious across differences'] },
        { id: 'fn-less-alone', type: 'open', category: 'Community values',
          prompt: 'Tell me about a creator whose work made you feel less alone. What did they give you that you want the House to give others?' },
      ],
    },
    {
      id: 'voice', name: 'The Editorial Voice',
      questions: [
        { id: 'fn-person', type: 'open', category: 'Tone and voice',
          prompt: "If the House's voice were a person in a room, describe them — how they speak, what they notice, what they would never do." },
        { id: 'fn-sounds', type: 'multi', allowOther: true, category: 'Tone and voice',
          prompt: 'The House sounds —',
          options: ['Warm', 'Exacting', 'Unhurried', 'Literary', 'Plainspoken', 'Reverent', 'Wry'] },
        { id: 'fn-first-seconds', type: 'open', category: 'Tone and voice',
          prompt: 'What should a person feel in the first ten seconds inside the House?' },
        { id: 'fn-never-say', type: 'open', category: 'Tone and voice',
          prompt: 'What is one thing the House would never say, in any circumstance?' },
        { id: 'fn-avoid-words', type: 'open', category: 'Tone and voice',
          prompt: 'What language or tone makes you wince when other institutions use it? Name what we will avoid.' },
        { id: 'fn-words-keep', type: 'open', category: 'Phrases worth preserving',
          prompt: 'Are there words, sayings, or turns of phrase — yours or inherited — that the House should carry? Write them as you want them kept.',
          placeholder: 'Exact wording matters here.' },
        { id: 'fn-line', type: 'open', category: 'Possible pull quotes',
          prompt: 'Give me one line that could stand alone on a wall and still mean everything. Leave it rough — just say it true.' },
        { id: 'fn-fragment', type: 'open', category: 'Possible Writing Wall fragments',
          prompt: 'Offer an unfinished fragment — a sentence left mid-thought that a reader could fall into. It does not need an ending.',
          placeholder: 'Something like: “She kept the letter, unopened, for nineteen years—”' },
      ],
    },
    {
      id: 'legacy', name: 'The Legacy',
      questions: [
        { id: 'fn-twenty-years', type: 'open', category: 'Legacy vision',
          prompt: 'Twenty years from now, what has the House kept that everyone else abandoned?' },
        { id: 'fn-outlive', type: 'open', category: 'Legacy vision',
          prompt: 'What kind of work deserves to outlive you — and how will the House make room for it?' },
        { id: 'fn-remembered', type: 'open', category: 'Legacy vision',
          prompt: 'When someone describes the House to a stranger long after you are gone, what do you hope they say?' },
        { id: 'fn-inherit', type: 'open', category: 'Legacy vision',
          prompt: 'What did you inherit — from a person, a place, a tradition — that you want the House to pass on?' },
        { id: 'fn-success', type: 'choice', allowOther: true, category: 'Legacy vision',
          prompt: 'You will know the House succeeded when —',
          options: ['A quiet piece finds the person who needed it', 'A creator does their best work here',
                    'People treat it as a place, not a product', 'It is still honest after decades'] },
        { id: 'fn-last-line', type: 'open', category: 'Possible pull quotes',
          prompt: 'If the House could leave one sentence to the people who come after, what would it be?' },
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
