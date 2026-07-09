# Founder Interview — Version 2 (proposal)

Editor's review of the current 36 questions. **Proposal only** — no schema change
in this sprint. Retained by design: **five stages · one question per screen ·
autosave · resume · version history** (engine untouched).

> Caveat: "keep vs cut" is ultimately judged by which questions produced rich
> answers. I do **not** have the founder's 35/37 responses yet, so this evaluates
> each question's *design* (story-eliciting quality). Validate final cuts against
> the real answers once the packet is provided.

## Criteria (magazine editor's lens)

Uncover stories, not facts · no ambiguity · no corporate/abstract language ·
invite reflection · pace the emotion · transition smoothly between stages.

## Keep as-is (already story-first, working)

`fn-origin-moment`, `fn-origin-work`, `fn-name`, `fn-hands`, `fn-why-plain`,
`fn-gap`, `fn-belief`, `fn-protect`, `fn-quiet-truth`, `fn-who`, `fn-owe-creators`,
`fn-owe-readers`, `fn-less-alone`, `fn-person`, `fn-first-seconds`, `fn-never-say`,
`fn-avoid-words`, `fn-words-keep`, `fn-line`, `fn-fragment`, `fn-twenty-years`,
`fn-outlive`, `fn-remembered`, `fn-inherit`, `fn-last-line`.

## Rewrite (weaker — abstract, categorizing, or corporate)

| id | Why it's weak | Proposed V2 (story-first) |
| --- | --- | --- |
| `fn-oneline` (choice) | Asks to categorize the House; produces a label, not a story. | **Open:** "Finish this out loud: *The House is the kind of place where—*. Then tell me about the moment you knew that." |
| `fn-bar` | "the bar a piece must clear" is editorial jargon; abstract. | "Tell me about one piece you'd fight to publish, and one you'd quietly turn away. What separated them?" |
| `fn-money` | "where money belongs / never reach" is abstract policy. | "Tell me about a time money and the work pulled against each other. What did you do, and what did it teach you?" |
| `fn-danger` | "lose its soul" is a concept, not a scene. | "Picture the version of the House that disappointed you. What happened to it — and what was the first small wrong turn?" |
| `fn-belong` | Two abstractions in one question (ambiguity). | "Describe the first time someone felt they belonged here. What did you do to make that happen?" |
| `fn-sides` (choice) | False binary (work vs audience). | "Tell me about a time the work and the audience wanted different things. Who did you listen to, and would you again?" |
| `fn-conduct` (multi) | Survey checklist of virtues. | Keep as a *light* multi for pacing, but add one open follow-up: "Name a person in your life who embodies how you want people to treat each other here." |
| `fn-success` (choice) | Picks a success metric; thin. | "Years from now, someone tells you the House changed something for them. What do you hope they describe?" |

## Consider merging (mild redundancy)

`fn-protect` / `fn-quiet-truth` / `fn-danger` circle the same instinct (what the
House guards). Keep `fn-protect` + the rewritten `fn-danger`; fold `fn-quiet-truth`
into Philosophy only if the real answers show overlap. **Confirm against packet.**

## Keep as pacing beats (do not over-cut the choice/multi)

`fn-for`, `fn-refuse`, `fn-serves`, `fn-sounds` are quick, low-effort screens that
let the founder breathe between heavy open questions. Keep them — but place them
*between* two demanding opens, not back-to-back with each other.

## Emotional pacing & transitions (new, optional)

- **Stage intros.** Add a one-line italic framing shown above the first question
  of each stage (data-only; the engine already renders per-stage). Suggested:
  - Foundation — *"Start at the beginning. Tell it the way you'd tell a friend."*
  - Philosophy — *"Now the harder ground: what you believe, and what you'll guard."*
  - Community — *"Turn toward the people."*
  - Editorial Voice — *"Listen for how the House sounds."*
  - Legacy — *"Look past yourself."*
- **Rhythm.** Open each stage warm, put the most demanding question 2nd–3rd (not
  1st), and close each stage on a reflective open, not a checklist.
- **Hand-off line** at the end: *"That's enough for the first draft. Come back
  whenever there's more."* (empty-state voice already supports this.)

## Implementation note (later sprint, on approval)

All changes are **content-only** edits to `src/office/schema.ts` (+ an optional
`stage.intro?` field, additive). No engine, persistence, packet, or routing
change. Ship as a new schema behind the existing version-history so V1 packets
remain intact.
