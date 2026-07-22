/* =============================================================================
   EXECUTIVE TEAM HEADQUARTERS — entry, arrival ceremony + hash router.

   Milestone 2 — Headquarters Arrival and the Executive Office.

   One Headquarters. Wings are ROOM VIEWS within it — not separate applications —
   mounted by a hash router, exactly as the Editorial Office mounts its views.

   Two states, per the approved theatrical model:
     • Scene  — the Executive Office: a bright first-of-summer morning; the day
                begins here, the six wings in view.
     • Seated — inside a wing, at its work surface (reserved for later milestones),
                with the room atmosphere dimmed behind the surface.

   Ambient FOUNDATION only: a time-of-day light state and a once-a-day Morning
   Arrival. No audio, no live weather, no wing workflows — those are later
   milestones. The Headquarters owns PRESENTATION and SESSION MEMORY only; it
   reads no operational data and holds no source of truth.
   ============================================================================= */

import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components.css';
import '../styles/headquarters.css';

import { ROOMS, HOME_ROOM, getRoom, isRoomId, type Room, type RoomId } from './rooms.ts';
import { loadLastRoom, saveLastRoom, shouldPlayArrival, markArrivalSeen } from './memory.ts';
import { timeOfDay, greeting, dayKey } from './time.ts';
import {
  fetchBriefing, fetchInbox, fetchItem, advanceStatus, addNote,
  fetchNotifications, inlineActions, STATUS_LABELS,
  type SubmissionDetail, type SubmissionStatus, type NotificationState,
} from './adapters.ts';
import { operationsFlow, type OperationsFlow } from './operations.ts';
import {
  creativeStudio, REFERENCE_VOLUMES, DIRECTION_INSCRIPTION,
  type OpenManuscript,
} from './creative.ts';
import { archiveTree, archiveFilters } from './archive.ts';
import {
  CALENDAR_CATEGORIES, categoriesForRoom, eventsForRoom, upcoming, groupByDay,
  makeEvent, loadEvents, saveEvents,
} from './calendar.ts';
import { DICTATION_DESTINATIONS, makeDraft } from './dictation.ts';
import {
  productionSprint, RECORDING_NOTE, REVIEW_NOTE, VOICE_NOTES_STUDIO,
  type ProductionSprint,
} from './production.ts';
import {
  isAcceptedMatter, deriveCreativeMatter, matterNarrative, nextRecommendation,
  responsibilityRole, type CreativeMatter,
} from './creative-matter.ts';
import { RELATIONSHIPS, SALON_LEDE, HORIZON_NOTE } from './growth.ts';
import { SAFEGUARDS, STUDY_LEDE, CONTINUITY_NOTE } from './business.ts';
import {
  COS_SECTIONS, COS_HOME_SECTION, isCosSection,
  COS_EYEBROW, COS_TITLE, COS_LEDE,
  BRIEFING, DECISIONS, DOCKET,
  openChairViews, leadershipViews, appointmentsOnRecord, leadershipHistoryView,
  RESPONSES,
  docketStatusLabel, getResponse,
  decisionViews, openDecisions, archiveShelves,
  makeResponse, loadResponses, saveResponses, recordResponse, clearResponse,
  type CosSectionId, type DecisionView,
} from './chief-of-staff.ts';
import {
  loadRecommendations, saveRecommendations, upsertRecommendation,
  makeSubmission, routeRecommendation, setVisibility,
  operationalBriefing, chiefOfStaffQueue,
  triage, prepareRecommendation, presentToFounder, requestRevision,
  recordFounderDecision, setBlocked, advance,
  decisionsForFounder,
  creativeQueue, creativeAccept, creativeStart, creativeComplete, creativeReturn,
  creativeRequestClarification, creativeStageLabel, creativeStanding,
  productionQueue, productionAccept, productionPlanning, productionReady, productionInProduction,
  productionDeliveryReady, productionComplete, productionReturn, productionRequestClarification,
  productionStageLabel, isProductionEligible, productionStanding, decisionLabel,
  growthQueue, growthAccept, growthStrategy, growthResearch, growthCampaignPlanning,
  growthReadyToLaunch, growthActive, growthMeasuring, growthComplete, growthReturn,
  growthRequestClarification, growthStageLabel, isGrowthEligible, growthStanding,
  // Sprint 12H — The Brokerage (office view over the 12G collaboration model)
  pendingHandoffProposals, handoffsAwaitingAcceptance, handoffsReturnedToOffice,
  unansweredConsultations, collaborationHistory,
  authorizeHandoff, withdrawHandoff, chairLabel, OFFICE_BROKER,
  type HandoffView, type ConsultationView, type CollaborationEvent, type CollaborationResult, type CollaborationDenial,
  SUBMISSION_TYPES, PRIORITIES, TRIAGE_OUTCOMES,
  recStatusLabel, priorityLabel, ownerLabel, typeLabel as recTypeLabel, visibilityLabel,
  triageStateLabel,
  type Recommendation, type SubmissionType, type Priority, type TriageOutcome,
} from './chief-of-staff-ops.ts';
import { CHAIRS as EXECUTIVE_CHAIRS, CHAIR_CHIEF_OF_STAFF } from './executive-register.ts';
import {
  openInitiative, decide as decideInitiative, completeInitiative, archiveInitiative,
  loadInitiatives, saveInitiatives, upsertInitiative, executiveLabel,
  executionResponsibilities, houseAttention, HISTORY_DISPOSITIONS,
  type HouseAttention, type Initiative, type FounderDecision,
} from './executive-workflow.ts';
import {
  partitionInitiatives, initiativeRecord, timelineEventLine,
} from './institutional-memory.ts';
import { arrivalBrief } from './headquarters-os.ts';
import { deriveExecutiveLoop } from './executive-loop.ts';
import { deriveEligibility, type Eligibility } from './execution-bridge.ts';
import {
  // Sprint 13F — the Executive Work Queue (a projection; owns nothing)
  QUEUE_OFFICES, QUEUE_PRIORITIES, queueOfficeLabel, queuePriorityLabel,
  loadWorkQueue, activeQueue, filterQueue, queueSummary, queueOwners,
  type QueueItem, type QueueOffice, type QueuePriority, type QueueFilter,
} from './executive-work-queue.ts';
import {
  // EOS Milestone 1 — Founder Attention v0 (a projection over the projection; owns nothing)
  deriveFounderAttention, attentionLineup,
} from './executive-attention.ts';
import {
  // Sprint 13A — Growth Intelligence (the Director of Growth's research desk)
  INTEL_SOURCES, INTEL_CATEGORIES, INTEL_CONFIDENCES, INTEL_REVIEW_OUTCOMES,
  intelSourceLabel, intelCategoryLabel, intelConfidenceLabel, intelStatusLabel, intelOutcomeLabel,
  makeIntelligenceItem, reviewIntelligence, routeIntelligenceToWork,
  loadIntelligence, saveIntelligence, upsertIntelligence,
  intelIntakeQueue, growthCaptures, founderReadyPipeline, intelStanding, capturedByLabel,
  type IntelligenceItem, type IntelSource, type IntelCategory, type IntelConfidence, type IntelReviewOutcome,
  type IntelAttachment,
} from './growth-intelligence.ts';
import {
  // Sprint 13B — Content Opportunity Brief (the analysis layer)
  CONTENT_PROPERTIES, OPPORTUNITY_TYPES, RATINGS, SCORE_DIMENSIONS,
  contentPropertyLabel, opportunityTypeLabel, opportunityStatusLabel, ratingLabel,
  makeContentOpportunity, updateOpportunity, scoreOpportunity, isIntelEligibleForBrief,
  markReadyForReview, recommendOpportunity, returnOpportunityForResearch, holdOpportunity, declineOpportunity,
  routeOpportunityToWork, founderBrief, isOpportunityRoutable,
  loadOpportunities, saveOpportunities, upsertOpportunity,
  draftOpportunities, opportunitiesForReview, founderReadyOpportunities, opportunityStanding, opportunityAuthorLabel,
  type ContentOpportunity, type ContentProperty, type OpportunityType, type Rating, type OpportunitySignals,
} from './content-opportunity.ts';
import {
  // Sprint 13C — Creative Assignment Pack (the Creative Director's planning layer)
  CONTENT_PLATFORMS, TIKTOK_FORMATS, SUBSTACK_KINDS,
  contentPlatformLabel, tiktokFormatLabel, substackKindLabel, assignmentStatusLabel, assignmentPropertyLabel,
  makeCreativeAssignment, updateAssignment, isOpportunityEligibleForAssignment,
  markAssignmentReady, approveAssignment, returnAssignmentForRevision, holdAssignment, declineAssignment,
  routeAssignmentToWork, founderAssignment, isAssignmentRoutable, assignmentAuthorLabel, crossPropertyReasons,
  loadAssignments, saveAssignments, upsertAssignment,
  draftAssignments, assignmentsForReview, approvedAssignments, assignmentStanding,
  type CreativeAssignment, type ContentPlatform, type TikTokFormat, type SubstackKind,
} from './creative-assignment.ts';
import {
  // Sprint 13D — Creative Drafting Assistant (controlled, AI-assisted staff layer)
  DRAFT_TYPES, VOICE_DIRECTIONS, draftTypeLabel, draftStatusLabel,
  buildDraftContext, deterministicDraftProvider, makeCreativeDraft, generateDraft,
  requestDraftRevision, holdDraft, declineDraft, approveDraft, retryDraft,
  isAssignmentEligibleForDraft, draftCautions, founderDraftView,
  routeDraftToWork, isDraftRoutable,
  draftsInProgress, draftsForFounder, draftStanding, draftAuthorLabel,
  loadDrafts, saveDrafts, upsertDraft,
  type CreativeDraft, type DraftType, type DraftProvider, type DraftContent,
} from './creative-draft.ts';
import {
  // Sprint 13E — Production Readiness Pack (the Head of Production's preparation layer)
  CONTENT_PLATFORMS as PROD_PLATFORMS, PRODUCTION_COMPLEXITIES,
  productionStatusLabel,
  makeProductionReadiness, updateProductionReadiness, isDraftEligibleForProduction,
  addChecklistItem, toggleChecklistItem, checklistProgress,
  markProductionReady, approveProduction, returnProductionForRevision, holdProduction, declineProduction,
  routeProductionToWork, isProductionRoutable, founderProductionView, productionAuthorLabel,
  loadProduction, saveProduction, upsertProduction,
  productionDrafts, productionForReview, approvedProduction, productionStanding as productionPackStanding,
  type ProductionReadiness, type ProductionComplexity,
} from './production-readiness.ts';

/* --- small helpers ------------------------------------------------------- */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Reflect the current mode on <body.hq-page data-hq-mode> so CSS can theme the
    scene. The residence tokens and their time-of-day / seated overrides are all
    scoped to `.hq-page`, so these attributes must live on that element. */
function setMode(mode: 'scene' | 'seated'): void {
  document.body.setAttribute('data-hq-mode', mode);
}

/** Reflect the ambient light state on <body.hq-page data-tod>. Atmosphere only. */
function setTimeOfDay(): void {
  document.body.setAttribute('data-tod', timeOfDay());
}

/* --- the always-present atmosphere layer --------------------------------- */

/**
 * The morning light, the sky beyond the glass, and the soft foliage shadow.
 * Purely decorative and hidden from assistive technology — the room reads
 * completely without it (Build Bible §14: decorative imagery hidden; core usable
 * with scene art missing). It lives behind the app and dims when Seated.
 */
// The Executive Office scene render, as responsive derivatives (AVIF → WebP →
// JPEG). A dedicated portrait crop is art-directed in below 900px; the landscape
// frame is width-responsive above it. Decorative (alt="", aria-hidden), deferred
// (decoding async, low priority), and it never reserves layout — it fills the
// fixed `.hq-atmos__art` box, so a slow or failed load causes no shift and the
// CSS environment simply shows through underneath. Assets: public/headquarters/scene/.
const SCENE = '/headquarters/scene';
const SCENE_PICTURE = `
  <picture>
    <source media="(max-width: 900px)" type="image/avif" srcset="${SCENE}/exec-mobile.avif">
    <source media="(max-width: 900px)" type="image/webp" srcset="${SCENE}/exec-mobile.webp">
    <source media="(max-width: 900px)" srcset="${SCENE}/exec-mobile.jpg">
    <source type="image/avif" srcset="${SCENE}/exec-1024.avif 1024w, ${SCENE}/exec-1400.avif 1400w" sizes="100vw">
    <source type="image/webp" srcset="${SCENE}/exec-1024.webp 1024w, ${SCENE}/exec-1400.webp 1400w" sizes="100vw">
    <img class="hq-atmos__art-img" alt="" aria-hidden="true" loading="lazy" decoding="async" fetchpriority="low"
         src="${SCENE}/exec-1400.jpg"
         srcset="${SCENE}/exec-1024.jpg 1024w, ${SCENE}/exec-1400.jpg 1400w" sizes="100vw">
  </picture>`;

function ensureAtmosphere(): void {
  if (document.querySelector('.hq-atmos')) return;
  const atmos = el('div', { class: 'hq-atmos', 'aria-hidden': 'true' });

  // The scene-artwork layer now carries the approved Executive Office render.
  // `data-hq-art` on <body> gates the artwork treatment (tint + text legibility):
  //   'on'     → the image decoded successfully; the room is the photograph.
  //   'failed' → the image errored; stay on the CSS environment (graceful).
  // Until either fires, the CSS environment renders — the residence is usable
  // before (and without) the artwork.
  const art = el('div', { class: 'hq-atmos__art' });
  art.innerHTML = SCENE_PICTURE;
  const img = art.querySelector('img');
  if (img) {
    const reveal = () => { document.body.setAttribute('data-hq-art', 'on'); img.classList.add('is-loaded'); };
    if (img.complete && img.naturalWidth > 0) reveal();
    else {
      img.addEventListener('load', reveal, { once: true });
      img.addEventListener('error', () => document.body.setAttribute('data-hq-art', 'failed'), { once: true });
    }
  }

  atmos.append(
    // The CSS-rendered environment (the fallback beneath the artwork).
    el('div', { class: 'hq-atmos__sky' }),
    el('div', { class: 'hq-atmos__sun' }),
    el('div', { class: 'hq-atmos__floor' }),
    el('div', { class: 'hq-atmos__foliage' }),
    // The architectural artwork, then the time-of-day light laid over it.
    art,
    el('div', { class: 'hq-atmos__tint' }),
  );
  document.body.prepend(atmos);
}

/* --- room navigation rail (secondary; available inside every wing) ------- */

/**
 * The direct-navigation rail. Visually secondary, room NAMES (not icons alone),
 * keyboard-reachable — so the founder is one action from the atrium and one
 * action from any other wing, without a corporate sidebar tree (Build Bible §8).
 */
function renderRail(current: RoomId): HTMLElement {
  const list = el('ul', { class: 'hq-rail__list' });
  for (const room of ROOMS) {
    const isHere = room.id === current;
    const link = el(
      'a',
      {
        class: 'hq-rail__link',
        href: room.route,
        'data-status': room.status,
        ...(isHere ? { 'aria-current': 'page' } : {}),
      },
      room.name,
    );
    list.append(el('li', { class: 'hq-rail__item' }, link));
  }
  return el('nav', { class: 'hq-rail', 'aria-label': 'The wings of the residence' }, list);
}

/* --- room views ---------------------------------------------------------- */

/**
 * SCENE — the Executive Office. A bright first-of-summer morning: a warm
 * greeting, the room's emotional intention, and the six wings as thresholds.
 * Desktop reads as a cinematic room; mobile becomes the Indexed Headquarters
 * (same markup — headquarters.css chooses the presentation).
 */
function renderScene(root: HTMLElement): void {
  setMode('scene');
  const tod = timeOfDay();

  const wings = el('ul', { class: 'hq-wings__list' });
  for (const room of ROOMS) {
    const item = el('li', { class: 'hq-wing', 'data-room': room.id, 'data-status': room.status });
    const link = el(
      'a',
      { class: 'hq-wing__link', href: room.route },
      el('span', { class: 'hq-wing__name' }, room.name),
      el('span', { class: 'hq-wing__blurb' }, room.blurb),
    );
    if (room.status === 'reserved') {
      link.append(el('span', { class: 'hq-wing__badge label' }, 'In preparation'));
    } else if (room.kind === 'atrium') {
      link.append(el('span', { class: 'hq-wing__badge label' }, 'You are here'));
    }
    item.append(link);
    wings.append(item);
  }

  // The Daily Briefing — a single quiet plaster-document note, orientation only.
  // Filled asynchronously; the room reads completely before it arrives.
  const briefing = el('aside', { class: 'hq-briefing', 'aria-label': 'Today at the desk', 'aria-busy': 'true' },
    el('p', { class: 'hq-briefing__eyebrow label' }, 'Today'),
    el('p', { class: 'hq-briefing__line' }, 'Reading the desk…'),
  );

  // The executive summary — a few honest counts derived from the Work Queue (13F).
  const execSummary = el('aside', { class: 'hq-execsummary' });

  const scene = el(
    'section',
    { class: 'hq-view hq-view--scene', 'aria-label': 'Executive Office' },
    el(
      'div',
      { class: 'hq-view__inner container' },
      el(
        'div',
        { class: 'hq-hero' },
        el('p', { class: 'hq-eyebrow label' }, `${greeting(tod)} · Executive Office`),
        el('h1', { class: 'hq-title' }, 'The day begins with possibility.'),
        el(
          'p',
          { class: 'hq-lede' },
          'Morning light across the limestone, the terrace open to clean air, the writing table waiting. Every wing of the residence opens from here.',
        ),
        briefing,
        execSummary,
      ),
      el(
        'nav',
        { class: 'hq-wings', 'aria-label': 'The wings of the residence' },
        wings,
      ),
    ),
  );

  root.replaceChildren(scene);
  void mountBriefing(briefing);
  mountExecSummary(execSummary);
}

/** The Executive Office summary — Founder Attention v0 (EOS Milestone 1). The
    Work Queue is classified into the six attention dispositions and read back as
    a calm, salience-ordered line-up: what needs the Founder now, what wants a
    decision or a review, what to be aware of. A projection over the projection —
    no record is owned or edited, and classification lives in executive-attention,
    never here. */
function mountExecSummary(host: HTMLElement): void {
  const queue = loadWorkQueue();
  const lineup = attentionLineup(deriveFounderAttention(queue));
  const s = queueSummary(queue); // reused only for the "recently finished" detail
  const block = el('section', { class: 'hq-execsummary__inner', 'aria-label': 'Founder attention' },
    el('p', { class: 'hq-briefing__eyebrow label' }, 'The House at a glance'));
  if (lineup.length === 0) {
    block.append(el('p', { class: 'hq-briefing__line' }, 'Nothing is asking for your attention. The House is running quietly.'));
  } else {
    const ul = el('ul', { class: 'hq-execsummary__list' });
    for (const l of lineup) ul.append(el('li', { class: 'hq-execsummary__item' },
      el('span', { class: 'hq-execsummary__count' }, String(l.count)), el('span', {}, ` ${l.label}`)));
    block.append(ul);
  }
  if (s.recentlyFinished.length) {
    block.append(el('p', { class: 'hq-execsummary__recent' },
      el('span', { class: 'label' }, 'Recently finished'), ` ${s.recentlyFinished.map((i) => i.title).join(' · ')}`));
  }
  block.append(el('a', { class: 'hq-cos__more', href: '#/chief-of-staff/work-queue' }, 'Open the Work Queue →'));
  host.replaceChildren(block);
}

/**
 * Fill the Daily Briefing from the submissions spine. Restraint by design: one
 * decision-relevant line (what awaits the founder), the oldest waiting item, and
 * one path into the Desk. Honest states — clear / offline / a quiet nudge — never
 * a grid of KPI cards. Reads only; the Desk is where work happens.
 */
async function mountBriefing(host: HTMLElement): Promise<void> {
  const res = await fetchBriefing();
  host.setAttribute('aria-busy', 'false');
  host.replaceChildren();
  host.append(el('p', { class: 'hq-briefing__eyebrow label' }, 'Today'));

  if (!res.ok) {
    host.append(el('p', { class: 'hq-briefing__line hq-briefing__line--quiet' },
      res.offline ? 'The desk is offline — your work is safe; try again shortly.' : 'The briefing is resting.'));
    return;
  }

  const b = res.data;
  const awaiting = b.awaitingReview;
  const headline =
    awaiting === 0 ? 'The desk is clear.'
    : awaiting === 1 ? 'One submission awaits your review.'
    : `${awaiting} submissions await your review.`;
  host.append(el('p', { class: 'hq-briefing__line' }, headline));

  if (b.oldestAwaiting) {
    const o = b.oldestAwaiting;
    const wait = o.waitingDays && o.waitingDays > 0 ? `, ${o.waitingDays} day${o.waitingDays === 1 ? '' : 's'}` : '';
    host.append(el('p', { class: 'hq-briefing__meta' }, `Longest wait: ${o.name}${wait}`));
  } else if (b.open > 0) {
    host.append(el('p', { class: 'hq-briefing__meta' }, `${b.open} in motion · nothing needs a decision right now.`));
  }

  host.append(el('a', { class: 'hq-briefing__enter', href: `${getRoom(HOME_ROOM)!.route}/desk` },
    awaiting > 0 ? 'Go to the Founder’s Desk →' : 'Open the Founder’s Desk →'));
}

/**
 * SEATED — inside a wing. Shell only: a titled work surface with an honest
 * placeholder, the room rail, and a clear way back to the Executive Office.
 * The scene atmosphere dims behind the surface (focused work).
 */
function renderSeated(root: HTMLElement, room: Room): void {
  setMode('seated');

  const surface =
    room.status === 'reserved'
      ? renderEmptyState(room)
      : el(
          'div',
          { class: 'hq-surface', role: 'group', 'aria-label': `${room.name} work surface` },
          el('p', { class: 'hq-surface__note' }, 'The work surface for this wing arrives in a later milestone.'),
        );

  const seated = el(
    'section',
    { class: 'hq-view hq-view--seated', 'aria-label': room.name },
    el(
      'div',
      { class: 'hq-view__inner container' },
      el(
        'div',
        { class: 'hq-seated__bar' },
        el('a', { class: 'hq-back', href: getRoom(HOME_ROOM)!.route }, '← Return to the Executive Office'),
        renderRail(room.id),
      ),
      el(
        'header',
        { class: 'hq-seated__head' },
        el('p', { class: 'hq-eyebrow label' }, room.name),
        el('h1', { class: 'hq-title hq-title--seated' }, room.name),
        el('p', { class: 'hq-lede' }, room.blurb),
      ),
      surface,
    ),
  );

  root.replaceChildren(seated);
}

/** EMPTY — an honest "in preparation" panel for a wing with no system of record yet. */
function renderEmptyState(room: Room): HTMLElement {
  return el(
    'div',
    { class: 'hq-state hq-state--empty', role: 'note' },
    el('p', { class: 'hq-state__title' }, 'In preparation'),
    el(
      'p',
      { class: 'hq-state__lede' },
      `The ${room.name} is reserved. It will open when there is real work for it to hold — the residence does not furnish empty rooms.`,
    ),
  );
}

/* =============================================================================
   OPERATIONS OFFICE — the flow view (Milestone 4).

   Route: #/operations. A DIFFERENT room from the Executive Office: not another
   inbox and not a decision surface, but the room of alignment — "is the House's
   work flowing well, and what is stalling?". One architectural object: an
   operations board on the wall (a calm standup/plans board) showing the pipeline
   of work across stages, the longest wait, an in-motion/resolved summary, and a
   single quiet routing line into the Founder's Desk where decisions are made.

   It reads only the EXISTING Daily Briefing (GET /api/headquarters/briefing) and
   shapes it with the pure `operationsFlow` helper. No submission rows, no detail,
   no correspondence, no decision controls, no writes — those live at the Desk /
   Editorial Office. Operations summarises and escalates; it never re-decides here.
   ============================================================================= */
function renderOperations(root: HTMLElement, room: Room): void {
  setMode('seated');

  // The board arrives asynchronously; the room reads completely before it does.
  const board = el('div', { class: 'hq-board', 'aria-label': 'The flow of the House’s work', 'aria-busy': 'true' },
    el('p', { class: 'hq-state__lede' }, 'Reading the board…'));

  const view = el(
    'section',
    { class: 'hq-view hq-view--seated hq-view--operations', 'aria-label': room.name },
    el(
      'div',
      { class: 'hq-view__inner container' },
      el(
        'div',
        { class: 'hq-seated__bar' },
        el('a', { class: 'hq-back', href: getRoom(HOME_ROOM)!.route }, '← Return to the Executive Office'),
        renderRail(room.id),
      ),
      el(
        'header',
        { class: 'hq-seated__head' },
        el('p', { class: 'hq-eyebrow label' }, room.name),
        el('h1', { class: 'hq-title hq-title--seated' }, room.name),
        el('p', { class: 'hq-lede' }, 'The flow of the House’s work — where it sits, and what is waiting. Decisions are made at the Founder’s Desk; this is the room that keeps them in view.'),
      ),
      board,
    ),
  );

  root.replaceChildren(view);
  void mountOperationsBoard(board);
}

/**
 * Fill the operations board from the submissions spine. Honest states — loading /
 * offline / error / empty — never a fabricated dashboard. On success: the pipeline
 * as ordered lanes with counts, an in-motion/resolved summary, the longest wait,
 * and one routing line to the Desk. Observational only; nothing here is a control.
 */
async function mountOperationsBoard(host: HTMLElement): Promise<void> {
  const res = await fetchBriefing();
  host.setAttribute('aria-busy', 'false');

  if (!res.ok) {
    host.replaceChildren(deskState(
      res.offline ? 'The board is offline' : 'The board couldn’t load',
      res.offline ? 'Your work is safe — try again in a moment.' : res.error,
    ));
    return;
  }

  const flow = operationsFlow(res.data);

  // Nothing has moved through the House yet — stay honestly empty (House P11: no
  // faked activity), not a grid of zeroes.
  if (flow.total === 0) {
    host.replaceChildren(deskState(
      'The board is quiet',
      'No work is in the House yet. As submissions arrive and move, the pipeline will fill in here — you’ll see the flow at a glance.',
    ));
    return;
  }

  host.replaceChildren(operationsBoard(flow));
}

/** The board itself, as furniture: a header summary, the stage lanes, and a foot
    with the longest wait and the single routing line to the Desk. */
function operationsBoard(flow: OperationsFlow): HTMLElement {
  const summary =
    flow.inMotion === 0
      ? 'All at rest — nothing in motion just now.'
      : `${flow.inMotion} in motion · ${flow.resolved} at rest`;

  const head = el('div', { class: 'hq-board__head' },
    el('p', { class: 'hq-board__eyebrow label' }, 'The House today'),
    el('p', { class: 'hq-board__summary' }, summary));

  // The pipeline as an ORDERED list of lanes (flow reads left → right). The lanes
  // are observational — no lane is a button; the only action is the routing line.
  const stages = el('ol', { class: 'hq-board__stages' });
  for (const s of flow.stages) {
    const lane = el('li', {
      class: 'hq-board__stage', 'data-stage': s.id,
      ...(s.id === flow.busiestId && s.count > 0 ? { 'data-busiest': 'true' } : {}),
    },
      el('span', { class: 'hq-board__count' }, String(s.count)),
      el('span', { class: 'hq-board__label' }, s.label),
      el('span', { class: 'hq-board__note' }, s.note),
    );
    stages.append(lane);
  }

  // The foot: the longest wait (the one stall worth naming), then the routing line.
  const foot = el('div', { class: 'hq-board__foot' });
  if (flow.oldest) {
    const days = flow.oldest.waitingDays && flow.oldest.waitingDays > 0
      ? `, ${flow.oldest.waitingDays} day${flow.oldest.waitingDays === 1 ? '' : 's'}` : '';
    foot.append(el('p', { class: 'hq-board__wait' }, `Waiting longest: ${flow.oldest.name}${days}`));
  } else {
    foot.append(el('p', { class: 'hq-board__wait hq-board__wait--calm' }, 'Nothing is waiting on you.'));
  }

  const deskRoute = `${getRoom(HOME_ROOM)!.route}/desk`;
  foot.append(
    flow.awaiting > 0
      ? el('a', { class: 'hq-board__route', href: deskRoute },
          `${flow.awaiting} awaiting a decision → Go to the Founder’s Desk`)
      : el('a', { class: 'hq-board__route hq-board__route--quiet', href: deskRoute },
          'Open the Founder’s Desk →'),
  );

  return el('div', { class: 'hq-board__inner', role: 'group', 'aria-label': 'Operations board' },
    head, stages, foot);
}

/* =============================================================================
   CREATIVE DIRECTOR — the library where the making lives (Milestone 5).

   Route: #/creative. A private editorial LIBRARY — the residence's warmest, most
   interior room — never a design studio, mood board, or dashboard. It expresses
   creative stewardship: the shape of what the House makes, held as a reading room
   rather than a queue.

   Two living objects, both from EXISTING data via the pure `creativeStudio`
   helper: the ONE open manuscript (the piece last in motion, from the briefing's
   `recent`) and the Collection (the made body of work, from published
   submissions). Around them, environmental furniture — a restrained reference
   library and one engraved line — that reads completely before any data arrives.

   Reads only; no decision controls, no writes, no new endpoint. It never routes
   into the Editorial Office: the founder stays inside the residence (per founder
   decision — a graceful in-residence placeholder holds the writing room's future
   seat). The Editorial Office remains the operational review workspace elsewhere.
   ============================================================================= */
function renderCreative(root: HTMLElement, room: Room): void {
  setMode('seated');

  // The two living objects arrive asynchronously; the room reads completely
  // before they do (the reference library and the inscription are furniture).
  const manuscript = el('div', { class: 'hq-manuscript', 'aria-label': 'The open manuscript', 'aria-busy': 'true' },
    el('p', { class: 'hq-manuscript__eyebrow label' }, 'On the table'),
    el('p', { class: 'hq-manuscript__resting' }, 'Turning to the page you left…'));
  const archive = el('div', { class: 'hq-archive', 'aria-label': 'The Archive', 'aria-busy': 'true' },
    el('p', { class: 'hq-archive__eyebrow label' }, 'The Archive'),
    el('p', { class: 'hq-state__lede' }, 'Opening the archive…'));
  // The receiving queue — work routed to the Creative Director (Sprint 12D).
  const intake = el('div', { class: 'hq-creative-intake' });
  // The Assignment Desk — Creative turns approved briefs into assignment packs (13C).
  const assignments = el('div', { class: 'hq-assign' });
  // The Drafting Room — controlled AI-assisted first drafts (Sprint 13D).
  const drafting = el('div', { class: 'hq-draft' });

  const view = el(
    'section',
    { class: 'hq-view hq-view--seated hq-view--creative', 'aria-label': room.name },
    el(
      'div',
      { class: 'hq-view__inner container' },
      el(
        'div',
        { class: 'hq-seated__bar' },
        el('a', { class: 'hq-back', href: getRoom(HOME_ROOM)!.route }, '← Return to the Executive Office'),
        renderRail(room.id),
      ),
      el(
        'header',
        { class: 'hq-seated__head' },
        el('p', { class: 'hq-eyebrow label' }, room.name),
        el('h1', { class: 'hq-title hq-title--seated' }, room.name),
        el('p', { class: 'hq-lede' }, 'A private library where the making lives. The work is alive and waiting — kept warm for whenever you return to it.'),
      ),
      intake,
      assignments,
      drafting,
      el(
        'div',
        { class: 'hq-library' },
        manuscript,
        archive,
        el('div', { class: 'hq-library__lower' }, renderReferenceShelf(), renderInscription()),
      ),
    ),
  );

  root.replaceChildren(view);
  mountCreativeIntake(intake);
  mountAssignmentDesk(assignments);
  mountDraftingRoom(drafting);
  void mountLibrary(manuscript, archive);
}

/* --- THE DRAFTING ROOM — controlled AI-assisted first drafts (Sprint 13D) ---
   Creative turns an APPROVED assignment into reviewable draft content. Draft
   preparation only — nothing publishes, nothing self-approves, the Founder stays
   the editorial authority. Generation runs only on an explicit request, through a
   provider-agnostic boundary; DEV uses a clearly-labelled offline stub, and drafts
   are marked unverified until approved. Repaints in place. */
let draftNotice: string | null = null;

/** The provider for this environment: an offline preview stub in DEV, the server-
    backed endpoint in production (honest "not configured" when no key is set). */
function draftingProvider(): DraftProvider {
  if (import.meta.env.DEV) return deterministicDraftProvider;
  return {
    name: 'server',
    async draft(req) {
      try {
        const r = await fetch('/api/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req) });
        if (!r.ok) { const j = await r.json().catch(() => ({})); return { ok: false, reason: (j.reason as 'not_configured') || 'error' }; }
        const j = await r.json();
        return { ok: true, content: j.content, meta: j.meta };
      } catch { return { ok: false, reason: 'error' }; }
    },
  };
}

function mountDraftingRoom(host: HTMLElement): void {
  const repaint = (): void => mountDraftingRoom(host);
  const provider = draftingProvider();
  const assignments = loadAssignments();
  const drafts = loadDrafts();

  const section = el('section', { class: 'hq-draft__room', 'aria-label': 'Creative drafting room' },
    el('p', { class: 'hq-cos__eyebrow label' }, 'Drafting Room'),
    el('p', { class: 'hq-cos__lead' }, 'Prepare a first draft from an approved assignment — reviewable material for TikTok and Substack. A draft, never the final word.'));

  // Honest provider status.
  const isStub = provider.name === 'stub-preview';
  section.append(el('p', { class: 'hq-draft__provider' },
    isStub
      ? 'Drafting provider: offline preview (stub). Drafts here are templated previews for review — not live AI output.'
      : 'Drafting provider: server-backed. If it is not configured, requests fail honestly and no draft is invented.'));

  const notice = el('p', { class: 'hq-cos__notice', role: 'status', 'aria-live': 'polite' });
  if (draftNotice) { notice.classList.add('is-ok'); notice.append(el('span', { class: 'hq-cos__notice-mark', 'aria-hidden': 'true' }, '✓'), el('span', {}, draftNotice)); }
  section.append(notice);

  // Request a draft from an eligible approved assignment.
  const eligible = assignments.filter(isAssignmentEligibleForDraft);
  if (eligible.length === 0) {
    section.append(el('p', { class: 'hq-cos__quiet' }, 'No approved assignments to draft yet. Approve one on the Assignment Desk first.'));
  } else {
    section.append(draftRequestForm(eligible, provider, repaint));
  }

  // Drafts in progress — generated content, revision, hold, decline.
  const inProgress = draftsInProgress(drafts);
  const block = el('section', { class: 'hq-cos__block' },
    el('div', { class: 'hq-cos__block-head' },
      el('h2', { class: 'hq-cos__block-title' }, 'Drafts in Progress'),
      el('span', { class: 'hq-cos__count', 'aria-label': `${inProgress.length} drafts` }, String(inProgress.length))));
  if (inProgress.length === 0) block.append(el('p', { class: 'hq-cos__quiet' }, 'No drafts in progress.'));
  else { const l = el('div', { class: 'hq-cos__decisions' }); for (const d of inProgress) l.append(draftWorkCard(d, provider, repaint)); block.append(l); }
  section.append(block);
  host.replaceChildren(section);
}

function draftRequestForm(eligible: CreativeAssignment[], provider: DraftProvider, repaint: () => void): HTMLElement {
  const asnSel = el('select', { class: 'hq-cos__select', id: 'draft_from', 'aria-label': 'Approved assignment' }) as HTMLSelectElement;
  for (const a of eligible) asnSel.append(el('option', { value: a.id }, a.title));
  const typeSel = el('select', { class: 'hq-cos__select', id: 'draft_type', 'aria-label': 'Draft type' }) as HTMLSelectElement;
  for (const t of DRAFT_TYPES) typeSel.append(el('option', { value: t.id }, t.label));
  const voiceSel = el('select', { class: 'hq-cos__select', id: 'draft_voice', 'aria-label': 'Voice direction' }) as HTMLSelectElement;
  voiceSel.append(el('option', { value: '' }, 'Voice: default'));
  for (const v of VOICE_DIRECTIONS) voiceSel.append(el('option', { value: v }, v));
  const instr = el('input', { class: 'hq-research__input', id: 'draft_instr', type: 'text', maxlength: '200', placeholder: 'A narrow drafting instruction (optional)' }) as HTMLInputElement;

  const go = el('button', { class: 'hq-cos__response', type: 'button' }, 'Request draft') as HTMLButtonElement;
  go.addEventListener('click', () => {
    const a = eligible.find((x) => x.id === asnSel.value);
    if (!a) return;
    const context = buildDraftContext(a, loadOpportunities().find((o) => o.id === a.originOpportunityId) ?? null, loadIntelligence().find((i) => i.id === a.originIntelId) ?? null);
    const created = makeCreativeDraft({ id: `draft_${Date.now()}`, assignment: a, type: typeSel.value as DraftType, instruction: instr.value, voice: voiceSel.value, context });
    if (!created) return;
    saveDrafts(upsertDraft(loadDrafts(), created));
    // Generate immediately through the provider (explicit, authorised request).
    go.disabled = true; go.textContent = 'Generating…';
    void generateDraft(created, provider).then((done) => {
      saveDrafts(upsertDraft(loadDrafts(), done));
      draftNotice = done.status === 'draft_ready' ? `Draft ready — ${draftTypeLabel(done.type)}.` : `Generation ${done.status === 'generation_failed' ? 'failed' : 'done'}.`;
      repaint();
    });
  });

  return el('div', { class: 'hq-draft__form' },
    el('div', { class: 'hq-research__row' },
      deskField('draft_from', 'Approved assignment', asnSel),
      deskField('draft_type', 'Output type', typeSel),
      deskField('draft_voice', 'Voice', voiceSel)),
    deskField('draft_instr', 'Drafting instruction', instr),
    go);
}

function draftWorkCard(d: CreativeDraft, provider: DraftProvider, repaint: () => void): HTMLElement {
  const persist = (next: CreativeDraft, notice: string): void => { saveDrafts(upsertDraft(loadDrafts(), next)); draftNotice = notice; repaint(); };
  const card = el('article', { class: 'hq-cos__decision' });
  card.append(
    el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__decision-title' }, `${draftTypeLabel(d.type)} — ${d.context.centralIdea || 'draft'}`),
      el('span', { class: 'hq-cos__tag label', 'data-status': d.status === 'generation_failed' ? 'low' : 'open' }, draftStatusLabel(d.status))),
    el('p', { class: 'hq-cos__decision-summary' }, `${d.properties.map((p) => contentPropertyLabel(p as ContentProperty)).join(', ') || 'No property'} · ${draftAuthorLabel(d)}${d.providerMeta ? ` · ${d.providerMeta.provider}/${d.providerMeta.model}` : ''}`),
  );

  if (d.status === 'generation_failed') {
    card.append(el('p', { class: 'hq-cos__quiet' }, `Generation failed (${d.failureReason ?? 'error'}). No draft was invented.`));
    const retry = el('button', { class: 'hq-cos__response', type: 'button' }, 'Retry') as HTMLButtonElement;
    retry.addEventListener('click', () => {
      const req = retryDraft(d); saveDrafts(upsertDraft(loadDrafts(), req));
      retry.disabled = true; retry.textContent = 'Generating…';
      void generateDraft(req, provider).then((done) => persist(done, done.status === 'draft_ready' ? 'Draft ready.' : 'Generation failed again.'));
    });
    card.append(retry);
    return card;
  }

  if (d.content) {
    card.append(draftContentView(d.content));
    // truthfulness cautions — always shown.
    const cautions = draftCautions(d);
    const cl = el('ul', { class: 'hq-draft__cautions' });
    for (const c of cautions) cl.append(el('li', {}, c));
    card.append(el('div', { class: 'hq-cos__field' }, el('p', { class: 'hq-cos__field-label label' }, 'Cautions'), cl));
  }

  // Creative's own review actions before the Founder.
  const group = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': `Draft actions for ${draftTypeLabel(d.type)}` });
  const revId = `drev_${d.id.replace(/[^a-z0-9]/gi, '')}`;
  const rev = el('input', { class: 'hq-cos__note-input', id: revId, type: 'text', maxlength: '200', placeholder: 'One concise revision (optional)' }) as HTMLInputElement;
  const revBtn = el('button', { class: 'hq-cos__response', type: 'button' }, 'Request revision') as HTMLButtonElement;
  revBtn.addEventListener('click', () => {
    const req = requestDraftRevision(d, rev.value); saveDrafts(upsertDraft(loadDrafts(), req));
    revBtn.disabled = true; revBtn.textContent = 'Revising…';
    void generateDraft(req, provider).then((done) => persist(done, 'Revised draft ready.'));
  });
  const hold = el('button', { class: 'hq-cos__withdraw', type: 'button' }, 'Hold') as HTMLButtonElement;
  hold.addEventListener('click', () => persist(holdDraft(d), 'Draft held.'));
  const decline = el('button', { class: 'hq-cos__withdraw', type: 'button' }, 'Decline') as HTMLButtonElement;
  decline.addEventListener('click', () => persist(declineDraft(d), 'Draft declined.'));
  group.append(hold, decline);
  card.append(el('div', { class: 'hq-cos__note-field' }, el('label', { class: 'hq-cos__note-input-label label', for: revId }, 'Revision instruction'), rev, revBtn), group);
  card.append(el('p', { class: 'hq-cos__quiet' }, 'When ready, this draft appears for the Founder in the Chief of Staff’s Opportunities.'));
  return card;
}

/** Render generated draft content readably and copy-friendly. */
function draftContentView(c: DraftContent): HTMLElement {
  const wrap = el('div', { class: 'hq-draft__content' });
  const field = (label: string, value?: string): void => { if (value) wrap.append(cosField(label, value)); };
  const list = (label: string, items?: string[]): void => {
    if (!items || !items.length) return;
    const ul = el('ul', { class: 'hq-cos__tradeoffs' });
    for (const i of items) ul.append(el('li', {}, i));
    wrap.append(el('div', { class: 'hq-cos__field' }, el('p', { class: 'hq-cos__field-label label' }, label), ul));
  };
  list('Hook options', c.hookOptions);
  field('Recommended hook', c.recommendedHook);
  field('First sentence', c.firstSentence);
  list('Outline', c.outline);
  field('Note copy', c.noteCopy);
  field('LIVE title', c.liveTitle);
  field('Primary question', c.primaryQuestion);
  list('Discussion beats', c.discussionBeats);
  list('Engagement prompts', c.engagementPrompts);
  list('Headline options', c.headlineOptions);
  field('Thesis', c.thesis);
  field('Premise', c.premise);
  list('Sections', c.sections);
  field('Reader promise', c.readerPromise);
  list('Talking points', c.talkingPoints);
  field('Closing line', c.closingLine);
  field('CTA', c.cta);
  field('Caption direction', c.captionDirection);
  field('Visual', c.visual);
  field('Substack bridge', c.substackBridge);
  field('Transition', c.transition);
  field('Promotion angle', c.promotionAngle);
  return wrap;
}

/* --- THE ASSIGNMENT DESK — Creative's planning surface (Sprint 13C) ---------
   Turn an approved Content Opportunity brief into a Creative Assignment Pack: the
   hook, the central idea, the format, the cross-property strategy. Planning only —
   no scripts, no publishing. Separate from research intake and the Growth brief
   form; connected by provenance. Repaints in place. */
let assignNotice: string | null = null;

function mountAssignmentDesk(host: HTMLElement): void {
  const repaint = (): void => mountAssignmentDesk(host);
  const opps = loadOpportunities();
  const list = loadAssignments();

  const section = el('section', { class: 'hq-assign__desk', 'aria-label': 'Creative assignment desk' },
    el('p', { class: 'hq-cos__eyebrow label' }, 'Assignment Desk'),
    el('p', { class: 'hq-cos__lead' }, 'Turn an approved opportunity into a creative assignment — the hook, the message, the format, and how it travels across the House.'));

  const notice = el('p', { class: 'hq-cos__notice', role: 'status', 'aria-live': 'polite' });
  if (assignNotice) { notice.classList.add('is-ok'); notice.append(el('span', { class: 'hq-cos__notice-mark', 'aria-hidden': 'true' }, '✓'), el('span', {}, assignNotice)); }
  section.append(notice);

  const eligible = opps.filter(isOpportunityEligibleForAssignment);
  if (eligible.length === 0) {
    section.append(el('p', { class: 'hq-cos__quiet' }, 'No approved opportunity briefs yet. When the Chief of Staff recommends one, it can become an assignment here.'));
  } else {
    const sel = el('select', { class: 'hq-cos__select', id: 'assign_from', 'aria-label': 'Opportunity to develop' }) as HTMLSelectElement;
    for (const o of eligible) sel.append(el('option', { value: o.id }, o.title));
    const start = el('button', { class: 'hq-cos__response', type: 'button' }, 'Create assignment') as HTMLButtonElement;
    start.addEventListener('click', () => {
      const src = eligible.find((o) => o.id === sel.value);
      if (!src) return;
      const a = makeCreativeAssignment({
        id: `asn_${Date.now()}`, originOpportunityId: src.id, originIntelId: src.intelId,
        title: src.title, properties: src.properties, centralIdea: src.summary, targetAudience: src.audience, audienceNeed: src.audienceNeed,
      });
      if (!a) return;
      saveAssignments(upsertAssignment(loadAssignments(), a));
      assignNotice = `Assignment started from “${src.title}”.`;
      repaint();
    });
    section.append(el('div', { class: 'hq-briefs__start' },
      el('label', { class: 'hq-cos__note-input-label label', for: 'assign_from' }, 'Develop an approved opportunity'),
      el('div', { class: 'hq-cos__route-row' }, sel, start)));
  }

  const drafts = draftAssignments(list);
  const draftBlock = el('section', { class: 'hq-cos__block' },
    el('div', { class: 'hq-cos__block-head' },
      el('h2', { class: 'hq-cos__block-title' }, 'In Development'),
      el('span', { class: 'hq-cos__count', 'aria-label': `${drafts.length} in development` }, String(drafts.length))));
  if (drafts.length === 0) draftBlock.append(el('p', { class: 'hq-cos__quiet' }, 'No assignments in development.'));
  else { const l = el('div', { class: 'hq-cos__decisions' }); for (const a of drafts) l.append(assignmentEditorCard(a, repaint)); draftBlock.append(l); }
  section.append(draftBlock);

  const others = list.filter((a) => !['draft', 'in_development', 'returned_for_revision'].includes(a.status))
    .sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
  if (others.length) {
    const log = el('section', { class: 'hq-cos__block' },
      el('div', { class: 'hq-cos__block-head' },
        el('h2', { class: 'hq-cos__block-title' }, 'Submitted Assignments'),
        el('span', { class: 'hq-cos__count', 'aria-label': `${others.length} submitted` }, String(others.length))));
    const l = el('div', { class: 'hq-cos__decisions' });
    for (const a of others.slice(0, 10)) l.append(assignmentSummaryCard(a));
    log.append(l); section.append(log);
  }
  host.replaceChildren(section);
}

function platformSelect(id: string, value: ContentPlatform | '', allowNone: boolean): HTMLSelectElement {
  const s = el('select', { class: 'hq-cos__select', id }) as HTMLSelectElement;
  if (allowNone) s.append(el('option', { value: '', ...(value === '' ? { selected: 'selected' } : {}) }, 'None'));
  for (const p of CONTENT_PLATFORMS) s.append(el('option', { value: p.id, ...(p.id === value ? { selected: 'selected' } : {}) }, p.label));
  return s;
}

function assignmentEditorCard(a: CreativeAssignment, repaint: () => void): HTMLElement {
  let draft = a;
  const card = el('article', { class: 'hq-cos__decision hq-assign__editor' });
  const persist = (next: CreativeAssignment, notice: string): void => {
    saveAssignments(upsertAssignment(loadAssignments(), next)); assignNotice = notice; repaint();
  };
  const input = (id: string, val: string, ph: string): HTMLInputElement =>
    el('input', { class: 'hq-research__input', id, type: 'text', maxlength: '200', value: val, placeholder: ph }) as HTMLInputElement;
  const textarea = (id: string, val: string, ph: string): HTMLTextAreaElement => {
    const t = el('textarea', { class: 'hq-research__textarea', id, rows: '2', maxlength: '500', placeholder: ph }) as HTMLTextAreaElement;
    t.value = val; return t;
  };

  const title = input(`at_${a.id}`, a.title, 'Assignment title');
  const hook = input(`ah_${a.id}`, a.hook, 'The opening hook');
  const first = input(`af_${a.id}`, a.firstSentence, 'The first sentence');
  const central = textarea(`ac_${a.id}`, a.centralIdea, 'The central idea');
  const points = textarea(`ap_${a.id}`, a.talkingPoints.join('\n'), 'Talking points — one per line (3–5)');
  const tone = input(`ao_${a.id}`, a.tone, 'Emotional tone');
  const voice = input(`av_${a.id}`, a.voiceGuidance, 'Voice guidance');
  const cta = input(`acta_${a.id}`, a.callToAction, 'Call to action');
  const primary = platformSelect(`apl_${a.id}`, a.primaryPlatform, false);
  const secondary = platformSelect(`asl_${a.id}`, a.secondaryPlatform, true);
  const tkFormat = el('select', { class: 'hq-cos__select', id: `atf_${a.id}` }) as HTMLSelectElement;
  tkFormat.append(el('option', { value: '', ...(a.tiktokFormat === '' ? { selected: 'selected' } : {}) }, 'Not set'));
  for (const f of TIKTOK_FORMATS) tkFormat.append(el('option', { value: f.id, ...(f.id === a.tiktokFormat ? { selected: 'selected' } : {}) }, f.label));
  const ssKind = el('select', { class: 'hq-cos__select', id: `ask_${a.id}` }) as HTMLSelectElement;
  for (const k of SUBSTACK_KINDS) ssKind.append(el('option', { value: k.id, ...(k.id === a.substackKind ? { selected: 'selected' } : {}) }, k.label));
  const ssConn = input(`asc_${a.id}`, a.substackConnection, 'How it connects to Substack');
  const tkConn = input(`atc_${a.id}`, a.tiktokConnection, 'How it connects to TikTok / Founder platform');

  card.append(
    el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__decision-title' }, `Assignment — ${a.title}`),
      el('span', { class: 'hq-cos__tag label', 'data-status': a.status }, assignmentStatusLabel(a.status))),
  );
  if (a.revisionNote) card.append(cosField('Revision requested', a.revisionNote));
  card.append(
    deskField(title.id, 'Title', title),
    briefFieldLabel('Properties'),
    chipSet<ContentProperty>('AssignProps', CONTENT_PROPERTIES, draft.properties, (next) => { draft = { ...draft, properties: next }; }),
    el('div', { class: 'hq-research__row' },
      deskField(primary.id, 'Primary platform', primary),
      deskField(secondary.id, 'Secondary platform', secondary),
      deskField(tkFormat.id, 'TikTok format', tkFormat)),
    deskField(hook.id, 'Hook', hook),
    deskField(first.id, 'First sentence', first),
    deskField(central.id, 'Central idea', central),
    deskField(points.id, 'Talking points', points),
    el('div', { class: 'hq-research__row' },
      deskField(tone.id, 'Tone', tone),
      deskField(voice.id, 'Voice', voice),
      deskField(cta.id, 'Call to action', cta)),
    briefFieldLabel('Substack'),
    el('div', { class: 'hq-research__row' },
      deskField(ssKind.id, 'Substack', ssKind),
      deskField(ssConn.id, 'Substack connection', ssConn),
      deskField(tkConn.id, 'TikTok connection', tkConn)),
  );

  const collect = (): CreativeAssignment => updateAssignment(draft, {
    title: title.value, hook: hook.value, firstSentence: first.value, centralIdea: central.value,
    talkingPoints: points.value.split('\n').map((p) => p.trim()).filter(Boolean),
    tone: tone.value, voiceGuidance: voice.value, callToAction: cta.value,
    primaryPlatform: (primary.value || undefined) as ContentPlatform | undefined,
    secondaryPlatform: (secondary.value || undefined) as ContentPlatform | undefined,
    tiktokFormat: (tkFormat.value || undefined) as TikTokFormat | undefined,
    substackKind: ssKind.value as SubstackKind,
    substackConnection: ssConn.value, tiktokConnection: tkConn.value,
    properties: draft.properties,
  });

  const group = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': `Actions for assignment “${a.title}”` });
  const save = el('button', { class: 'hq-cos__response', type: 'button' }, 'Save draft') as HTMLButtonElement;
  save.addEventListener('click', () => persist(collect(), 'Draft saved.'));
  const ready = el('button', { class: 'hq-cos__response', type: 'button' }, 'Mark ready for review') as HTMLButtonElement;
  ready.addEventListener('click', () => persist(markAssignmentReady(collect()), 'Sent to the Chief of Staff for review.'));
  group.append(save, ready);
  card.append(group);
  return card;
}

function assignmentSummaryCard(a: CreativeAssignment): HTMLElement {
  return el('article', { class: 'hq-cos__decision' },
    el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__decision-title' }, a.title),
      el('span', { class: 'hq-cos__tag label', 'data-status': a.status }, assignmentStatusLabel(a.status))),
    el('p', { class: 'hq-cos__decision-summary' },
      `${assignmentPropertyLabel(a)} · ${contentPlatformLabel(a.primaryPlatform)}${a.hook ? ` · “${a.hook}”` : ''}`));
}

/* --- The Creative Director's receiving queue (Sprint 12D) ------------------
   Work routed here by the Chief of Staff — ONLY items owned by Chair #002. The
   Creative Director acts on the same shared record; a clarification returns to
   the Chief of Staff, never to the Founder. Renders synchronously from the
   client store and repaints itself in place. */
function mountCreativeIntake(host: HTMLElement): void {
  const repaint = (): void => mountCreativeIntake(host);
  const queue = creativeQueue(loadRecommendations());

  const section = el('section', { class: 'hq-cos__section', 'aria-label': 'Work from the Chief of Staff' },
    el('p', { class: 'hq-cos__eyebrow label' }, 'From the Chief of Staff'),
    el('p', { class: 'hq-cos__lead' }, 'Work routed to the Creative Director. Everything here arrives through the Chief of Staff — the making is yours.'));

  if (queue.length === 0) {
    section.append(el('p', { class: 'hq-cos__quiet' },
      'Nothing has been routed to you yet. When the Chief of Staff sends creative work, it appears here.'));
  } else {
    const list = el('div', { class: 'hq-cos__decisions' });
    for (const r of queue) list.append(cosCreativeCard(r, repaint));
    section.append(list);
  }
  host.replaceChildren(section);
}

function cosCreativeCard(r: Recommendation, repaint: () => void): HTMLElement {
  const persist = (next: Recommendation): void => {
    saveRecommendations(upsertRecommendation(loadRecommendations(), next));
    repaint();
  };
  const card = el('article', { class: 'hq-cos__decision' });
  card.append(
    el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__decision-title' }, r.title),
      el('span', { class: 'hq-cos__tag label', 'data-status': r.priority }, priorityLabel(r.priority))),
    el('p', { class: 'hq-cos__decision-summary' },
      `${recTypeLabel(r)} · ${recStatusLabel(r.status)} · ${creativeStageLabel(r.creativeStage)} · ${visibilityLabel(r.visibility)}`),
    el('p', { class: 'hq-cos__decision-summary' },
      `Recorded ${formatWhen(r.createdAt)}${r.preparation ? ` · prepared ${formatWhen(r.preparation.preparedAt)}` : ''}`),
  );
  if (r.summary) card.append(el('p', { class: 'hq-cos__field-body' }, r.summary));
  if (r.preparation?.recommendation) card.append(cosField('Chief of Staff’s note', r.preparation.recommendation));
  if (r.creativeStage === 'clarification' && r.creativeNote) {
    card.append(cosField('Clarification requested (with the Chief of Staff)', r.creativeNote));
  }

  // Creative review actions — contextual to the stage.
  const group = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': `Creative review of “${r.title}”` });
  const act = (label: string, fn: () => Recommendation): void => {
    const b = el('button', { class: 'hq-cos__response', type: 'button' }, label) as HTMLButtonElement;
    b.addEventListener('click', () => persist(fn()));
    group.append(b);
  };
  if (r.creativeStage === null) act('Accept Work', () => creativeAccept(r));
  if (r.creativeStage === 'accepted' || r.creativeStage === 'clarification') act('Mark In Progress', () => creativeStart(r));
  if (r.creativeStage === 'accepted' || r.creativeStage === 'in_progress') act('Mark Creative Review Complete', () => creativeComplete(r));
  group.append((() => {
    const b = el('button', { class: 'hq-cos__response', type: 'button' }, 'Return to Chief of Staff') as HTMLButtonElement;
    b.addEventListener('click', () => persist(creativeReturn(r)));
    return b;
  })());
  card.append(group);

  // Request Founder clarification — routed BACK through the Chief of Staff.
  const noteId = `cnote_${r.id.replace(/[^a-z0-9]/gi, '')}`;
  const note = el('input', {
    class: 'hq-cos__note-input', id: noteId, type: 'text', maxlength: '200',
    placeholder: 'What needs clarifying?',
    ...(r.creativeNote ? { value: r.creativeNote } : {}),
  }) as HTMLInputElement;
  const clarify = el('button', { class: 'hq-cos__withdraw', type: 'button' },
    'Request Founder clarification (via Chief of Staff)') as HTMLButtonElement;
  clarify.addEventListener('click', () => persist(creativeRequestClarification(r, note.value)));
  card.append(el('div', { class: 'hq-cos__note-field' },
    el('label', { class: 'hq-cos__note-input-label label', for: noteId }, 'Clarification note'), note, clarify));

  return card;
}

/**
 * Fill the two living objects from the existing spine. The manuscript reads the
 * Daily Briefing; the Collection reads the published works. Honest states — the
 * table resting, the shelf waiting, offline — never fabricated pages. Each object
 * degrades on its own, so an offline shelf never blanks the open manuscript.
 */
async function mountLibrary(manuscriptHost: HTMLElement, archiveHost: HTMLElement): Promise<void> {
  const [bRes, pRes] = await Promise.all([fetchBriefing(), fetchInbox('published')]);

  // --- The open manuscript (from the briefing) ---
  manuscriptHost.setAttribute('aria-busy', 'false');
  if (!bRes.ok) {
    manuscriptHost.replaceChildren(deskState(
      bRes.offline ? 'The reading light is off' : 'The page couldn’t be found',
      bRes.offline ? 'Your work is safe — try again in a moment.' : bRes.error,
    ));
  } else {
    const { manuscript } = creativeStudio(bRes.data, null);
    manuscriptHost.replaceChildren(...manuscriptContent(manuscript));
  }

  // --- The Archive (from the published works) ---
  archiveHost.setAttribute('aria-busy', 'false');
  if (!pRes.ok) {
    archiveHost.replaceChildren(deskState(
      pRes.offline ? 'The Archive is offline' : 'The Archive couldn’t load',
      pRes.offline ? 'Your work is safe — try again in a moment.' : pRes.error,
    ));
  } else {
    mountArchive(archiveHost, pRes.data.submissions);
  }
}

/* --- The Archive: a searchable, filterable, hierarchical library ------------
   Replaces the bookshelf. A large search field, honest facet filters, a
   breadcrumb, and native <details> accordions (multiple open at once, touch- and
   keyboard-friendly). Larger typography; reads the same published works. */
function mountArchive(host: HTMLElement, published: import('./adapters.ts').Submission[]): void {
  let query = '';
  let filter: string | null = null;
  const filters = archiveFilters(published);

  const search = el('input', {
    class: 'hq-archive__search', type: 'search', enterkeyhint: 'search',
    'aria-label': 'Search the archive', placeholder: 'Search the archive…', autocomplete: 'off',
  }) as HTMLInputElement;

  const chips = el('div', { class: 'hq-archive__filters', role: 'group', 'aria-label': 'Filter the archive' });
  const results = el('div', { class: 'hq-archive__results', 'aria-live': 'polite' });

  const renderChips = (): void => {
    chips.replaceChildren();
    const all = el('button', { class: 'hq-chip hq-archive__chip', type: 'button',
      'aria-pressed': filter === null ? 'true' : 'false' }, 'All');
    all.addEventListener('click', () => { filter = null; draw(); });
    chips.append(all);
    for (const f of filters) {
      const c = el('button', { class: 'hq-chip hq-archive__chip', type: 'button',
        'aria-pressed': filter === f ? 'true' : 'false' }, f);
      c.addEventListener('click', () => { filter = filter === f ? null : f; draw(); });
      chips.append(c);
    }
  };

  const draw = (): void => {
    const tree = archiveTree(published, query, filter);
    renderChips();

    // Breadcrumb — Archive › [filter] › “query”
    const crumbs: string[] = ['Archive'];
    if (filter) crumbs.push(filter);
    if (query.trim()) crumbs.push(`“${query.trim()}”`);
    const crumb = el('p', { class: 'hq-archive__crumb' }, crumbs.join('  ›  '));
    const count = el('p', { class: 'hq-archive__count' },
      tree.total === tree.grandTotal
        ? `${tree.grandTotal} work${tree.grandTotal === 1 ? '' : 's'}`
        : `${tree.total} of ${tree.grandTotal}`);

    results.replaceChildren(crumb, count);

    if (tree.grandTotal === 0) {
      results.append(el('p', { class: 'hq-archive__empty' },
        'The archive is waiting for its first bound work. As the House publishes, the shelves fill here.'));
      return;
    }
    if (tree.total === 0) {
      results.append(el('p', { class: 'hq-archive__empty' }, 'Nothing in the archive matches yet — try another word.'));
      return;
    }

    for (const cat of tree.categories) {
      const catBox = el('details', { class: 'hq-archive__cat', open: 'true' });
      catBox.append(el('summary', { class: 'hq-archive__cat-sum' },
        el('span', { class: 'hq-archive__cat-name' }, cat.label),
        el('span', { class: 'hq-archive__cat-n' }, String(cat.total))));
      for (const g of cat.groups) {
        const grp = el('details', { class: 'hq-archive__grp', open: 'true' });
        grp.append(el('summary', { class: 'hq-archive__grp-sum' },
          el('span', { class: 'hq-archive__grp-name' }, g.label),
          el('span', { class: 'hq-archive__grp-n' }, String(g.total))));
        const list = el('ul', { class: 'hq-archive__entries' });
        for (const e of g.entries) {
          const item = el('li', { class: 'hq-archive__entry' },
            el('p', { class: 'hq-archive__entry-title' }, e.name));
          if (e.summary) item.append(el('p', { class: 'hq-archive__entry-desc' }, e.summary));
          list.append(item);
        }
        grp.append(list);
        catBox.append(grp);
      }
      results.append(catBox);
    }
  };

  let t = 0;
  search.addEventListener('input', () => {
    query = search.value;
    window.clearTimeout(t);
    t = window.setTimeout(draw, 120);
  });

  host.replaceChildren(
    el('div', { class: 'hq-archive__head' },
      el('p', { class: 'hq-archive__eyebrow label' }, 'The Archive'),
      el('div', { class: 'hq-archive__searchwrap' },
        el('span', { class: 'hq-archive__search-ico', 'aria-hidden': 'true' }, '⌕'),
        search)),
    chips,
    results,
  );
  draw();
}

/** The open manuscript — one piece, lying open as though the founder just stepped
    away. Read-only; it never leaves the residence. When nothing is in motion, the
    table rests, honestly and still warm. */
function manuscriptContent(m: OpenManuscript | null): Node[] {
  if (!m) {
    return [
      el('p', { class: 'hq-manuscript__eyebrow label' }, 'The table'),
      el('p', { class: 'hq-manuscript__resting' },
        'No page lies open just now. The table is clear, the reading light still warm — begin whenever you like.'),
    ];
  }
  const nodes: Node[] = [
    el('p', { class: 'hq-manuscript__eyebrow label' }, 'Left open'),
    el('h2', { class: 'hq-manuscript__title' }, m.name),
  ];
  if (m.summary) nodes.push(el('p', { class: 'hq-manuscript__summary' }, m.summary));
  // A graceful in-residence placeholder: the residence holds the page. It never
  // routes out to the Editorial Office — the founder stays home. When a writing
  // room is built inside Headquarters, this line becomes its threshold.
  nodes.push(el('p', { class: 'hq-manuscript__hold' },
    'The page waits on the table, kept exactly as you left it. The writing room opens here soon.'));
  return nodes;
}

/** The reference library — a restrained run of bound volumes as ARCHITECTURE, not
    interface. Decorative furniture (like the scene's plants), so it is hidden from
    assistive technology and carries no controls. */
function renderReferenceShelf(): HTMLElement {
  const shelf = el('aside', { class: 'hq-reference', 'aria-hidden': 'true' });
  const row = el('ul', { class: 'hq-reference__row' });
  for (const v of REFERENCE_VOLUMES) {
    row.append(el('li', { class: 'hq-reference__vol', 'data-kind': v.kind },
      el('span', { class: 'hq-reference__spine' }, v.title)));
  }
  shelf.append(row, el('span', { class: 'hq-reference__ledge' }));
  return shelf;
}

/** The direction plate — one line engraved into the oak, discovered rather than
    announced. Given a role so it is read as the room's quiet inscription. */
function renderInscription(): HTMLElement {
  return el('p', { class: 'hq-inscription', role: 'note', 'aria-label': 'Engraved above the shelves' },
    DIRECTION_INSCRIPTION);
}

/* =============================================================================
   PRODUCTION SUITE — a glass studio for momentum without noise (Milestone 6).

   Route: #/production. The residence's most open, light-filled room, built around
   ONE architectural object: the Narration Desk — a floating oak desk with quietly
   alive displays, headphones, a tablet stand, and the warm brass recording lamp
   that stays quiet and ready and never simulates recording. Everything else
   supports it: a glass review room (environmental) and a vellum studio sprint
   (In Production · Preparing · Recently Finished) over the finishing tail of the
   existing spine. Reads only; no capture, no editing, no decision controls, and
   no doorway out — the founder stays inside the residence.
   ============================================================================= */
function renderProduction(root: HTMLElement, room: Room): void {
  setMode('seated');

  // The sprint arrives asynchronously; the room reads completely before it (the
  // Narration Desk and review room are furniture, present from the first frame).
  const sprint = el('section', { class: 'hq-sprint', 'aria-label': 'In the studio', 'aria-busy': 'true' },
    el('p', { class: 'hq-sprint__eyebrow label' }, 'In the studio'),
    el('p', { class: 'hq-state__lede' }, 'Looking in on the studio…'));
  // The receiving queue — work routed to the Head of Production (Sprint 12E).
  const intake = el('div', { class: 'hq-production-intake' });
  // The Production Readiness surface — prepare approved drafts for recording (13E).
  const readiness = el('div', { class: 'hq-prod' });

  const view = el(
    'section',
    { class: 'hq-view hq-view--seated hq-view--production', 'aria-label': room.name },
    el(
      'div',
      { class: 'hq-view__inner container' },
      el(
        'div',
        { class: 'hq-seated__bar' },
        el('a', { class: 'hq-back', href: getRoom(HOME_ROOM)!.route }, '← Return to the Executive Office'),
        renderRail(room.id),
      ),
      el(
        'header',
        { class: 'hq-seated__head' },
        el('p', { class: 'hq-eyebrow label' }, room.name),
        el('h1', { class: 'hq-title hq-title--seated' }, room.name),
        el('p', { class: 'hq-lede' }, 'A glass studio for momentum without noise. Capable, and in motion — where cleared work is narrated, shaped, and finished.'),
      ),
      intake,
      readiness,
      el(
        'div',
        { class: 'hq-studio' },
        buildNarrationDesk(),
        el('div', { class: 'hq-studio__lower' }, sprint, buildReviewRoom()),
      ),
    ),
  );

  root.replaceChildren(view);
  mountProductionReadiness(readiness);
  mountProductionIntake(intake);
  void mountSprint(sprint);
}

/* --- PRODUCTION READINESS — the Head of Production's preparation surface (13E)
   Approved Creative Drafts become practical production packs here: runtime,
   framing, visual direction, audio, a recording checklist, and required assets.
   Preparation only — nothing records, publishes, or schedules. Repaints in place.
   Additive to the Production Suite; existing controls are untouched. */
let prodNotice: string | null = null;

function mountProductionReadiness(host: HTMLElement): void {
  const repaint = (): void => mountProductionReadiness(host);
  const drafts = loadDrafts();
  const packs = loadProduction();

  const section = el('section', { class: 'hq-prod__ready', 'aria-label': 'Production readiness' },
    el('p', { class: 'hq-cos__eyebrow label' }, 'Production Readiness'),
    el('p', { class: 'hq-cos__lead' }, 'Prepare an approved draft for recording — the setup, the framing, the checklist. Preparation, not recording.'));

  const notice = el('p', { class: 'hq-cos__notice', role: 'status', 'aria-live': 'polite' });
  if (prodNotice) { notice.classList.add('is-ok'); notice.append(el('span', { class: 'hq-cos__notice-mark', 'aria-hidden': 'true' }, '✓'), el('span', {}, prodNotice)); }
  section.append(notice);

  const eligible = drafts.filter(isDraftEligibleForProduction);
  if (eligible.length === 0) {
    section.append(el('p', { class: 'hq-cos__quiet' }, 'No approved drafts to prepare yet. Approve a draft in the Drafting Room first.'));
  } else {
    const sel = el('select', { class: 'hq-cos__select', id: 'prod_from', 'aria-label': 'Approved draft' }) as HTMLSelectElement;
    for (const d of eligible) sel.append(el('option', { value: d.id }, `${draftTypeLabel(d.type)} — ${d.context.centralIdea || 'draft'}`));
    const start = el('button', { class: 'hq-cos__response', type: 'button' }, 'Create readiness pack') as HTMLButtonElement;
    start.addEventListener('click', () => {
      const d = eligible.find((x) => x.id === sel.value);
      if (!d) return;
      const p = makeProductionReadiness({ id: `prod_${Date.now()}`, draft: d });
      if (!p) return;
      saveProduction(upsertProduction(loadProduction(), p));
      prodNotice = 'Readiness pack started.'; repaint();
    });
    section.append(el('div', { class: 'hq-briefs__start' },
      el('label', { class: 'hq-cos__note-input-label label', for: 'prod_from' }, 'Prepare an approved draft'),
      el('div', { class: 'hq-cos__route-row' }, sel, start)));
  }

  const inProgress = productionDrafts(packs);
  const block = el('section', { class: 'hq-cos__block' },
    el('div', { class: 'hq-cos__block-head' },
      el('h2', { class: 'hq-cos__block-title' }, 'Packs in Preparation'),
      el('span', { class: 'hq-cos__count', 'aria-label': `${inProgress.length} in preparation` }, String(inProgress.length))));
  if (inProgress.length === 0) block.append(el('p', { class: 'hq-cos__quiet' }, 'No packs in preparation.'));
  else { const l = el('div', { class: 'hq-cos__decisions' }); for (const p of inProgress) l.append(productionEditorCard(p, repaint)); block.append(l); }
  section.append(block);
  host.replaceChildren(section);
}

function prodInput(id: string, val: string, ph: string): HTMLInputElement {
  return el('input', { class: 'hq-research__input', id, type: 'text', maxlength: '200', value: val, placeholder: ph }) as HTMLInputElement;
}

function productionEditorCard(p: ProductionReadiness, repaint: () => void): HTMLElement {
  let draft = p;
  const card = el('article', { class: 'hq-cos__decision hq-prod__editor' });
  const persist = (next: ProductionReadiness, notice: string): void => { saveProduction(upsertProduction(loadProduction(), next)); prodNotice = notice; repaint(); };

  const title = prodInput(`pt_${p.id}`, p.title, 'Production title');
  const duration = prodInput(`pd_${p.id}`, p.estimatedDuration, 'e.g. 45–60s');
  const format = prodInput(`pf_${p.id}`, p.contentFormat, 'Recording format');
  const env = prodInput(`pe_${p.id}`, p.recordingEnvironment, 'Recording environment');
  const visual = prodInput(`pv_${p.id}`, p.visualDirection, 'Visual direction / opening shot');
  const camera = prodInput(`pc_${p.id}`, p.cameraRecommendation, 'Camera framing');
  const audio = prodInput(`pa_${p.id}`, p.audioNotes, 'Audio notes');
  const cta = prodInput(`pcta_${p.id}`, p.ctaPlacement, 'CTA timing / placement');
  const caption = prodInput(`pcap_${p.id}`, p.captionNotes, 'Caption notes');
  const cautions = prodInput(`pca_${p.id}`, p.cautions, 'Production cautions');
  const platform = el('select', { class: 'hq-cos__select', id: `ppl_${p.id}` }) as HTMLSelectElement;
  for (const pl of PROD_PLATFORMS) platform.append(el('option', { value: pl.id, ...(pl.id === p.primaryPlatform ? { selected: 'selected' } : {}) }, pl.label));
  const readySel = el('select', { class: 'hq-cos__select', id: `prd_${p.id}` }) as HTMLSelectElement;
  for (const c of PRODUCTION_COMPLEXITIES) readySel.append(el('option', { value: c.id, ...(c.id === p.readiness ? { selected: 'selected' } : {}) }, c.label));

  card.append(
    el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__decision-title' }, `Pack — ${p.title}`),
      el('span', { class: 'hq-cos__tag label', 'data-status': p.status }, productionStatusLabel(p.status))),
  );
  if (p.revisionNote) card.append(cosField('Revision requested', p.revisionNote));
  card.append(
    deskField(title.id, 'Title', title),
    el('div', { class: 'hq-research__row' },
      deskField(platform.id, 'Primary platform', platform),
      deskField(format.id, 'Format', format),
      deskField(duration.id, 'Estimated duration', duration)),
    el('div', { class: 'hq-research__row' },
      deskField(env.id, 'Recording environment', env),
      deskField(camera.id, 'Camera framing', camera),
      deskField(readySel.id, 'Readiness', readySel)),
    deskField(visual.id, 'Visual direction', visual),
    el('div', { class: 'hq-research__row' },
      deskField(audio.id, 'Audio notes', audio),
      deskField(cta.id, 'CTA placement', cta),
      deskField(caption.id, 'Caption notes', caption)),
    deskField(cautions.id, 'Production cautions', cautions),
  );

  // The production checklist and the asset checklist — tickable, addable.
  card.append(checklistView(draft, 'checklist', 'Recording checklist', persist));
  card.append(checklistView(draft, 'requiredAssets', 'Required assets', persist));
  const prog = Math.round(checklistProgress(draft) * 100);
  card.append(el('p', { class: 'hq-cos__quiet' }, `Checklist ${prog}% complete.`));

  const collect = (): ProductionReadiness => updateProductionReadiness(draft, {
    title: title.value, estimatedDuration: duration.value, contentFormat: format.value,
    recordingEnvironment: env.value, visualDirection: visual.value, cameraRecommendation: camera.value,
    audioNotes: audio.value, ctaPlacement: cta.value, captionNotes: caption.value, cautions: cautions.value,
    primaryPlatform: platform.value as ProductionReadiness['primaryPlatform'] || undefined,
    readiness: readySel.value as ProductionComplexity,
  });

  const group = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': `Actions for pack “${p.title}”` });
  const save = el('button', { class: 'hq-cos__response', type: 'button' }, 'Save draft') as HTMLButtonElement;
  save.addEventListener('click', () => persist(collect(), 'Pack saved.'));
  const ready = el('button', { class: 'hq-cos__response', type: 'button' }, 'Ready for Founder review') as HTMLButtonElement;
  ready.addEventListener('click', () => persist(markProductionReady(collect()), 'Sent to the Chief of Staff for review.'));
  group.append(save, ready);
  card.append(group);
  return card;
}

function checklistView(p: ProductionReadiness, which: 'checklist' | 'requiredAssets', label: string, persist: (n: ProductionReadiness, notice: string) => void): HTMLElement {
  const wrap = el('div', { class: 'hq-cos__field' }, el('p', { class: 'hq-cos__field-label label' }, label));
  const items = p[which];
  const ul = el('ul', { class: 'hq-prod__checklist' });
  for (const it of items) {
    const cbId = `${which}_${it.id}`;
    const cb = el('input', { class: 'hq-briefs__chip-input', type: 'checkbox', id: cbId, ...(it.done ? { checked: 'checked' } : {}) }) as HTMLInputElement;
    cb.addEventListener('change', () => persist(toggleChecklistItem(p, which, it.id), 'Checklist updated.'));
    ul.append(el('li', { class: 'hq-prod__check' }, el('label', { class: 'hq-prod__check-label', for: cbId }, cb, el('span', {}, it.label))));
  }
  wrap.append(ul);
  const addId = `add_${which}_${p.id}`;
  const add = el('input', { class: 'hq-cos__note-input', id: addId, type: 'text', maxlength: '120', placeholder: which === 'requiredAssets' ? 'Add an asset…' : 'Add a checklist item…' }) as HTMLInputElement;
  const addBtn = el('button', { class: 'hq-cos__withdraw', type: 'button' }, 'Add') as HTMLButtonElement;
  addBtn.addEventListener('click', () => { if (add.value.trim()) persist(addChecklistItem(p, which, add.value), `${label} updated.`); });
  wrap.append(el('div', { class: 'hq-cos__note-field' }, el('label', { class: 'hq-cos__note-input-label label', for: addId }, `Add to ${label.toLowerCase()}`), add, addBtn));
  return wrap;
}

/* --- The Head of Production's receiving queue (Sprint 12E) -----------------
   Work routed here by the Chief of Staff — ONLY items owned by Chair #003.
   Production takes up only eligible work (approved/decided or validly routed for
   execution); a clarification returns to the Chief of Staff, never the Founder.
   Renders synchronously from the client store and repaints itself in place. */
function mountProductionIntake(host: HTMLElement): void {
  const repaint = (): void => mountProductionIntake(host);
  const queue = productionQueue(loadRecommendations());

  const section = el('section', { class: 'hq-cos__section', 'aria-label': 'Work from the Chief of Staff' },
    el('p', { class: 'hq-cos__eyebrow label' }, 'From the Chief of Staff'),
    el('p', { class: 'hq-cos__lead' }, 'Work routed to the Head of Production. Everything here arrives through the Chief of Staff — the delivery is yours to carry.'));

  if (queue.length === 0) {
    section.append(el('p', { class: 'hq-cos__quiet' },
      'Nothing has been routed to you yet. When the Chief of Staff sends approved work, it appears here.'));
  } else {
    const list = el('div', { class: 'hq-cos__decisions' });
    for (const r of queue) list.append(cosProductionCard(r, repaint));
    section.append(list);
  }
  host.replaceChildren(section);
}

function cosProductionCard(r: Recommendation, repaint: () => void): HTMLElement {
  const persist = (next: Recommendation): void => {
    saveRecommendations(upsertRecommendation(loadRecommendations(), next));
    repaint();
  };
  const card = el('article', { class: 'hq-cos__decision' });
  card.append(
    el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__decision-title' }, r.title),
      el('span', { class: 'hq-cos__tag label', 'data-status': r.priority }, priorityLabel(r.priority))),
    el('p', { class: 'hq-cos__decision-summary' },
      `${recTypeLabel(r)} · ${recStatusLabel(r.status)} · ${productionStageLabel(r.productionStage)}${r.blocked ? ' · Blocked' : ''} · ${visibilityLabel(r.visibility)}`),
    el('p', { class: 'hq-cos__decision-summary' },
      `${ownerLabel(r)} · recorded ${formatWhen(r.createdAt)}${r.preparation ? ` · prepared ${formatWhen(r.preparation.preparedAt)}` : ''}${r.founderDecision !== 'pending' ? ` · Founder: ${decisionLabel(r)}` : ''}`),
  );
  if (r.summary) card.append(el('p', { class: 'hq-cos__field-body' }, r.summary));
  if (r.preparation?.recommendation) card.append(cosField('Chief of Staff’s note', r.preparation.recommendation));
  if (r.productionNote) card.append(cosField('Clarification requested (with the Chief of Staff)', r.productionNote));

  // Eligibility guard — Production only takes up genuinely ready work.
  if (r.productionStage === null && !isProductionEligible(r)) {
    card.append(el('p', { class: 'hq-cos__quiet' },
      'Awaiting a Founder decision — this cannot enter production yet. The Chief of Staff will route it when it is ready.'));
    // Still allow returning it to the office.
    card.append(cosReturnButton(r, persist, productionReturn));
    return card;
  }

  const group = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': `Production of “${r.title}”` });
  const act = (label: string, fn: () => Recommendation): void => {
    const b = el('button', { class: 'hq-cos__response', type: 'button' }, label) as HTMLButtonElement;
    b.addEventListener('click', () => persist(fn()));
    group.append(b);
  };
  const st = r.productionStage;
  if (st === null) act('Accept for Production', () => productionAccept(r));
  if (st === 'accepted') act('Begin Production Planning', () => productionPlanning(r));
  if (st === 'planning') act('Mark Ready for Production', () => productionReady(r));
  if (st === 'ready') act('Mark In Production', () => productionInProduction(r));
  if (st === 'in_production') act('Mark Delivery Ready', () => productionDeliveryReady(r));
  if (st === 'delivery_ready') act('Mark Production Complete', () => productionComplete(r));
  if (st !== null) act(r.blocked ? 'Unblock' : 'Mark Blocked', () => setBlocked(r, !r.blocked));
  card.append(group);

  card.append(cosReturnButton(r, persist, productionReturn));

  // Request clarification — routed BACK through the Chief of Staff.
  const noteId = `pnote_${r.id.replace(/[^a-z0-9]/gi, '')}`;
  const note = el('input', {
    class: 'hq-cos__note-input', id: noteId, type: 'text', maxlength: '200',
    placeholder: 'What needs clarifying?',
    ...(r.productionNote ? { value: r.productionNote } : {}),
  }) as HTMLInputElement;
  const clarify = el('button', { class: 'hq-cos__withdraw', type: 'button' },
    'Request clarification (via Chief of Staff)') as HTMLButtonElement;
  clarify.addEventListener('click', () => persist(productionRequestClarification(r, note.value)));
  card.append(el('div', { class: 'hq-cos__note-field' },
    el('label', { class: 'hq-cos__note-input-label label', for: noteId }, 'Clarification note'), note, clarify));

  return card;
}

/** A shared "Return to Chief of Staff" button for a receiving Chair. */
function cosReturnButton(
  r: Recommendation, persist: (n: Recommendation) => void, returnFn: (rec: Recommendation) => Recommendation,
): HTMLElement {
  const b = el('button', { class: 'hq-cos__withdraw', type: 'button' }, 'Return to Chief of Staff') as HTMLButtonElement;
  b.addEventListener('click', () => persist(returnFn(r)));
  return b;
}

/**
 * THE NARRATION DESK — presented in the Headquarters editorial language, NOT as a
 * drawn scene. The room itself is the residence (the same architecture, glass,
 * light and materials that furnish every other wing); this is the quiet plaster
 * plate — brushed-brass hairline, generous negative space — that names where
 * narration and recording happen and holds the honest in-residence note. No
 * illustrated equipment: the room communicates purpose through its own
 * architecture, exactly as the Executive Office and Creative Director do.
 */
function buildNarrationDesk(): HTMLElement {
  // The institutional breadcrumb, so the entrance reads as a place within the
  // House, not an external utility link: Collective → Production → Voice Notes Studio.
  const crumb = el('p', { class: 'hq-narration__crumb label', 'aria-label': 'Location' });
  VOICE_NOTES_STUDIO.breadcrumb.forEach((step, i) => {
    if (i > 0) crumb.append(el('span', { class: 'hq-narration__crumb-sep', 'aria-hidden': 'true' }, ' → '));
    const last = i === VOICE_NOTES_STUDIO.breadcrumb.length - 1;
    crumb.append(el('span', { class: last ? 'hq-narration__crumb-here' : 'hq-narration__crumb-step' }, step));
  });

  // A real entrance. It routes to the existing Voice Notes Studio surface (served
  // under /production-studio, behind the same Cloudflare Access); Headquarters
  // links to it and never embeds or rebuilds it.
  const enter = el('a', {
    class: 'hq-narration__enter button', href: VOICE_NOTES_STUDIO.href,
  }, VOICE_NOTES_STUDIO.label) as HTMLAnchorElement;

  return el('section', { class: 'hq-narration', role: 'group', 'aria-label': 'The Narration Desk' },
    crumb,
    el('p', { class: 'hq-narration__eyebrow label' }, 'The Narration Desk'),
    el('p', { class: 'hq-narration__line' }, RECORDING_NOTE),
    el('p', { class: 'hq-narration__blurb' }, VOICE_NOTES_STUDIO.blurb),
    enter);
}

/** THE REVIEW ROOM — environmental only, in the residence's own language: a quiet
    plaster note that simply says finished work is reviewed here. No dashboard,
    no controls, no data, no illustration. */
function buildReviewRoom(): HTMLElement {
  return el('aside', { class: 'hq-review', 'aria-label': 'The review room' },
    el('p', { class: 'hq-review__eyebrow label' }, 'The review room'),
    el('p', { class: 'hq-review__note' }, REVIEW_NOTE));
}

/**
 * Fill the studio sprint from the finishing tail of the spine. Three lanes over
 * the existing statuses — In Production (scheduled), Preparing (approved),
 * Recently Finished (published) — as a curated vellum sheet, not a backlog.
 * Honest states: the studio quiet, or offline. Reads only.
 */
async function mountSprint(host: HTMLElement): Promise<void> {
  const [scheduled, approved, published] = await Promise.all([
    fetchInbox('scheduled'), fetchInbox('approved'), fetchInbox('published'),
  ]);
  host.setAttribute('aria-busy', 'false');

  // Offline only if EVERY lane failed to load (a partial read still tells a story).
  if (!scheduled.ok && !approved.ok && !published.ok) {
    host.replaceChildren(deskState(
      scheduled.offline ? 'The studio is offline' : 'The studio couldn’t load',
      scheduled.offline ? 'Your work is safe — try again in a moment.' : scheduled.error,
    ));
    return;
  }

  const sprint = productionSprint({
    scheduled: scheduled.ok ? scheduled.data.submissions : null,
    approved:  approved.ok  ? approved.data.submissions  : null,
    published: published.ok ? published.data.submissions : null,
  });

  host.replaceChildren(...sprintContent(sprint));
}

function sprintContent(sprint: ProductionSprint): Node[] {
  const head = el('p', { class: 'hq-sprint__eyebrow label' }, 'In the studio');

  if (sprint.total === 0) {
    return [head, el('p', { class: 'hq-sprint__quiet' },
      'The studio is quiet. When work is cleared for production, it gathers here to be finished.')];
  }

  const lanes = el('ol', { class: 'hq-sprint__lanes' });
  for (const lane of sprint.lanes) {
    const col = el('li', { class: 'hq-sprint__lane', 'data-lane': lane.id },
      el('p', { class: 'hq-sprint__lane-label' }, lane.label));
    if (lane.items.length === 0) {
      col.append(el('p', { class: 'hq-sprint__lane-empty' }, lane.empty));
    } else {
      const ul = el('ul', { class: 'hq-sprint__pieces' });
      for (const it of lane.items) ul.append(el('li', { class: 'hq-sprint__piece' }, it.name));
      col.append(ul);
      if (lane.total > lane.items.length) {
        col.append(el('p', { class: 'hq-sprint__more' }, `and ${lane.total - lane.items.length} more`));
      }
    }
    lanes.append(col);
  }
  return [head, el('div', { class: 'hq-sprint__sheet' }, lanes)];
}

/* =============================================================================
   GROWTH STUDIO — a sunlit publishing salon overlooking the horizon (Milestone 7).

   Route: #/growth. The residence's most outward-looking room, answering "Where is
   the House finding resonance?" — in RELATIONSHIPS, never metrics. The horizon (the
   shared residence) is the hero; the content is the correspondence the House keeps
   with the world, presented in the residence's editorial language. No workflow
   data, no fetch, no numbers, no dashboard — purely architectural + editorial.
   ============================================================================= */
function renderGrowth(root: HTMLElement, room: Room): void {
  setMode('seated');

  // The receiving queue — work routed to the Director of Growth (Sprint 12F).
  const intake = el('div', { class: 'hq-growth-intake' });
  // The research desk — Growth Intelligence capture (Sprint 13A).
  const desk = el('div', { class: 'hq-research' });
  // Opportunity Briefs — the analysis layer over captured intelligence (Sprint 13B).
  const briefs = el('div', { class: 'hq-briefs' });

  // The correspondence: each relationship as a calm plaster card — a standing
  // conversation, never a statistic. Curated and spacious, a salon not a grid.
  const cards = el('ul', { class: 'hq-corr__list' });
  for (const r of RELATIONSHIPS) {
    cards.append(el('li', { class: 'hq-corr__card' },
      el('p', { class: 'hq-corr__name' }, r.name),
      el('p', { class: 'hq-corr__note' }, r.note)));
  }

  const salon = el(
    'section',
    { class: 'hq-corr', role: 'group', 'aria-label': 'The House’s conversations with the world' },
    el('p', { class: 'hq-corr__eyebrow label' }, 'Ongoing conversations'),
    cards,
    el('p', { class: 'hq-corr__horizon' }, HORIZON_NOTE),
  );

  const view = el(
    'section',
    { class: 'hq-view hq-view--seated hq-view--growth', 'aria-label': room.name },
    el(
      'div',
      { class: 'hq-view__inner container' },
      el(
        'div',
        { class: 'hq-seated__bar' },
        el('a', { class: 'hq-back', href: getRoom(HOME_ROOM)!.route }, '← Return to the Executive Office'),
        renderRail(room.id),
      ),
      el(
        'header',
        { class: 'hq-seated__head' },
        el('p', { class: 'hq-eyebrow label' }, room.name),
        el('h1', { class: 'hq-title hq-title--seated' }, room.name),
        el('p', { class: 'hq-lede' }, SALON_LEDE),
      ),
      intake,
      desk,
      briefs,
      salon,
    ),
  );

  root.replaceChildren(view);
  mountGrowthIntake(intake);
  mountResearchDesk(desk);
  mountBriefDesk(briefs);
}

/* --- OPPORTUNITY BRIEFS — Growth's analysis surface (Sprint 13B) ------------
   Where captured intelligence becomes a structured, ranked content opportunity.
   Separate from rapid capture but connected to it: a brief always links to an
   intelligence record. Analysis only — no execution, no publishing. Repaints in
   place; drafts are editable, and a completed brief is marked ready for review. */
let briefNotice: string | null = null;

function mountBriefDesk(host: HTMLElement): void {
  const repaint = (): void => mountBriefDesk(host);
  const intel = loadIntelligence();
  const opps = loadOpportunities();

  const section = el('section', { class: 'hq-briefs__desk', 'aria-label': 'Opportunity briefs' },
    el('p', { class: 'hq-cos__eyebrow label' }, 'Opportunity Briefs'),
    el('p', { class: 'hq-cos__lead' }, 'Turn what you captured into a ranked content opportunity — the property, the audience need, the angle, and what to make.'));

  const notice = el('p', { class: 'hq-cos__notice', role: 'status', 'aria-live': 'polite' });
  if (briefNotice) { notice.classList.add('is-ok'); notice.append(el('span', { class: 'hq-cos__notice-mark', 'aria-hidden': 'true' }, '✓'), el('span', {}, briefNotice)); }
  section.append(notice);

  // Start a brief from an eligible intelligence item.
  const eligible = intel.filter(isIntelEligibleForBrief);
  if (eligible.length === 0) {
    section.append(el('p', { class: 'hq-cos__quiet' }, 'No open intelligence to analyse yet. Capture something first, and it can become a brief here.'));
  } else {
    const sel = el('select', { class: 'hq-cos__select', id: 'brief_from', 'aria-label': 'Intelligence to analyse' }) as HTMLSelectElement;
    for (const i of eligible) sel.append(el('option', { value: i.id }, i.title));
    const start = el('button', { class: 'hq-cos__response', type: 'button' }, 'Start a brief') as HTMLButtonElement;
    start.addEventListener('click', () => {
      const src = eligible.find((i) => i.id === sel.value);
      if (!src) return;
      const opp = makeContentOpportunity({ id: `opp_${Date.now()}`, intelId: src.id, title: src.title, summary: src.summary, audience: src.audience });
      if (!opp) return;
      saveOpportunities(upsertOpportunity(loadOpportunities(), opp));
      briefNotice = `Draft brief started from “${src.title}”.`;
      repaint();
    });
    section.append(el('div', { class: 'hq-briefs__start' },
      el('label', { class: 'hq-cos__note-input-label label', for: 'brief_from' }, 'Analyse an intelligence item'),
      el('div', { class: 'hq-cos__route-row' }, sel, start)));
  }

  // Drafts in progress — editable.
  const drafts = draftOpportunities(opps);
  const draftBlock = el('section', { class: 'hq-cos__block' },
    el('div', { class: 'hq-cos__block-head' },
      el('h2', { class: 'hq-cos__block-title' }, 'In Progress'),
      el('span', { class: 'hq-cos__count', 'aria-label': `${drafts.length} drafts` }, String(drafts.length))));
  if (drafts.length === 0) draftBlock.append(el('p', { class: 'hq-cos__quiet' }, 'No briefs in progress.'));
  else { const list = el('div', { class: 'hq-cos__decisions' }); for (const o of drafts) list.append(briefEditorCard(o, repaint)); draftBlock.append(list); }
  section.append(draftBlock);

  // Everything else Growth has produced (read-only summary).
  const others = opps.filter((o) => o.status !== 'draft' && o.status !== 'analyzing')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (others.length) {
    const log = el('section', { class: 'hq-cos__block' },
      el('div', { class: 'hq-cos__block-head' },
        el('h2', { class: 'hq-cos__block-title' }, 'Submitted Briefs'),
        el('span', { class: 'hq-cos__count', 'aria-label': `${others.length} submitted` }, String(others.length))));
    const list = el('div', { class: 'hq-cos__decisions' });
    for (const o of others.slice(0, 10)) list.append(briefSummaryCard(o));
    log.append(list);
    section.append(log);
  }
  host.replaceChildren(section);
}

/** Multi-select chips (checkboxes) for properties or formats. */
function chipSet<T extends string>(
  name: string, options: { id: T; label: string }[], selected: T[], onChange: (next: T[]) => void,
): HTMLElement {
  const wrap = el('div', { class: 'hq-briefs__chips', role: 'group', 'aria-label': name });
  const chosen = new Set<T>(selected);
  for (const o of options) {
    const id = `${name.replace(/\W/g, '')}_${o.id}`;
    const cb = el('input', { class: 'hq-briefs__chip-input', type: 'checkbox', id, ...(chosen.has(o.id) ? { checked: 'checked' } : {}) }) as HTMLInputElement;
    cb.addEventListener('change', () => { if (cb.checked) chosen.add(o.id); else chosen.delete(o.id); onChange([...chosen]); });
    wrap.append(el('label', { class: 'hq-briefs__chip', for: id }, cb, el('span', {}, o.label)));
  }
  return wrap;
}

function ratingSelect(id: string, value: Rating): HTMLSelectElement {
  const s = el('select', { class: 'hq-cos__select hq-briefs__rating', id }) as HTMLSelectElement;
  for (const r of RATINGS) s.append(el('option', { value: r.id, ...(r.id === value ? { selected: 'selected' } : {}) }, r.label));
  return s;
}

function briefEditorCard(o: ContentOpportunity, repaint: () => void): HTMLElement {
  // Working copy held in the closure; persisted on Save / Ready.
  let draft = o;
  const card = el('article', { class: 'hq-cos__decision hq-briefs__editor' });
  const persist = (next: ContentOpportunity, notice: string): void => {
    saveOpportunities(upsertOpportunity(loadOpportunities(), next));
    briefNotice = notice; repaint();
  };

  const titleId = `bt_${o.id}`;
  const title = el('input', { class: 'hq-research__input', id: titleId, type: 'text', maxlength: '140', value: o.title }) as HTMLInputElement;
  const angleId = `ba_${o.id}`;
  const angle = el('input', { class: 'hq-research__input', id: angleId, type: 'text', maxlength: '160', value: o.angle, placeholder: 'The recommended angle' }) as HTMLInputElement;
  const needId = `bn_${o.id}`;
  const need = el('input', { class: 'hq-research__input', id: needId, type: 'text', maxlength: '200', value: o.audienceNeed, placeholder: 'The audience need or question' }) as HTMLInputElement;
  const audId = `bau_${o.id}`;
  const aud = el('input', { class: 'hq-research__input', id: audId, type: 'text', maxlength: '120', value: o.audience, placeholder: 'Who it’s for' }) as HTMLInputElement;
  const recId = `br_${o.id}`;
  const recField = el('textarea', { class: 'hq-research__textarea', id: recId, rows: '2', maxlength: '400', placeholder: 'Your recommendation / strategic reasoning' }) as HTMLTextAreaElement;
  recField.value = o.recommendation;
  const nextId = `bx_${o.id}`;
  const nextField = el('input', { class: 'hq-research__input', id: nextId, type: 'text', maxlength: '160', value: o.nextAction, placeholder: 'Proposed next action' }) as HTMLInputElement;

  card.append(
    el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__decision-title' }, `Brief — ${o.title}`),
      el('span', { class: 'hq-cos__tag label', 'data-status': o.status }, opportunityStatusLabel(o.status))),
    deskField(titleId, 'Title', title),
    briefFieldLabel('Properties'),
    chipSet<ContentProperty>('Properties', CONTENT_PROPERTIES, draft.properties, (next) => { draft = { ...draft, properties: next }; }),
    briefFieldLabel('Suggested formats'),
    chipSet<OpportunityType>('Formats', OPPORTUNITY_TYPES, draft.types, (next) => { draft = { ...draft, types: next }; }),
    deskField(needId, 'Audience need', need),
    deskField(audId, 'Audience', aud),
    deskField(angleId, 'Recommended angle', angle),
    deskField(recId, 'Recommendation', recField),
    deskField(nextId, 'Next action', nextField),
  );

  // The transparent scoring signals.
  const signalRow = el('div', { class: 'hq-briefs__signals' });
  const selects: Record<string, HTMLSelectElement> = {};
  for (const dim of SCORE_DIMENSIONS) {
    const sid = `bs_${o.id}_${dim.id}`;
    const s = ratingSelect(sid, draft.signals[dim.id]);
    selects[dim.id] = s;
    signalRow.append(el('div', { class: 'hq-briefs__signal' },
      el('label', { class: 'hq-cos__note-input-label label', for: sid }, dim.label), s));
  }
  const confId = `bc_${o.id}`;
  const conf = ratingSelect(confId, draft.confidence);
  signalRow.append(el('div', { class: 'hq-briefs__signal' },
    el('label', { class: 'hq-cos__note-input-label label', for: confId }, 'Confidence'), conf));
  card.append(briefFieldLabel('Strategic signals'), signalRow);

  const scoreLine = el('p', { class: 'hq-briefs__score-line' });
  const readSignals = (): OpportunitySignals => ({
    timeliness: selects.timeliness.value as Rating, audienceRelevance: selects.audienceRelevance.value as Rating,
    propertyFit: selects.propertyFit.value as Rating, founderFit: selects.founderFit.value as Rating,
    contentPotential: selects.contentPotential.value as Rating, conversionPotential: selects.conversionPotential.value as Rating,
    effort: selects.effort.value as Rating,
  });
  const paintScore = (): void => {
    const sc = scoreOpportunity(readSignals(), conf.value as Rating);
    scoreLine.replaceChildren(el('span', { class: 'hq-briefs__score' }, String(sc.score)), el('span', {}, ` / 100 · ${sc.band}${sc.caution ? ` · ${sc.caution}` : ''}`));
  };
  for (const s of Object.values(selects)) s.addEventListener('change', paintScore);
  conf.addEventListener('change', paintScore);
  paintScore();
  card.append(el('div', { class: 'hq-briefs__score-preview' }, el('span', { class: 'hq-cos__note-input-label label' }, 'Score'), scoreLine));

  const collect = (): ContentOpportunity => updateOpportunity(draft, {
    title: title.value, angle: angle.value, audience: aud.value, audienceNeed: need.value,
    recommendation: recField.value, nextAction: nextField.value,
    properties: draft.properties, types: draft.types,
    signals: readSignals(), confidence: conf.value as Rating,
  });

  const group = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': `Actions for brief “${o.title}”` });
  const saveBtn = el('button', { class: 'hq-cos__response', type: 'button' }, 'Save draft') as HTMLButtonElement;
  saveBtn.addEventListener('click', () => persist(collect(), 'Draft saved.'));
  const readyBtn = el('button', { class: 'hq-cos__response', type: 'button' }, 'Mark ready for review') as HTMLButtonElement;
  readyBtn.addEventListener('click', () => persist(markReadyForReview(collect()), 'Sent to the Chief of Staff for review.'));
  group.append(saveBtn, readyBtn);
  card.append(group);
  return card;
}

function briefFieldLabel(text: string): HTMLElement {
  return el('p', { class: 'hq-cos__field-label label hq-briefs__section-label' }, text);
}

function briefSummaryCard(o: ContentOpportunity): HTMLElement {
  const sc = scoreOpportunity(o.signals, o.confidence);
  return el('article', { class: 'hq-cos__decision' },
    el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__decision-title' }, o.title),
      el('span', { class: 'hq-cos__tag label', 'data-status': o.status }, opportunityStatusLabel(o.status))),
    el('p', { class: 'hq-cos__decision-summary' },
      `${o.properties.map(contentPropertyLabel).join(', ') || 'No property'} · score ${sc.score} · ${sc.band}`));
}

/* --- THE RESEARCH DESK — Growth Intelligence capture (Sprint 13A) ----------
   The Director of Growth's intake for external intelligence — opportunities the
   Chair FINDS ("I found this"), captured fast and kept for the office to review.
   Capture only: no publishing, no execution, no scraping. Repaints in place. */
let researchNotice: string | null = null;

function mountResearchDesk(host: HTMLElement): void {
  const repaint = (): void => mountResearchDesk(host);
  const section = el('section', { class: 'hq-research__desk', 'aria-label': 'Growth research desk' },
    el('p', { class: 'hq-cos__eyebrow label' }, 'The research desk'),
    el('p', { class: 'hq-cos__lead' }, 'Capture what you find — a trend, a search, a question the audience keeps asking. The office reviews and prioritises; you simply find it.'));

  section.append(researchCaptureForm(repaint));

  // What the Chair has found — the research log, newest first.
  const found = growthCaptures(loadIntelligence());
  const log = el('section', { class: 'hq-research__log', 'aria-label': 'What I have found' },
    el('div', { class: 'hq-cos__block-head' },
      el('h2', { class: 'hq-cos__block-title' }, 'What I’ve found'),
      el('span', { class: 'hq-cos__count', 'aria-label': `${found.length} captured` }, String(found.length))));
  if (found.length === 0) {
    log.append(el('p', { class: 'hq-cos__quiet' }, 'Nothing captured yet. When you find an opportunity, it appears here for the office.'));
  } else {
    const list = el('div', { class: 'hq-cos__decisions' });
    for (const i of found.slice(0, 12)) list.append(intelCaptureCard(i));
    log.append(list);
  }
  section.append(log);
  host.replaceChildren(section);
}

/** A labelled field wrapper for the capture form. */
function deskField(id: string, label: string, control: HTMLElement): HTMLElement {
  return el('div', { class: 'hq-research__field' },
    el('label', { class: 'hq-cos__note-input-label label', for: id }, label), control);
}
function selectFrom(id: string, opts: { id: string; label: string }[]): HTMLSelectElement {
  const s = el('select', { class: 'hq-cos__select', id }) as HTMLSelectElement;
  for (const o of opts) s.append(el('option', { value: o.id }, o.label));
  return s;
}

function researchCaptureForm(repaint: () => void): HTMLElement {
  const form = el('form', { class: 'hq-research__form', 'aria-label': 'Capture an opportunity' }) as HTMLFormElement;

  const title = el('input', { class: 'hq-research__input', id: 'ri_title', type: 'text', maxlength: '140', required: 'true', placeholder: 'What did you find?' }) as HTMLInputElement;
  const summary = el('textarea', { class: 'hq-research__textarea', id: 'ri_summary', rows: '2', maxlength: '600', required: 'true', placeholder: 'In a sentence or two' }) as HTMLTextAreaElement;
  const source = selectFrom('ri_source', INTEL_SOURCES);
  const category = selectFrom('ri_category', INTEL_CATEGORIES);
  const confidence = selectFrom('ri_confidence', INTEL_CONFIDENCES);
  const why = el('textarea', { class: 'hq-research__textarea', id: 'ri_why', rows: '2', maxlength: '400', placeholder: 'Why it matters (optional)' }) as HTMLTextAreaElement;
  const audience = el('input', { class: 'hq-research__input', id: 'ri_audience', type: 'text', maxlength: '120', placeholder: 'Who it’s for (optional)' }) as HTMLInputElement;
  const links = el('textarea', { class: 'hq-research__textarea', id: 'ri_links', rows: '2', maxlength: '800', placeholder: 'Links — one per line (optional)' }) as HTMLTextAreaElement;
  const notes = el('textarea', { class: 'hq-research__textarea', id: 'ri_notes', rows: '2', maxlength: '600', placeholder: 'Notes or pasted text (optional)' }) as HTMLTextAreaElement;
  const shot = el('input', { class: 'hq-research__file', id: 'ri_shot', type: 'file', accept: 'image/*' }) as HTMLInputElement;

  let pendingShot: IntelAttachment | null = null;
  shot.addEventListener('change', () => {
    const f = shot.files && shot.files[0];
    if (!f) { pendingShot = null; return; }
    const reader = new FileReader();
    reader.onload = () => { pendingShot = { id: `att_${Date.now()}`, name: f.name, dataUrl: String(reader.result) }; };
    reader.readAsDataURL(f);
  });

  const notice = el('p', { class: 'hq-cos__notice', role: 'status', 'aria-live': 'polite' });
  if (researchNotice) { notice.classList.add('is-ok'); notice.append(el('span', { class: 'hq-cos__notice-mark', 'aria-hidden': 'true' }, '✓'), el('span', {}, researchNotice)); }

  const submit = el('button', { class: 'hq-cos__response hq-research__submit', type: 'submit' }, 'Capture') as HTMLButtonElement;

  form.append(
    deskField('ri_title', 'Title', title),
    deskField('ri_summary', 'Summary', summary),
    el('div', { class: 'hq-research__row' },
      deskField('ri_source', 'Source', source),
      deskField('ri_category', 'Category', category),
      deskField('ri_confidence', 'Confidence', confidence)),
    deskField('ri_why', 'Why it matters', why),
    deskField('ri_audience', 'Audience', audience),
    deskField('ri_links', 'Links', links),
    deskField('ri_notes', 'Notes', notes),
    deskField('ri_shot', 'Screenshot', shot),
    notice, submit,
  );

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const item = makeIntelligenceItem({
      id: `intel_${Date.now()}`,
      title: title.value, summary: summary.value,
      source: source.value as IntelSource, category: category.value as IntelCategory,
      confidence: confidence.value as IntelConfidence,
      whyItMatters: why.value, audience: audience.value,
      links: links.value.split(/[\n,]/).map((l) => l.trim()).filter(Boolean),
      attachments: pendingShot ? [pendingShot] : [],
      notes: notes.value,
    });
    if (!item) { researchNotice = null; return; }
    saveIntelligence(upsertIntelligence(loadIntelligence(), item));
    researchNotice = 'Captured — the office will review it.';
    repaint();
  });
  return form;
}

/** A compact card for one captured opportunity in the Growth log. */
function intelCaptureCard(i: IntelligenceItem): HTMLElement {
  const card = el('article', { class: 'hq-cos__decision' });
  card.append(
    el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__decision-title' }, i.title),
      el('span', { class: 'hq-cos__tag label', 'data-status': i.status }, intelStatusLabel(i.status))),
    el('p', { class: 'hq-cos__decision-summary' },
      `${intelSourceLabel(i.source)} · ${intelCategoryLabel(i.category)} · ${intelConfidenceLabel(i.confidence)} confidence · ${formatWhen(i.capturedAt)}`),
    el('p', { class: 'hq-cos__field-body' }, i.summary),
  );
  if (i.whyItMatters) card.append(cosField('Why it matters', i.whyItMatters));
  if (i.links.length) card.append(intelLinks(i.links));
  if (i.review) card.append(el('p', { class: 'hq-cos__quiet' }, `Office: ${intelOutcomeLabel(i.review.outcome)}${i.review.note ? ` — “${i.review.note}”` : ''}`));
  return card;
}

function intelLinks(links: string[]): HTMLElement {
  const wrap = el('div', { class: 'hq-research__links' });
  for (const l of links) {
    const a = el('a', { class: 'hq-research__link', href: l, target: '_blank', rel: 'noreferrer noopener' }, l);
    wrap.append(a);
  }
  return wrap;
}

/* --- The Director of Growth's receiving queue (Sprint 12F) -----------------
   Work routed here by the Chief of Staff — ONLY items owned by Chair #004.
   Growth takes up only eligible work (approved/decided or validly routed for
   execution); a clarification returns to the Chief of Staff, never the Founder.
   Renders synchronously from the client store and repaints itself in place. */
function mountGrowthIntake(host: HTMLElement): void {
  const repaint = (): void => mountGrowthIntake(host);
  const queue = growthQueue(loadRecommendations());

  const section = el('section', { class: 'hq-cos__section', 'aria-label': 'Work from the Chief of Staff' },
    el('p', { class: 'hq-cos__eyebrow label' }, 'From the Chief of Staff'),
    el('p', { class: 'hq-cos__lead' }, 'Work routed to the Director of Growth. Everything here arrives through the Chief of Staff — carrying it outward is yours.'));

  if (queue.length === 0) {
    section.append(el('p', { class: 'hq-cos__quiet' },
      'Nothing has been routed to you yet. When the Chief of Staff sends finished work to carry outward, it appears here.'));
  } else {
    const list = el('div', { class: 'hq-cos__decisions' });
    for (const r of queue) list.append(cosGrowthCard(r, repaint));
    section.append(list);
  }
  host.replaceChildren(section);
}

function cosGrowthCard(r: Recommendation, repaint: () => void): HTMLElement {
  const persist = (next: Recommendation): void => {
    saveRecommendations(upsertRecommendation(loadRecommendations(), next));
    repaint();
  };
  const card = el('article', { class: 'hq-cos__decision' });
  card.append(
    el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__decision-title' }, r.title),
      el('span', { class: 'hq-cos__tag label', 'data-status': r.priority }, priorityLabel(r.priority))),
    el('p', { class: 'hq-cos__decision-summary' },
      `${recTypeLabel(r)} · ${recStatusLabel(r.status)} · ${growthStageLabel(r.growthStage)}${r.blocked ? ' · Blocked' : ''} · ${visibilityLabel(r.visibility)}`),
    el('p', { class: 'hq-cos__decision-summary' },
      `${ownerLabel(r)} · recorded ${formatWhen(r.createdAt)}${r.preparation ? ` · prepared ${formatWhen(r.preparation.preparedAt)}` : ''}${r.founderDecision !== 'pending' ? ` · Founder: ${decisionLabel(r)}` : ''}`),
  );
  if (r.summary) card.append(el('p', { class: 'hq-cos__field-body' }, r.summary));
  if (r.preparation?.recommendation) card.append(cosField('Chief of Staff’s note', r.preparation.recommendation));
  if (r.growthNote) card.append(cosField('Clarification requested (with the Chief of Staff)', r.growthNote));

  // Eligibility guard — Growth only takes up genuinely ready work.
  if (r.growthStage === null && !isGrowthEligible(r)) {
    card.append(el('p', { class: 'hq-cos__quiet' },
      'Awaiting a Founder decision — this cannot enter growth yet. The Chief of Staff will route it when it is ready.'));
    // Still allow returning it to the office.
    card.append(cosReturnButton(r, persist, growthReturn));
    return card;
  }

  const group = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': `Growth of “${r.title}”` });
  const act = (label: string, fn: () => Recommendation): void => {
    const b = el('button', { class: 'hq-cos__response', type: 'button' }, label) as HTMLButtonElement;
    b.addEventListener('click', () => persist(fn()));
    group.append(b);
  };
  const st = r.growthStage;
  if (st === null) act('Accept Growth Initiative', () => growthAccept(r));
  if (st === 'accepted') act('Begin Strategy', () => growthStrategy(r));
  if (st === 'strategy') act('Begin Research', () => growthResearch(r));
  if (st === 'research') act('Begin Campaign Planning', () => growthCampaignPlanning(r));
  if (st === 'campaign_planning') act('Mark Ready to Launch', () => growthReadyToLaunch(r));
  if (st === 'ready_to_launch') act('Mark Active', () => growthActive(r));
  if (st === 'active') act('Measure Results', () => growthMeasuring(r));
  if (st === 'measuring') act('Mark Growth Complete', () => growthComplete(r));
  if (st !== null) act(r.blocked ? 'Unblock' : 'Mark Blocked', () => setBlocked(r, !r.blocked));
  card.append(group);

  card.append(cosReturnButton(r, persist, growthReturn));

  // Request clarification — routed BACK through the Chief of Staff.
  const noteId = `gnote_${r.id.replace(/[^a-z0-9]/gi, '')}`;
  const note = el('input', {
    class: 'hq-cos__note-input', id: noteId, type: 'text', maxlength: '200',
    placeholder: 'What needs clarifying?',
    ...(r.growthNote ? { value: r.growthNote } : {}),
  }) as HTMLInputElement;
  const clarify = el('button', { class: 'hq-cos__withdraw', type: 'button' },
    'Request clarification (via Chief of Staff)') as HTMLButtonElement;
  clarify.addEventListener('click', () => persist(growthRequestClarification(r, note.value)));
  card.append(el('div', { class: 'hq-cos__note-field' },
    el('label', { class: 'hq-cos__note-input-label label', for: noteId }, 'Clarification note'), note, clarify));

  return card;
}

/* =============================================================================
   BUSINESS OFFICE — a private counsel's study where what's built is kept safe
   (Milestone 8 — the wing that completes the residence).

   Route: #/business. The residence's most rooted, permanent room, answering "How
   do we preserve what the House has built?" — protection before administration.
   The hero is THE ARCHIVE: a wall of archival records naming the subjects the
   House protects. No workflow data, no fetch, no numbers, no records, no
   dashboard, no current-priority task — the architecture carries the meaning.
   ============================================================================= */
function renderBusiness(root: HTMLElement, room: Room): void {
  setMode('seated');

  // The Archive — the subjects the House keeps and protects, each a calm walnut
  // record. Archival subjects only; never a record, a figure, or a status.
  const records = el('ul', { class: 'hq-arch__list' });
  for (const s of SAFEGUARDS) {
    records.append(el('li', { class: 'hq-arch__record' },
      el('p', { class: 'hq-arch__name' }, s.name),
      el('p', { class: 'hq-arch__note' }, s.note)));
  }

  const archive = el(
    'section',
    { class: 'hq-arch', role: 'group', 'aria-label': 'The archive — what the House keeps safe' },
    el('p', { class: 'hq-arch__eyebrow label' }, 'The archive'),
    records,
    el('p', { class: 'hq-arch__continuity' }, CONTINUITY_NOTE),
  );

  const view = el(
    'section',
    { class: 'hq-view hq-view--seated hq-view--business', 'aria-label': room.name },
    el(
      'div',
      { class: 'hq-view__inner container' },
      el(
        'div',
        { class: 'hq-seated__bar' },
        el('a', { class: 'hq-back', href: getRoom(HOME_ROOM)!.route }, '← Return to the Executive Office'),
        renderRail(room.id),
      ),
      el(
        'header',
        { class: 'hq-seated__head' },
        el('p', { class: 'hq-eyebrow label' }, room.name),
        el('h1', { class: 'hq-title hq-title--seated' }, room.name),
        el('p', { class: 'hq-lede' }, STUDY_LEDE),
      ),
      archive,
    ),
  );

  root.replaceChildren(view);
}

/* =============================================================================
   OFFICE OF THE CHIEF OF STAFF — the founder's private executive WORKSPACE
   (Sprint 9A). NOT a room in the residence: Headquarters is architecturally
   complete, so the office is reached from the House Toolbar / Quick Actions and
   lives at #/chief-of-staff (with a calm section sub-route #/chief-of-staff/
   <section>), never appearing in the atrium or the wing rail. The office is data
   (see chief-of-staff.ts); this renders its six prepared sections. The Decision
   System is the one interactive foundation — the Founder's own responses are
   recorded and kept (localStorage, like the Calendar). No AI, no automation, no
   fetch: everything is prepared before the Founder arrives.
   ============================================================================= */
const COS_ROUTE = '#/chief-of-staff';
function renderChiefOfStaff(root: HTMLElement): void {
  setMode('seated');

  const section: CosSectionId = isCosSection(subSegment())
    ? (subSegment() as CosSectionId)
    : COS_HOME_SECTION;

  // The section navigation — the office's own quiet index. Briefing is home
  // (the bare route); the rest are sub-routes, so each section is deep-linkable.
  const nav = el('nav', { class: 'hq-cos__nav', 'aria-label': 'Sections of the office' });
  const navList = el('ul', { class: 'hq-cos__nav-list' });
  for (const s of COS_SECTIONS) {
    const href = s.id === COS_HOME_SECTION ? COS_ROUTE : `${COS_ROUTE}/${s.id}`;
    const link = el('a', {
      class: 'hq-cos__nav-link',
      href,
      ...(s.id === section ? { 'aria-current': 'page' } : {}),
    }, s.label);
    navList.append(el('li', { class: 'hq-cos__nav-item' }, link));
  }
  nav.append(navList);

  const body = el('div', { class: 'hq-cos__body' });
  const paint = () => body.replaceChildren(cosSectionView(section, paint));
  paint();

  const view = el(
    'section',
    { class: 'hq-view hq-view--seated hq-view--cos', 'aria-label': COS_TITLE },
    el(
      'div',
      { class: 'hq-view__inner container' },
      el(
        'div',
        { class: 'hq-seated__bar' },
        // Not a wing, so no wing rail — just the way back to the residence.
        el('a', { class: 'hq-back', href: getRoom(HOME_ROOM)!.route }, '← Return to the Executive Office'),
      ),
      el(
        'header',
        { class: 'hq-seated__head' },
        el('p', { class: 'hq-eyebrow label' }, COS_EYEBROW),
        el('h1', { class: 'hq-title hq-title--seated' }, COS_TITLE),
        el('p', { class: 'hq-lede' }, COS_LEDE),
      ),
      nav,
      body,
    ),
  );

  root.replaceChildren(view);
}

/** Build the body for one section. `repaint` lets interactive sections (the
    Decisions record) refresh in place after the Founder acts. */
function cosSectionView(section: CosSectionId, repaint: () => void): HTMLElement {
  switch (section) {
    case 'briefing':   return cosBriefing();
    case 'initiatives': return cosInitiatives(repaint);
    case 'work-queue': return cosWorkQueue(repaint);
    case 'inbox':      return cosInbox(repaint);
    case 'decisions':  return cosDecisions(repaint);
    case 'docket':     return cosDocket();
    case 'brokerage':  return cosBrokerage(repaint);
    case 'opportunities': return cosOpportunities(repaint);
    case 'chairs':     return cosChairs();
    case 'leadership': return cosLeadership();
    case 'archive':    return cosArchive();
  }
}

/** A section intro: an eyebrow + one prepared line beneath it. */
function cosIntro(eyebrow: string, line: string): HTMLElement {
  return el('div', { class: 'hq-cos__intro' },
    el('p', { class: 'hq-cos__eyebrow label' }, eyebrow),
    el('p', { class: 'hq-cos__lead' }, line));
}

/** A titled block of prepared lines (Today's Priorities, Risks, and the like). */
function cosBlock(title: string, lines: string[]): HTMLElement {
  const list = el('ul', { class: 'hq-cos__lines' });
  for (const line of lines) list.append(el('li', { class: 'hq-cos__line' }, line));
  return el('section', { class: 'hq-cos__block' },
    el('h2', { class: 'hq-cos__block-title' }, title),
    list);
}

/* --- 1. Founder Briefing -------------------------------------------------- */
function cosBriefing(): HTMLElement {
  const tod = timeOfDay();
  const waiting = openDecisions(DECISIONS, loadResponses());

  // Decisions Waiting — the one live line, derived from the record so it can
  // never disagree with the Decisions section.
  const decisionsWaiting = el('section', { class: 'hq-cos__block' },
    el('h2', { class: 'hq-cos__block-title' }, 'Decisions Waiting'));
  if (waiting.length === 0) {
    decisionsWaiting.append(el('p', { class: 'hq-cos__quiet' },
      'Nothing awaits your decision. Everything prepared has been answered.'));
  } else {
    const line = waiting.length === 1
      ? 'One recommendation is prepared and waiting for your word.'
      : `${spellCount(waiting.length)} recommendations are prepared and waiting for your word.`;
    decisionsWaiting.append(el('p', { class: 'hq-cos__lead' }, line));
    const list = el('ul', { class: 'hq-cos__lines' });
    for (const v of waiting) list.append(el('li', { class: 'hq-cos__line' }, v.decision.title));
    decisionsWaiting.append(list);
    decisionsWaiting.append(el('a', { class: 'hq-cos__more', href: '#/chief-of-staff/decisions' },
      'Review the decisions →'));
  }

  return el('div', { class: 'hq-cos__section hq-cos__section--briefing' },
    el('section', { class: 'hq-cos__welcome' },
      el('p', { class: 'hq-cos__eyebrow label' }, `${greeting(tod)}`),
      el('p', { class: 'hq-cos__welcome-line' }, BRIEFING.goodMorning)),
    hosArrival(),
    cosBlock('Today’s Priorities', BRIEFING.todaysPriorities),
    decisionsWaiting,
    cosOperational(),
    cosBlock('Progress Since Yesterday', BRIEFING.progressSinceYesterday),
    cosBlock('Risks', BRIEFING.risks),
    cosBlock('Looking Ahead', BRIEFING.lookingAhead),
    el('aside', { class: 'hq-cos__note', role: 'note' },
      el('p', { class: 'hq-cos__note-label label' }, 'A note from your Chief of Staff'),
      el('p', { class: 'hq-cos__note-body' }, BRIEFING.chiefOfStaffNote)),
  );
}

/** The Headquarters Operating System's arrival brief — what the House already
    knows when the Founder enters: what needs her judgment, what completed work
    is ready to brief, and what is continuing without her. Composed from the HOS
    derivation over every matter; the Founder investigates nothing. */
function hosArrival(): HTMLElement {
  const loop = deriveExecutiveLoop(loadInitiatives());
  const brief = arrivalBrief(loop.state);
  const total = brief.awaitingJudgment.length + brief.readyToBrief.length + brief.continuing.length;
  const section = el('section', { class: 'hq-cos__block hq-cos__arrival', 'aria-label': 'The House at present' });
  if (total === 0) { section.setAttribute('hidden', ''); return section; }

  section.append(
    el('p', { class: 'hq-cos__eyebrow label' }, 'The House, at present'),
    el('p', { class: 'hq-cos__lead' }, brief.headline));

  // The House's execution posture — whether it can carry the next step out on its
  // own, in calm language; never developer-console status.
  const posture = executionPosture(deriveEligibility(loop.recommendation));
  if (posture) section.append(el('p', { class: 'hq-cos__quiet' }, posture));

  const group = (label: string, titles: string[]): void => {
    if (!titles.length) return;
    const ul = el('ul', { class: 'hq-cos__lines' });
    for (const t of titles) ul.append(el('li', { class: 'hq-cos__line' }, t));
    section.append(el('div', { class: 'hq-cos__arrival-group' },
      el('p', { class: 'hq-cos__field-label label' }, label), ul));
  };
  group('Awaiting your judgment', brief.awaitingJudgment);
  group('Completed — ready to brief you', brief.readyToBrief);
  group('Continuing without you', brief.continuing);

  section.append(el('a', { class: 'hq-cos__more', href: '#/chief-of-staff/initiatives' }, 'Enter the matters →'));
  return section;
}

/** The Founder-facing posture for the House's next step — calm and residential;
    never developer-console language. Empty when nothing further is warranted. */
function executionPosture(e: Eligibility): string {
  switch (e) {
    case 'auto_executable':
    case 'executable_with_safeguards':  return 'The House can carry the next step out on its own.';
    case 'founder_approval_required':   return 'The next step awaits your judgment.';
    case 'in_progress':                 return 'The House is carrying the next step out.';
    case 'awaiting_verification':       return 'Completed work is being checked before it reaches you.';
    case 'blocked':                     return 'A matter is held for your judgment.';
    case 'not_executable':              return '';
  }
}

/* --- 1b. Operational picture — derived from the Chief of Staff's real record.
   One integrated summary (what awaits you, priorities, what is in motion, how the
   Chairs are loaded), computed from the operational engine. Read-only in this
   first version; honestly quiet until real work is recorded — nothing invented. */
function cosOperational(): HTMLElement {
  const brief = operationalBriefing(loadRecommendations());
  const block = el('section', { class: 'hq-cos__block' },
    el('h2', { class: 'hq-cos__block-title' }, 'The Institution, at a Glance'));

  if (brief.quiet) {
    block.append(el('p', { class: 'hq-cos__quiet' },
      'No work is in motion yet. When recommendations are prepared and routed, they will gather here — so you see one picture, not many scattered updates.'));
    return block;
  }

  // Awaiting your decision.
  if (brief.waitingCount > 0) {
    const list = el('ul', { class: 'hq-cos__lines' });
    for (const r of brief.waiting) {
      list.append(el('li', { class: 'hq-cos__line' },
        `${r.title} — ${ownerLabel(r)}`));
    }
    block.append(
      el('p', { class: 'hq-cos__lead' },
        brief.waitingCount === 1
          ? 'One recommendation awaits your decision.'
          : `${spellCount(brief.waitingCount)} recommendations await your decision.`),
      list);
  }

  // The loop, in one line — a summary of where work sits, linking to the Inbox
  // rather than duplicating it. Only non-zero states are named.
  const parts: string[] = [];
  if (brief.needsTriageCount > 0) parts.push(`${brief.needsTriageCount} to triage`);
  if (brief.inPreparationCount > 0) parts.push(`${brief.inPreparationCount} in preparation`);
  if (brief.inFollowUpCount > 0) parts.push(`${brief.inFollowUpCount} in execution`);
  if (brief.blockedCount > 0) parts.push(`${brief.blockedCount} blocked`);
  if (brief.heldCount > 0) parts.push(`${brief.heldCount} held`);
  if (parts.length > 0) {
    block.append(
      el('h3', { class: 'hq-cos__field-label label' }, 'The Working Loop'),
      el('p', { class: 'hq-cos__line' }, parts.join(' · ')),
      el('a', { class: 'hq-cos__more', href: '#/chief-of-staff/inbox' }, 'Open the Executive Inbox →'));
  }

  // Institutional priorities — active work in priority order.
  const prio = el('ul', { class: 'hq-cos__lines' });
  for (const r of brief.priorities) {
    prio.append(el('li', { class: 'hq-cos__line' },
      el('span', { class: 'hq-cos__tag label', 'data-status': r.priority }, priorityLabel(r.priority)),
      ` ${r.title} · ${ownerLabel(r)} · ${recStatusLabel(r.status)}`));
  }
  block.append(
    el('h3', { class: 'hq-cos__field-label label' }, 'Institutional Priorities'),
    prio);

  // In execution — the office's follow-up, not the Founder's to track.
  if (brief.inExecution.length > 0) {
    const inx = el('ul', { class: 'hq-cos__lines' });
    for (const r of brief.inExecution) inx.append(el('li', { class: 'hq-cos__line' }, `${r.title} — ${ownerLabel(r)}`));
    block.append(el('h3', { class: 'hq-cos__field-label label' }, 'In Execution'), inx);
  }

  // Executive workload — how the Chairs are loaded (derived, honest).
  const load = el('ul', { class: 'hq-cos__lines' });
  for (const w of brief.workload) {
    load.append(el('li', { class: 'hq-cos__line' },
      `Chair #${String(w.ordinal).padStart(3, '0')} — ${w.title}: ${w.activeCount === 0 ? 'no active work' : `${w.activeCount} in motion`}`));
  }
  block.append(el('h3', { class: 'hq-cos__field-label label' }, 'Executive Workload'), load);

  // The Creative Director's standing — what the Chair has taken up (Sprint 12D).
  const cd = creativeStanding(loadRecommendations());
  const cdParts: string[] = [];
  if (cd.awaiting) cdParts.push(`${cd.awaiting} awaiting`);
  if (cd.accepted) cdParts.push(`${cd.accepted} accepted`);
  if (cd.inProgress) cdParts.push(`${cd.inProgress} in progress`);
  if (cd.clarification) cdParts.push(`${cd.clarification} needing clarification`);
  if (cd.completed) cdParts.push(`${cd.completed} complete`);
  if (cdParts.length > 0) {
    block.append(
      el('h3', { class: 'hq-cos__field-label label' }, 'Creative Director'),
      el('p', { class: 'hq-cos__line' }, cdParts.join(' · ')));
  }

  // The Head of Production's standing (Sprint 12E).
  const hp = productionStanding(loadRecommendations());
  const hpParts: string[] = [];
  if (hp.awaiting) hpParts.push(`${hp.awaiting} awaiting acceptance`);
  if (hp.accepted) hpParts.push(`${hp.accepted} accepted`);
  if (hp.planning) hpParts.push(`${hp.planning} planning`);
  if (hp.ready) hpParts.push(`${hp.ready} ready`);
  if (hp.inProduction) hpParts.push(`${hp.inProduction} in production`);
  if (hp.blocked) hpParts.push(`${hp.blocked} blocked`);
  if (hp.clarification) hpParts.push(`${hp.clarification} needing clarification`);
  if (hp.deliveryReady) hpParts.push(`${hp.deliveryReady} delivery ready`);
  if (hp.complete) hpParts.push(`${hp.complete} complete`);
  if (hpParts.length > 0) {
    block.append(
      el('h3', { class: 'hq-cos__field-label label' }, 'Head of Production'),
      el('p', { class: 'hq-cos__line' }, hpParts.join(' · ')));
  }

  // The Director of Growth's standing (Sprint 12F).
  const gr = growthStanding(loadRecommendations());
  const grParts: string[] = [];
  if (gr.awaiting) grParts.push(`${gr.awaiting} awaiting acceptance`);
  if (gr.accepted) grParts.push(`${gr.accepted} accepted`);
  if (gr.strategy) grParts.push(`${gr.strategy} in strategy`);
  if (gr.research) grParts.push(`${gr.research} in research`);
  if (gr.campaignPlanning) grParts.push(`${gr.campaignPlanning} planning campaigns`);
  if (gr.readyToLaunch) grParts.push(`${gr.readyToLaunch} ready to launch`);
  if (gr.active) grParts.push(`${gr.active} active`);
  if (gr.measuring) grParts.push(`${gr.measuring} measuring results`);
  if (gr.blocked) grParts.push(`${gr.blocked} blocked`);
  if (gr.clarification) grParts.push(`${gr.clarification} needing clarification`);
  if (gr.complete) grParts.push(`${gr.complete} complete`);
  if (grParts.length > 0) {
    block.append(
      el('h3', { class: 'hq-cos__field-label label' }, 'Director of Growth'),
      el('p', { class: 'hq-cos__line' }, grParts.join(' · ')));
  }

  return block;
}

/* --- 1b. THE EXECUTIVE WORK QUEUE — one projection of "what needs attention"
   (Sprint 13F). A DERIVED, read-only view over every pipeline store — it owns no
   record and stores nothing. Cards navigate to the owning surface; nothing is
   edited here. Filters are held at module scope so they survive the repaint. */
let workQueueFilter: QueueFilter = {};

function cosWorkQueue(repaint: () => void): HTMLElement {
  const all = loadWorkQueue();
  const active = activeQueue(all);
  const shown = filterQueue(all, workQueueFilter);

  const section = el('div', { class: 'hq-cos__section' },
    cosIntro('Work Queue', 'One honest view of what requires attention now, derived across the House. Every card links to where the work lives — nothing is edited here.'));

  // Filters — quiet chips; a projection, not a search engine.
  const filters = el('div', { class: 'hq-wq__filters', role: 'group', 'aria-label': 'Filter the work queue' });
  const chip = (label: string, active2: boolean, apply: () => void): void => {
    const b = el('button', { class: 'hq-wq__chip', type: 'button', 'aria-pressed': active2 ? 'true' : 'false' }, label) as HTMLButtonElement;
    b.addEventListener('click', () => { apply(); repaint(); });
    filters.append(b);
  };
  chip('All', Object.keys(workQueueFilter).length === 0, () => { workQueueFilter = {}; });
  chip('Needs Founder', !!workQueueFilter.needsFounder, () => { workQueueFilter = { needsFounder: true }; });
  chip('Waiting', !!workQueueFilter.waiting, () => { workQueueFilter = { waiting: true }; });
  chip('Completed', !!workQueueFilter.completed, () => { workQueueFilter = { completed: true }; });
  section.append(filters);

  // Office filter (derived offices) + owner filter — native selects, labelled.
  const officeSel = el('select', { class: 'hq-cos__select', id: 'wq_office', 'aria-label': 'Filter by office' }) as HTMLSelectElement;
  officeSel.append(el('option', { value: '' }, 'Any office'));
  for (const o of QUEUE_OFFICES.filter((x) => x.id !== 'hidden')) officeSel.append(el('option', { value: o.id, ...(workQueueFilter.office === o.id ? { selected: 'selected' } : {}) }, o.label));
  officeSel.addEventListener('change', () => { workQueueFilter = { ...clearedExclusive(), office: (officeSel.value || undefined) as QueueOffice | undefined }; repaint(); });
  const prioSel = el('select', { class: 'hq-cos__select', id: 'wq_prio', 'aria-label': 'Filter by priority' }) as HTMLSelectElement;
  prioSel.append(el('option', { value: '' }, 'Any priority'));
  for (const p of QUEUE_PRIORITIES) prioSel.append(el('option', { value: p.id, ...(workQueueFilter.priority === p.id ? { selected: 'selected' } : {}) }, p.label));
  prioSel.addEventListener('change', () => { workQueueFilter = { ...workQueueFilter, priority: (prioSel.value || undefined) as QueuePriority | undefined }; repaint(); });
  const ownerSel = el('select', { class: 'hq-cos__select', id: 'wq_owner', 'aria-label': 'Filter by owner' }) as HTMLSelectElement;
  ownerSel.append(el('option', { value: '' }, 'Any owner'));
  for (const o of queueOwners(all)) ownerSel.append(el('option', { value: o, ...(workQueueFilter.owner === o ? { selected: 'selected' } : {}) }, o));
  ownerSel.addEventListener('change', () => { workQueueFilter = { ...workQueueFilter, owner: ownerSel.value || undefined }; repaint(); });
  section.append(el('div', { class: 'hq-research__row' },
    deskField('wq_office', 'Office', officeSel), deskField('wq_prio', 'Priority', prioSel), deskField('wq_owner', 'Owner', ownerSel)));

  section.append(el('p', { class: 'hq-cos__line' }, `${active.length} active · ${shown.length} shown`));

  if (shown.length === 0) {
    section.append(el('p', { class: 'hq-cos__quiet' }, 'Nothing matches — the House is quiet, or your filter is narrow.'));
  } else {
    const list = el('div', { class: 'hq-cos__decisions' });
    for (const it of shown) list.append(workQueueCard(it));
    section.append(list);
  }
  return section;
}

/** Reset the exclusive (single-choice) filters when switching to an office filter. */
function clearedExclusive(): QueueFilter {
  const { priority, owner } = workQueueFilter;
  return { priority, owner };
}

function workQueueCard(it: QueueItem): HTMLElement {
  const provChain = [
    it.provenance.intelId && 'Intel', it.provenance.opportunityId && 'Opportunity', it.provenance.assignmentId && 'Assignment',
    it.provenance.draftId && 'Draft', it.provenance.productionId && 'Production', it.provenance.recommendationId && 'Recommendation',
  ].filter(Boolean).join(' → ');
  const card = el('article', { class: 'hq-cos__decision hq-wq__card' });
  card.append(
    el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__decision-title' }, it.title),
      el('span', { class: 'hq-cos__tag label', 'data-status': it.priority }, `${queuePriorityLabel(it.priority)}`)),
    el('p', { class: 'hq-cos__decision-summary' }, `${queueOfficeLabel(it.office)} · ${it.owner} · ${it.summary}`),
    el('p', { class: 'hq-wq__action' }, el('span', { class: 'label' }, 'Needs'), ` ${it.requiredAction}`),
  );
  if (provChain) card.append(el('p', { class: 'hq-wq__prov' }, el('span', { class: 'label' }, 'Provenance'), ` ${provChain}`));
  card.append(el('a', { class: 'hq-cos__more', href: it.route }, 'Go to the work →'));
  return card;
}

/* --- 1c. Executive Inbox — the institution's single front door -------------
   Founder-facing capture (record work → a tracked institutional record) plus the
   Chief of Staff's working queue. Built entirely on the Sprint 12A operational
   engine; client-side persistence, honest empty states, nothing fabricated. */
function cosInbox(repaint: () => void): HTMLElement {
  const recs = loadRecommendations();
  return el('div', { class: 'hq-cos__section' },
    cosIntro('Executive Inbox',
      'The one front door for executive work. Record a thought and the House takes it up — nothing lives only in your memory.'),
    cosInboxCapture(repaint),
    cosInboxQueue(recs, repaint),
  );
}

/** The Founder's capture — fast, calm, editorial. A few fields, then recorded. */
function cosInboxCapture(repaint: () => void): HTMLElement {
  const typeSel = el('select', { class: 'hq-cos__input', id: 'inbox-type' }) as HTMLSelectElement;
  for (const t of SUBMISSION_TYPES) typeSel.append(el('option', { value: t.id }, t.label));

  const titleInput = el('input', {
    class: 'hq-cos__note-input', id: 'inbox-title', type: 'text', maxlength: '120',
    placeholder: 'A short title — what is it?',
  }) as HTMLInputElement;

  const descInput = el('textarea', {
    class: 'hq-cos__note-input', id: 'inbox-desc', rows: '3', maxlength: '600',
    placeholder: 'Describe it in your own words (optional).',
  }) as HTMLTextAreaElement;

  const prioSel = el('select', { class: 'hq-cos__input', id: 'inbox-priority' }) as HTMLSelectElement;
  for (const p of PRIORITIES) {
    const o = el('option', { value: p.id }, p.label);
    if (p.id === 'next') o.setAttribute('selected', 'selected');
    prioSel.append(o);
  }

  const assignSel = el('select', { class: 'hq-cos__input', id: 'inbox-assign' }) as HTMLSelectElement;
  assignSel.append(el('option', { value: '' }, 'Unassigned — I’ll route it'));
  for (const c of EXECUTIVE_CHAIRS) {
    assignSel.append(el('option', { value: c.id }, `Chair #${String(c.ordinal).padStart(3, '0')} — ${c.title}`));
  }

  const feedback = el('p', { class: 'hq-cos__quiet', role: 'status', 'aria-live': 'polite' });

  const field = (labelText: string, forId: string, control: HTMLElement): HTMLElement =>
    el('div', { class: 'hq-cos__field' },
      el('label', { class: 'hq-cos__field-label label', for: forId }, labelText),
      control);

  const submit = el('button', { class: 'hq-cos__response', type: 'button' },
    'Record for the Council') as HTMLButtonElement;
  submit.addEventListener('click', () => {
    const title = titleInput.value.trim();
    if (!title) { feedback.textContent = 'Add a short title, and it is recorded.'; titleInput.focus(); return; }
    const id = `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const sub = makeSubmission({
      id,
      type: typeSel.value as SubmissionType,
      title,
      description: descInput.value,
      priority: prioSel.value as Priority,
      ownerChairId: assignSel.value || null,
    });
    if (!sub) { feedback.textContent = 'That could not be recorded — please try again.'; return; }
    saveRecommendations(upsertRecommendation(loadRecommendations(), sub));
    repaint();
  });

  return el('section', { class: 'hq-cos__block hq-cos__inbox-capture' },
    el('h2', { class: 'hq-cos__block-title' }, 'Record Something'),
    field('Type', 'inbox-type', typeSel),
    field('Title', 'inbox-title', titleInput),
    field('Description', 'inbox-desc', descInput),
    field('Priority', 'inbox-priority', prioSel),
    field('Route to (optional)', 'inbox-assign', assignSel),
    el('div', { class: 'hq-cos__responses' }, submit),
    feedback,
  );
}

/** The Chief of Staff's working queue — active submissions in priority order. */
function cosInboxQueue(recs: Recommendation[], repaint: () => void): HTMLElement {
  const queue = chiefOfStaffQueue(recs);
  const block = el('section', { class: 'hq-cos__block' },
    el('h2', { class: 'hq-cos__block-title' }, 'The Working Queue'));

  if (queue.length === 0) {
    block.append(el('p', { class: 'hq-cos__quiet' },
      'Nothing is in the queue yet. What you record above appears here — tracked, owned, and never lost.'));
    return block;
  }

  const list = el('div', { class: 'hq-cos__decisions' });
  for (const r of queue) list.append(cosInboxCard(r, repaint));
  block.append(list);
  return block;
}

/** One submission in the queue, with the Chief of Staff's coordination controls. */
function cosInboxCard(r: Recommendation, repaint: () => void): HTMLElement {
  const card = el('article', { class: 'hq-cos__decision' });
  const persist = (next: Recommendation): void => {
    saveRecommendations(upsertRecommendation(loadRecommendations(), next));
    repaint();
  };

  card.append(
    el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__decision-title' }, r.title),
      el('span', { class: 'hq-cos__tag label', 'data-status': r.priority }, priorityLabel(r.priority))),
    el('p', { class: 'hq-cos__decision-summary' },
      `${recTypeLabel(r)} · ${ownerLabel(r)} · ${recStatusLabel(r.status)} · ${triageStateLabel(r)} · ${visibilityLabel(r.visibility)}`),
  );
  if (r.summary) card.append(el('p', { class: 'hq-cos__field-body' }, r.summary));

  // Route to a Chair (validated by the engine against the Register).
  const assign = el('select', { class: 'hq-cos__input', 'aria-label': `Route “${r.title}” to a Chair` }) as HTMLSelectElement;
  const unassigned = el('option', { value: '' }, 'Unassigned');
  if (r.ownerChairId === null) unassigned.setAttribute('selected', 'selected');
  assign.append(unassigned);
  for (const c of EXECUTIVE_CHAIRS) {
    const o = el('option', { value: c.id }, c.title);
    if (r.ownerChairId === c.id) o.setAttribute('selected', 'selected');
    assign.append(o);
  }
  assign.addEventListener('change', () => persist(routeRecommendation(r, assign.value || null)));
  card.append(el('div', { class: 'hq-cos__field' },
    el('span', { class: 'hq-cos__field-label label' }, 'Route to'), assign));

  // Contextual coordination, by where the item sits in the loop.
  if (r.status === 'awaiting_founder') {
    card.append(el('p', { class: 'hq-cos__quiet' }, 'With the Founder — awaiting her decision.'),
      el('a', { class: 'hq-cos__more', href: '#/chief-of-staff/decisions' }, 'See it in Decisions →'));
  } else if (r.status === 'decided' || r.status === 'executing') {
    card.append(cosFollowUpControls(r, persist));
  } else if (r.status === 'preparing' && r.triage === 'prepare') {
    card.append(cosPrepForm(r, persist));
    card.append(cosTriageRow(r, assign, persist, 'Re-triage'));
  } else {
    // Untriaged incoming work, or a held item awaiting a fresh decision.
    card.append(cosTriageRow(r, assign, persist, 'Triage'));
  }

  // Visibility — keep it on the Founder's radar, or hold it internally.
  const nextVis = r.visibility === 'visible' ? 'internal' : 'visible';
  const visBtn = el('button', { class: 'hq-cos__withdraw', type: 'button' },
    r.visibility === 'visible' ? 'Hold internally' : 'Put on the Founder’s radar') as HTMLButtonElement;
  visBtn.addEventListener('click', () => persist(setVisibility(r, nextVis)));
  card.append(visBtn);

  return card;
}

/** The five triage outcomes — the Chief of Staff decides what happens next. */
function cosTriageRow(
  r: Recommendation, assign: HTMLSelectElement, persist: (n: Recommendation) => void, heading: string,
): HTMLElement {
  const row = el('div', { class: 'hq-cos__field' },
    el('span', { class: 'hq-cos__field-label label' }, heading));
  const group = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': `Triage “${r.title}”` });
  for (const t of TRIAGE_OUTCOMES) {
    const btn = el('button', { class: 'hq-cos__response', type: 'button' }, t.label) as HTMLButtonElement;
    btn.addEventListener('click', () =>
      persist(triage(r, t.id as TriageOutcome, { ownerChairId: assign.value || null })));
    group.append(btn);
  }
  row.append(group);
  return row;
}

/** The Chief of Staff's preparation surface — turn the item into a decision-ready
    brief. Only the recommended direction and the decision requested are required. */
function cosPrepForm(r: Recommendation, persist: (n: Recommendation) => void): HTMLElement {
  const p = r.preparation;
  const ta = (id: string, label: string, val: string, ph: string, rows = '2'): [HTMLElement, HTMLTextAreaElement] => {
    const t = el('textarea', { class: 'hq-cos__note-input', id, rows, maxlength: '600', placeholder: ph }) as HTMLTextAreaElement;
    if (val) t.value = val;
    return [el('div', { class: 'hq-cos__field' }, el('label', { class: 'hq-cos__field-label label', for: id }, label), t), t];
  };
  const uid = r.id.replace(/[^a-z0-9]/gi, '');
  const [issueF, issue] = ta(`p-issue-${uid}`, 'Issue', p?.issue ?? '', 'The issue, concisely.');
  const [ctxF, ctx] = ta(`p-ctx-${uid}`, 'Context', p?.context ?? '', 'Relevant context.');
  const [recF, recIn] = ta(`p-rec-${uid}`, 'Recommended direction (required)', p?.recommendation ?? '', 'What you recommend.');
  const [altF, alt] = ta(`p-alt-${uid}`, 'Alternatives (one per line)', (p?.alternatives ?? []).join('\n'), 'Meaningful alternatives, if any.');
  const [toF, to] = ta(`p-to-${uid}`, 'Risks / trade-offs (one per line)', (p?.tradeoffs ?? []).join('\n'), 'What is given up or risked.');
  const [drF, dr] = ta(`p-dr-${uid}`, 'Decision requested (required)', p?.decisionRequested ?? '', 'The one decision you need.');

  const feedback = el('p', { class: 'hq-cos__quiet', role: 'status', 'aria-live': 'polite' });
  const lines = (s: string): string[] => s.split('\n').map((x) => x.trim()).filter(Boolean);

  const save = el('button', { class: 'hq-cos__response', type: 'button' }, 'Save preparation') as HTMLButtonElement;
  const present = el('button', { class: 'hq-cos__response', type: 'button' }, 'Present to the Founder') as HTMLButtonElement;

  const build = (): Recommendation | null => prepareRecommendation(r, {
    issue: issue.value, context: ctx.value, recommendation: recIn.value,
    alternatives: lines(alt.value), tradeoffs: lines(to.value), decisionRequested: dr.value,
  });
  save.addEventListener('click', () => {
    const next = build();
    if (!next) { feedback.textContent = 'A recommended direction and a decision requested are needed.'; return; }
    persist(next);
  });
  present.addEventListener('click', () => {
    const next = build();
    if (!next) { feedback.textContent = 'A recommended direction and a decision requested are needed.'; return; }
    persist(presentToFounder(next));
  });

  return el('div', { class: 'hq-cos__field' },
    el('p', { class: 'hq-cos__field-label label' }, 'Prepare the Decision'),
    issueF, ctxF, recF, altF, toF, drF,
    el('div', { class: 'hq-cos__responses' }, save, present),
    feedback);
}

/** Execution follow-up — the Chief of Staff tracks approved work to completion. */
function cosFollowUpControls(r: Recommendation, persist: (n: Recommendation) => void): HTMLElement {
  const wrap = el('div', { class: 'hq-cos__field' },
    el('span', { class: 'hq-cos__field-label label' }, 'Execution follow-up'));
  const group = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': `Follow up on “${r.title}”` });

  if (r.status === 'decided') {
    const begin = el('button', { class: 'hq-cos__response', type: 'button' }, 'Begin execution') as HTMLButtonElement;
    begin.addEventListener('click', () => persist(advance(r, 'executing')));
    group.append(begin);
  }
  const complete = el('button', { class: 'hq-cos__response', type: 'button' }, 'Mark complete') as HTMLButtonElement;
  complete.addEventListener('click', () => persist(advance(r, 'complete')));
  group.append(complete);

  const block = el('button', { class: 'hq-cos__response', type: 'button', 'aria-pressed': r.blocked ? 'true' : 'false' },
    r.blocked ? 'Unblock' : 'Mark blocked') as HTMLButtonElement;
  block.addEventListener('click', () => persist(setBlocked(r, !r.blocked)));
  group.append(block);

  wrap.append(group);
  if (r.blocked) wrap.append(el('p', { class: 'hq-cos__quiet' }, 'Blocked — needs attention before it can move.'));
  return wrap;
}

/* --- 2. Decision System (interactive record) ------------------------------ */

/* --- 2. Decision System (interactive record) ------------------------------ */
function cosDecisions(repaint: () => void): HTMLElement {
  const responses = loadResponses();
  const views = decisionViews(DECISIONS, responses);

  const list = el('div', { class: 'hq-cos__decisions' });
  for (const v of views) list.append(cosDecisionCard(v, repaint));

  return el('div', { class: 'hq-cos__section' },
    cosIntro('Decisions', 'Each is prepared with a recommendation and the thinking behind it. Give your word when you are ready; your answer is kept.'),
    cosFounderDecisions(repaint),
    list);
}

/** The Founder's prepared operational decisions — only items the Chief of Staff
    has prepared and presented reach her here. She responds once; the same record
    carries her answer forward (no duplicate decision record is created). */
function cosFounderDecisions(repaint: () => void): HTMLElement {
  const ready = decisionsForFounder(loadRecommendations());
  const block = el('section', { class: 'hq-cos__block' },
    el('h2', { class: 'hq-cos__block-title' }, 'Prepared for You'));
  if (ready.length === 0) {
    block.append(el('p', { class: 'hq-cos__quiet' },
      'Nothing is ready for your decision right now. When the Chief of Staff prepares one, it appears here.'));
    return block;
  }
  const list = el('div', { class: 'hq-cos__decisions' });
  for (const r of ready) list.append(cosPreparedDecisionCard(r, repaint));
  block.append(list);
  return block;
}

function cosPreparedDecisionCard(r: Recommendation, repaint: () => void): HTMLElement {
  const p = r.preparation!;
  const persist = (next: Recommendation): void => {
    saveRecommendations(upsertRecommendation(loadRecommendations(), next));
    repaint();
  };
  const card = el('article', { class: 'hq-cos__decision' });
  card.append(
    el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__decision-title' }, r.title),
      el('span', { class: 'hq-cos__tag label', 'data-status': r.priority }, priorityLabel(r.priority))),
    el('p', { class: 'hq-cos__decision-summary' }, `${recTypeLabel(r)} · ${ownerLabel(r)} · prepared ${formatWhen(p.preparedAt)}`),
  );
  if (p.issue) card.append(cosField('Issue', p.issue));
  if (p.context) card.append(cosField('Context', p.context));
  card.append(cosField('Recommendation', p.recommendation));
  if (p.alternatives.length) {
    const ul = el('ul', { class: 'hq-cos__tradeoffs' });
    for (const a of p.alternatives) ul.append(el('li', {}, a));
    card.append(el('div', { class: 'hq-cos__field' }, el('p', { class: 'hq-cos__field-label label' }, 'Alternatives'), ul));
  }
  if (p.tradeoffs.length) {
    const ul = el('ul', { class: 'hq-cos__tradeoffs' });
    for (const t of p.tradeoffs) ul.append(el('li', {}, t));
    card.append(el('div', { class: 'hq-cos__field' }, el('p', { class: 'hq-cos__field-label label' }, 'Risks / trade-offs'), ul));
  }
  card.append(cosField('Decision requested', p.decisionRequested));

  const noteId = `fnote_${r.id.replace(/[^a-z0-9]/gi, '')}`;
  const note = el('input', {
    class: 'hq-cos__note-input', id: noteId, type: 'text', maxlength: '200',
    placeholder: 'Add a note (optional)',
  }) as HTMLInputElement;
  card.append(el('div', { class: 'hq-cos__note-field' },
    el('label', { class: 'hq-cos__note-input-label label', for: noteId }, 'Your note'), note));

  const controls = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': `Your response to “${r.title}”` });
  const respond = (label: string, fn: () => Recommendation): void => {
    const b = el('button', { class: 'hq-cos__response', type: 'button' }, label) as HTMLButtonElement;
    b.addEventListener('click', () => persist(fn()));
    controls.append(b);
  };
  respond('Approve', () => recordFounderDecision(r, 'approved', note.value));
  respond('Decline', () => recordFounderDecision(r, 'declined', note.value));
  respond('Defer', () => recordFounderDecision(r, 'deferred', note.value));
  respond('Request Revision', () => requestRevision(r, note.value));
  card.append(controls);
  return card;
}

function cosDecisionCard(v: DecisionView, repaint: () => void): HTMLElement {
  const d = v.decision;
  const recorded = v.response ? getResponse(v.response.response) : null;

  const card = el('article', {
    class: 'hq-cos__decision',
    ...(v.archived ? { 'data-archived': 'true' } : {}),
  });

  card.append(
    el('h3', { class: 'hq-cos__decision-title' }, d.title),
    el('p', { class: 'hq-cos__decision-summary' }, d.summary),
    cosField('Recommendation', d.recommendation),
    cosField('Reasoning', d.reasoning),
  );

  const tradeList = el('ul', { class: 'hq-cos__tradeoffs' });
  for (const t of d.tradeOffs) tradeList.append(el('li', {}, t));
  card.append(el('div', { class: 'hq-cos__field' },
    el('p', { class: 'hq-cos__field-label label' }, 'Trade-offs'),
    tradeList));

  card.append(cosField('Requested of you', d.requestedAction));

  // The recorded answer (if any), shown back plainly before the controls.
  const status = el('p', { class: 'hq-cos__decision-status' });
  if (recorded && v.response) {
    status.classList.add('is-answered');
    const when = formatWhen(v.response.respondedAt);
    status.append(
      el('span', { class: 'hq-cos__answer-label' }, `Your answer: ${recorded.label}`),
      el('span', { class: 'hq-cos__answer-echo' }, `${recorded.echo}${when ? ` · ${when}` : ''}`),
    );
    if (v.response.note) {
      status.append(el('span', { class: 'hq-cos__answer-note' }, `“${v.response.note}”`));
    }
  } else {
    status.append(el('span', { class: 'hq-cos__answer-label hq-cos__answer-label--awaiting' },
      'Awaiting your decision'));
  }
  card.append(status);

  // Optional note — captured with whichever response the Founder gives next.
  const noteId = `note_${d.id}`;
  const noteInput = el('input', {
    class: 'hq-cos__note-input',
    id: noteId,
    type: 'text',
    maxlength: '160',
    placeholder: 'Add a note (optional) — e.g. the change you would make',
    ...(v.response?.note ? { value: v.response.note } : {}),
  }) as HTMLInputElement;
  card.append(el('div', { class: 'hq-cos__note-field' },
    el('label', { class: 'hq-cos__note-input-label label', for: noteId }, 'Your note'),
    noteInput));

  // The six responses. The recorded one is marked; choosing any records it.
  const controls = el('div', { class: 'hq-cos__responses', role: 'group',
    'aria-label': `Your response to “${d.title}”` });
  for (const r of RESPONSES) {
    const chosen = v.response?.response === r.id;
    const btn = el('button', {
      class: 'hq-cos__response',
      type: 'button',
      'aria-pressed': chosen ? 'true' : 'false',
    }, r.label) as HTMLButtonElement;
    btn.addEventListener('click', () => {
      const made = makeResponse({ decisionId: d.id, response: r.id, note: noteInput.value });
      if (!made) return;
      saveResponses(recordResponse(loadResponses(), made));
      repaint();
    });
    controls.append(btn);
  }
  card.append(controls);

  // Withdraw — return the decision to waiting, keeping nothing.
  if (v.response) {
    const withdraw = el('button', { class: 'hq-cos__withdraw', type: 'button' },
      'Withdraw this answer') as HTMLButtonElement;
    withdraw.addEventListener('click', () => {
      saveResponses(clearResponse(loadResponses(), d.id));
      repaint();
    });
    card.append(withdraw);
  }

  return card;
}

/** A labelled field: a small label over a line of prepared prose. */
function cosField(label: string, body: string): HTMLElement {
  return el('div', { class: 'hq-cos__field' },
    el('p', { class: 'hq-cos__field-label label' }, label),
    el('p', { class: 'hq-cos__field-body' }, body));
}

/** A labelled field whose body is a list of lines (reuses the field label style). */
function cosLines(label: string, xs: string[]): HTMLElement {
  const list = el('ul', { class: 'hq-cos__lines' });
  for (const x of xs) list.append(el('li', { class: 'hq-cos__line' }, x));
  return el('div', { class: 'hq-cos__field' },
    el('p', { class: 'hq-cos__field-label label' }, label), list);
}

/* --- 3. Docket ------------------------------------------------------------ */
let initiativeNotice: string | null = null;

/* --- Bring an Initiative — the Founder's front door ----------------------- *
   The Founder brings an idea, opportunity, problem, or decision in their own
   words. The Chief of Staff conducts: the Executive Team coordinates and the
   Founder receives ONE Executive Brief, then makes ONE decision. Approval routes
   work into the offices; completion proposes how it enters institutional
   history. The Founder never picks an executive, office, or platform. */
function cosInitiatives(repaint: () => void): HTMLElement {
  const view = el('div', { class: 'hq-cos__section' });
  view.append(cosIntro('Bring an Initiative',
    'Tell the House what happened or what you have in mind. The Executive Team will organise it and bring you one recommendation.'));

  // A show-once confirmation line, in the House's notice style.
  if (initiativeNotice) {
    const notice = el('p', { class: 'hq-cos__notice is-ok', role: 'status' });
    notice.append(el('span', { class: 'hq-cos__notice-mark', 'aria-hidden': 'true' }, '✓'), el('span', {}, initiativeNotice));
    view.append(notice);
    initiativeNotice = null;
  }

  const persist = (next: Initiative, note?: string) => {
    saveInitiatives(upsertInitiative(loadInitiatives(), next));
    initiativeNotice = note ?? null;
    repaint();
  };

  // --- the House's one institutional voice: a single attention panel, derived
  // across every initiative. The Chief of Staff speaks; the Founder is told when
  // she is needed and, just as clearly, when she is not.
  const initiatives = loadInitiatives().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (initiatives.length > 0) view.append(attentionPanel(houseAttention(initiatives)));

  // --- intake: the Founder's single act ---
  const intake = el('section', { class: 'hq-cos__block hq-cos__intake' },
    el('h2', { class: 'hq-cos__block-title' }, 'What would you like to bring in?'));
  const input = el('textarea', {
    class: 'hq-research__textarea', id: 'initiative_input', rows: '4', maxlength: '1200',
    placeholder: 'e.g. I went to a book signing yesterday, met another creator, and someone complimented my narration voice. I’d like to turn this into content.',
  }) as HTMLTextAreaElement;
  const open = el('button', { class: 'hq-cos__response', type: 'button' }, 'Bring it to the House') as HTMLButtonElement;
  open.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) { initiativeNotice = 'Add a line first — anything at all.'; repaint(); return; }
    persist(openInitiative(text), 'The Executive Team has prepared your Brief.');
  });
  intake.append(input, el('div', { class: 'hq-cos__responses' }, open));
  view.append(intake);

  // --- two calm modes: matters in motion, then the institutional record ---
  if (initiatives.length === 0) {
    view.append(el('p', { class: 'hq-cos__quiet' },
      'Nothing brought in yet. When you do, the House organises it and returns one Brief here.'));
    return view;
  }

  const { active, record } = partitionInitiatives(initiatives);
  for (const i of active) view.append(initiativeCard(i, persist));
  if (record.length > 0) view.append(houseRegister(record));
  return view;
}

const DECISION_WORD: Record<FounderDecision, string> = {
  approve: 'Approved', revise: 'Revision requested', pause: 'Paused', decline: 'Declined',
};

/** The House Register — completed and closed matters, kept as the institutional
    record. A calm bound register, not an audit log: each matter opens into its
    whole story, in reading order. */
function houseRegister(records: Initiative[]): HTMLElement {
  const section = el('section', { class: 'hq-cos__register', 'aria-label': 'The House Register' },
    el('p', { class: 'hq-cos__eyebrow label' }, 'The House Register'),
    el('p', { class: 'hq-cos__quiet' }, 'Completed and closed matters, kept as the House’s institutional record.'));
  for (const i of records) section.append(initiativeRecordView(i));
  return section;
}

/** One matter as an institutional record — direction, recommendation, decision,
    responsibility, chronology, outcome, and current disposition, in one place. */
function initiativeRecordView(i: Initiative): HTMLElement {
  const r = initiativeRecord(i);
  const rec = el('details', { class: 'hq-cos__record' });
  rec.append(el('summary', { class: 'hq-cos__record-summary' },
    el('span', { class: 'hq-cos__record-title' }, r.title),
    el('span', { class: 'hq-cos__record-meta' }, `${r.status} · ${formatWhen(i.completedAt ?? i.archivedAt ?? i.updatedAt)}`)));

  rec.append(cosField('You brought to the House', r.direction));
  rec.append(cosField('The Executive Team recommended', i.brief.purpose));
  if (i.brief.recommendedDeliverables.length) rec.append(cosLines('Prepared', i.brief.recommendedDeliverables));
  if (i.decision) rec.append(cosField('Your decision', `${DECISION_WORD[i.decision.decision]} · ${formatWhen(i.decision.at)}`));
  if (r.responsibilities.length) rec.append(cosField('Responsibility held by',
    r.responsibilities.map((x) => executiveLabel(x.executive)).join(' · ')));

  // The chronology — an editorial register of how the matter moved.
  const ol = el('ol', { class: 'hq-cos__history-list' });
  for (const e of r.timeline) ol.append(el('li', { class: 'hq-cos__history-item' },
    el('span', { class: 'hq-cos__history-when' }, formatWhen(e.at)),
    el('span', {}, timelineEventLine(e))));
  rec.append(el('div', { class: 'hq-cos__record-chronology' },
    el('p', { class: 'hq-cos__field-label label' }, 'How it moved'), ol));

  if (r.outcome) rec.append(cosField('Outcome', r.outcome));
  const disp = r.disposition ? HISTORY_DISPOSITIONS.find((h) => h.id === r.disposition)?.label : undefined;
  rec.append(cosField('The House considers this', disp ? `In its history as ${disp}` : r.status));
  return rec;
}

/** The House's single institutional attention — one calm line, never a
    notification centre. `data-state` lets the surface carry a quiet brass accent
    when the Founder is genuinely needed; nothing here alarms. */
function attentionPanel(house: HouseAttention): HTMLElement {
  const panel = el('section', { class: 'hq-cos__attention', 'data-state': house.state, 'aria-live': 'polite' },
    el('p', { class: 'hq-cos__attention-eyebrow label' }, 'The House'),
    el('p', { class: 'hq-cos__attention-line' }, house.kind.line));
  // Name the matter under judgment, so the one voice stays specific — but only
  // when the Founder is actually needed (never for quiet, working states).
  if (house.kind.interrupts && house.driving.length > 0) {
    const titles = house.driving.map((i) => i.title).join(' · ');
    panel.append(el('p', { class: 'hq-cos__attention-subject' }, titles));
  }
  return panel;
}

/** One initiative: the assembled Executive Brief, the Founder's one decision,
    and — once approved — execution and its entry into institutional history. */
function initiativeCard(i: Initiative, persist: (next: Initiative, note?: string) => void): HTMLElement {
  const card = el('article', { class: 'hq-cos__card' });
  const team = i.participants.map((p) => executiveLabel(p)).join(' · ');

  // The executive transition — answered before anything else: the House
  // coordinated its team, finished its work, and now awaits the Founder's word.
  if (i.status === 'brief_ready') {
    card.append(el('div', { class: 'hq-cos__handoff' },
      el('p', { class: 'hq-cos__handoff-eyebrow label' }, 'The Chief of Staff coordinated the Executive Team'),
      el('p', { class: 'hq-cos__handoff-title' }, 'The Executive Team has completed its recommendation — for your review.'),
      el('p', { class: 'hq-cos__handoff-team' }, team)));
    card.append(el('h3', { class: 'hq-cos__card-title' }, i.title));
  } else {
    card.append(el('p', { class: 'hq-cos__eyebrow label' }, `Initiative · ${statusLabel(i.status)}`));
    card.append(el('h3', { class: 'hq-cos__card-title' }, i.title));
    // Held states — a single calm line; no re-litigating the recommendation.
    if (i.status === 'revising' || i.status === 'paused' || i.status === 'declined') {
      const note = i.status === 'revising' ? 'Sent back to the Executive Team for a fresh recommendation.'
        : i.status === 'paused' ? 'Paused at your word — nothing will move until you return.'
        : 'Declined — the House has let it rest.';
      card.append(el('p', { class: 'hq-cos__execution-close' }, note));
    }
  }

  // The ONE Brief — the eight prepared sections, shown only while the Founder is
  // deciding. After approval the card leads with execution, not the plan again.
  if (i.status === 'brief_ready') {
    const b = i.brief;
    const brief = el('section', { class: 'hq-cos__block' },
      el('h4', { class: 'hq-cos__field-label label' }, 'Your Executive Brief'));
    const line = (label: string, value: string) => brief.append(cosField(label, value));
    const lines = (label: string, xs: string[]) => { if (xs.length) brief.append(cosLines(label, xs)); };
    line('Purpose', b.purpose);
    lines('Recommended Deliverables', b.recommendedDeliverables);
    line('Priority', b.priority === 'high' ? 'High — the moment is fresh' : 'Normal');
    line('Suggested Timeline', b.suggestedTimeline);
    lines('Recommended Platforms', b.recommendedPlatforms);
    lines('Required Founder Decisions', b.requiredFounderDecisions);
    lines('Dependencies', b.dependencies);
    lines('Next Actions', b.nextActions);
    card.append(brief);
  }

  // The Founder's one decision — the conclusion of the recommendation, set apart
  // by a ruled band and led by a weighted primary action so it is never hunted for.
  if (i.status === 'brief_ready') {
    const bar = el('div', { class: 'hq-cos__decision-bar' },
      el('p', { class: 'hq-cos__decision-cue label' }, 'Your decision'));
    const acts = el('div', { class: 'hq-cos__responses' });
    const act = (label: string, decision: FounderDecision, note: string, primary = false) => {
      const btn = el('button', { class: primary ? 'hq-cos__response hq-cos__response--primary' : 'hq-cos__response', type: 'button' }, label) as HTMLButtonElement;
      btn.addEventListener('click', () => persist(decideInitiative(i, decision, undefined), note));
      acts.append(btn);
    };
    act('Approve', 'approve', 'The Executive Team has accepted your direction.', true);
    act('Revise', 'revise', 'Sent back for revision.');
    act('Pause', 'pause', 'Paused — nothing will move until you return.');
    act('Decline', 'decline', 'Declined — the House will let it rest.');
    bar.append(acts);
    card.append(bar);
  }

  // Executive Execution — the House assuming responsibility. Ownership, never
  // tasks: the Chief of Staff narrates, then each executive holds one charge.
  if (i.status === 'executing' || i.status === 'completed' || i.status === 'archived') {
    const exec = el('section', { class: 'hq-cos__execution' });
    if (i.status === 'executing') {
      exec.append(el('div', { class: 'hq-cos__handoff hq-cos__handoff--execution' },
        el('p', { class: 'hq-cos__handoff-eyebrow label' }, 'The Chief of Staff'),
        el('p', { class: 'hq-cos__handoff-title' },
          'The Executive Team has accepted your direction. The House has begun coordinating execution.'),
        el('p', { class: 'hq-cos__handoff-team' },
          'You will be notified only if additional judgment is required.')));
    } else {
      exec.append(el('p', { class: 'hq-cos__eyebrow label' }, 'Executive Execution'));
    }

    // Executive ownership — one standing responsibility per executive.
    const roster = el('ul', { class: 'hq-cos__ownership' });
    for (const r of executionResponsibilities(i)) {
      roster.append(el('li', { class: 'hq-cos__owner' },
        el('div', { class: 'hq-cos__owner-head' },
          el('p', { class: 'hq-cos__owner-name' }, executiveLabel(r.executive)),
          el('span', { class: 'hq-cos__owner-status label', 'data-done': String(r.status === 'Completed') }, r.status)),
        el('p', { class: 'hq-cos__owner-charge' }, r.responsibility)));
    }
    exec.append(roster);

    // The Founder may leave; the House continues. Completion is the House's own
    // report — a quiet, secondary control, never a task the Founder must manage.
    if (i.status === 'executing') {
      exec.append(el('p', { class: 'hq-cos__execution-close' },
        'You may leave Headquarters. The House will continue its work and return only if your judgment is needed.'));
      const complete = el('button', { class: 'hq-cos__quiet-action', type: 'button' }, 'Record the House’s completion') as HTMLButtonElement;
      complete.addEventListener('click', () => persist(completeInitiative(i), 'The House reports the work complete.'));
      exec.append(complete);
    }
    card.append(exec);
  }

  // Institutional history — the workflow proposes; the Founder confirms once.
  if (i.status === 'completed' && i.history) {
    const recommended = HISTORY_DISPOSITIONS.find((h) => h.id === i.history!.recommended)!;
    card.append(cosField('The House proposes it enter history as', recommended.label));
    const acts = el('div', { class: 'hq-cos__responses' });
    const confirm = el('button', { class: 'hq-cos__response', type: 'button' }, `Record as ${recommended.label}`) as HTMLButtonElement;
    confirm.addEventListener('click', () => persist(archiveInitiative(i, recommended.id), 'Recorded in the institutional history.'));
    const internal = el('button', { class: 'hq-cos__response', type: 'button' }, 'Keep internal') as HTMLButtonElement;
    internal.addEventListener('click', () => persist(archiveInitiative(i, 'internal'), 'Kept internal.'));
    acts.append(confirm);
    if (recommended.id !== 'internal') acts.append(internal);
    card.append(acts);
  }
  if (i.status === 'archived' && i.history?.chosen) {
    const chosen = HISTORY_DISPOSITIONS.find((h) => h.id === i.history!.chosen)!;
    card.append(cosField('In institutional history as', chosen.label));
  }
  return card;
}

/** The Founder-facing label for an initiative status. */
function statusLabel(s: Initiative['status']): string {
  const map: Record<Initiative['status'], string> = {
    brief_ready: 'Brief ready for you', approved: 'Approved', revising: 'In revision',
    paused: 'Paused', declined: 'Declined', executing: 'In execution',
    completed: 'Complete', archived: 'In institutional history',
  };
  return map[s];
}

function cosDocket(): HTMLElement {
  const list = el('div', { class: 'hq-cos__docket' });
  for (const item of DOCKET) {
    const card = el('article', { class: 'hq-cos__docket-item' },
      el('div', { class: 'hq-cos__docket-head' },
        el('h3', { class: 'hq-cos__docket-question' }, item.question),
        el('span', { class: 'hq-cos__tag label', 'data-status': item.status },
          docketStatusLabel(item.status))),
      cosField('Background', item.background),
      cosField('Recommendation', item.recommendation),
      el('p', { class: 'hq-cos__docket-owner' },
        el('span', { class: 'label' }, 'Owner'), ` ${item.owner}`));
    list.append(card);
  }
  return el('div', { class: 'hq-cos__section' },
    cosIntro('Docket', 'The active questions before the House — matters that want leadership consideration, not tasks to complete.'),
    list);
}

/* --- 3d. THE BROKERAGE — the office's collaboration desk (Sprint 12H) -------
   The Chief of Staff's surface for brokering Chair-to-Chair collaboration built on
   the 12G model: four honest queues over the pure derived views, office actions
   that only ever call the guarded collaboration functions, and a compact history
   from the append-only trail. No messaging, no new store — the office disposes.
   "The Chair proposes; the office disposes." ------------------------------- */

interface BrokerageNotice { kind: 'ok' | 'error'; text: string; }
/** The last brokerage action's outcome, shown in the section's live region. Held
    at module scope so it survives the section repaint; cleared on the next action. */
let brokerageNotice: BrokerageNotice | null = null;

/** Human, calm wording for each guard refusal — never a raw reason code. */
function collaborationDenialText(reason: CollaborationDenial): string {
  const map: Record<CollaborationDenial, string> = {
    unknown_chair: 'That Chair is not on the Register.',
    self_handoff: 'A Chair cannot hand work to itself.',
    self_consultation: 'A Chair cannot consult itself.',
    not_owner: 'Only the Chair that owns the work may do that.',
    record_not_collaborable: 'This work is not in a state the office can broker right now.',
    existing_open_handoff: 'There is already an open handoff on this work.',
    handoff_not_found: 'That handoff could no longer be found.',
    handoff_wrong_state: 'That handoff has already moved on.',
    not_authorized: 'The office must authorize this before it can move.',
    not_receiving_chair: 'Only the receiving Chair may answer for that handoff.',
    not_proposer_or_office: 'Only the proposing Chair or the office may withdraw this.',
    consultation_not_found: 'That consultation could no longer be found.',
    consultation_wrong_state: 'That consultation has already been answered or withdrawn.',
    not_consulted_chair: 'Only the consulted Chair may answer.',
    empty_question: 'A consultation needs a question.',
    empty_answer: 'An answer cannot be empty.',
  };
  return map[reason] ?? 'That action could not be completed.';
}

/** The Chairs the office may route work to — every established Chair except the
    office itself, derived from the Register (never hardcoded). */
function receivingChairs(): { id: string; title: string }[] {
  return EXECUTIVE_CHAIRS
    .filter((c) => c.id !== CHAIR_CHIEF_OF_STAFF && c.status === 'established')
    .map((c) => ({ id: c.id, title: c.title }));
}

function cosBrokerage(repaint: () => void): HTMLElement {
  const recs = loadRecommendations();
  const proposed = pendingHandoffProposals(recs);
  const awaiting = handoffsAwaitingAcceptance(recs);
  const returned = handoffsReturnedToOffice(recs);
  const consultations = unansweredConsultations(recs);

  const persist = (next: Recommendation): void => {
    saveRecommendations(upsertRecommendation(loadRecommendations(), next));
  };
  // Run a guarded collaboration action; show explicit success/failure, then repaint.
  const act = (okText: string, fn: () => CollaborationResult): void => {
    const res = fn();
    if (res.ok) { persist(res.rec); brokerageNotice = { kind: 'ok', text: okText }; }
    else { brokerageNotice = { kind: 'error', text: collaborationDenialText(res.reason) }; }
    repaint();
  };
  // Lifecycle re-brokering after a decline (route/hold/withdraw) returns a record.
  const actRec = (okText: string, fn: () => Recommendation): void => {
    persist(fn()); brokerageNotice = { kind: 'ok', text: okText }; repaint();
  };

  const section = el('div', { class: 'hq-cos__section' },
    cosIntro('The Brokerage', 'Where the office brokers collaboration between the Chairs. The Chair proposes; the office disposes — every transfer is authorized and recorded here.'));

  // The live region — announces the outcome of the last action to everyone.
  const notice = el('p', { class: 'hq-cos__notice', role: 'status', 'aria-live': 'polite' });
  if (brokerageNotice) {
    notice.classList.add(brokerageNotice.kind === 'ok' ? 'is-ok' : 'is-error');
    notice.append(
      el('span', { class: 'hq-cos__notice-mark', 'aria-hidden': 'true' }, brokerageNotice.kind === 'ok' ? '✓' : '!'),
      el('span', {}, brokerageNotice.text));
  }
  section.append(notice);

  section.append(
    brokerageBlock('Proposed Handoffs', 'Handoffs a Chair has proposed, awaiting the office to authorize.',
      proposed, 'No handoffs are awaiting your authorization.',
      (v) => proposedHandoffCard(v, act)),
    brokerageBlock('Awaiting Acceptance', 'Authorized by the office — with the receiving Chair now.',
      awaiting, 'Nothing is waiting on a receiving Chair.',
      (v) => awaitingHandoffCard(v)),
    brokerageBlock('Returned to the Office', 'Declined by the receiving Chair and back with the office to re-broker.',
      returned, 'No declined work is waiting on the office.',
      (v) => returnedHandoffCard(v, act, actRec)),
    brokerageConsultations(consultations),
  );
  return section;
}

/** A titled queue block with a live count and an honest empty state. */
function brokerageBlock<T>(
  title: string, note: string, items: T[], emptyText: string, render: (item: T) => HTMLElement,
): HTMLElement {
  const block = el('section', { class: 'hq-cos__block' },
    el('div', { class: 'hq-cos__block-head' },
      el('h2', { class: 'hq-cos__block-title' }, title),
      el('span', { class: 'hq-cos__count', 'aria-label': `${items.length} in this queue` }, String(items.length))),
    el('p', { class: 'hq-cos__block-note' }, note));
  if (items.length === 0) {
    block.append(el('p', { class: 'hq-cos__quiet' }, emptyText));
  } else {
    const list = el('div', { class: 'hq-cos__decisions' });
    for (const item of items) list.append(render(item));
    block.append(list);
  }
  return block;
}

/** Shared context lines for a handoff card. */
function handoffContext(v: HandoffView): HTMLElement {
  const r = v.rec; const h = v.handoff;
  const card = el('article', { class: 'hq-cos__decision' });
  card.append(
    el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__decision-title' }, r.title),
      el('span', { class: 'hq-cos__tag label', 'data-status': r.priority }, priorityLabel(r.priority))),
    el('p', { class: 'hq-cos__decision-summary' },
      `${chairLabel(h.fromChairId)} → ${chairLabel(h.toChairId)} · ${recTypeLabel(r)} · ${recStatusLabel(r.status)}${r.blocked ? ' · Blocked' : ''}`),
    el('p', { class: 'hq-cos__decision-summary' },
      `Owner ${ownerLabel(r)} · proposed ${formatWhen(h.createdAt)}${r.founderDecision !== 'pending' ? ` · Founder: ${decisionLabel(r)}` : ''}${h.fromStageAtProposal ? ` · from stage: ${h.fromStageAtProposal}` : ''}`),
    el('p', { class: 'hq-cos__field-label label' }, `#${r.id}`),
  );
  if (h.reason) card.append(cosField('Purpose', h.reason));
  if (h.declineReason) card.append(cosField('Reason returned', h.declineReason));
  return card;
}

function proposedHandoffCard(v: HandoffView, act: (t: string, f: () => CollaborationResult) => void): HTMLElement {
  const card = handoffContext(v);
  const group = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': `Broker the handoff of “${v.rec.title}”` });
  const button = (label: string, cls: string, run: () => void): void => {
    const b = el('button', { class: cls, type: 'button' }, label) as HTMLButtonElement;
    b.addEventListener('click', run);
    group.append(b);
  };
  button('Authorize Handoff', 'hq-cos__response', () =>
    act(`Authorized — ${chairLabel(v.handoff.toChairId)} may now accept.`, () => authorizeHandoff(v.rec, v.handoff.id)));
  button('Decline Proposal', 'hq-cos__withdraw', () =>
    act('Proposal declined; the work stays where it is.', () => withdrawHandoff(v.rec, v.handoff.id, OFFICE_BROKER)));
  card.append(group, historyDetails(v.rec));
  return card;
}

function awaitingHandoffCard(v: HandoffView): HTMLElement {
  const card = handoffContext(v);
  card.append(el('p', { class: 'hq-cos__quiet' },
    `Authorized ${v.handoff.authorizedAt ? formatWhen(v.handoff.authorizedAt) : ''} — now with ${chairLabel(v.handoff.toChairId)}. Acceptance happens in the receiving Chair's room; the office does not accept on a Chair's behalf.`));
  card.append(historyDetails(v.rec));
  return card;
}

function returnedHandoffCard(
  v: HandoffView,
  _act: (t: string, f: () => CollaborationResult) => void,
  actRec: (t: string, f: () => Recommendation) => void,
): HTMLElement {
  const card = handoffContext(v);
  const r = v.rec;
  const group = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': `Re-broker “${r.title}”` });

  // Route to another Chair — the office assigns the unowned, declined work.
  const selectId = `route_${r.id.replace(/[^a-z0-9]/gi, '')}`;
  const select = el('select', { class: 'hq-cos__select', id: selectId }) as HTMLSelectElement;
  for (const c of receivingChairs()) select.append(el('option', { value: c.id }, c.title));
  const routeBtn = el('button', { class: 'hq-cos__response', type: 'button' }, 'Route to Chair') as HTMLButtonElement;
  routeBtn.addEventListener('click', () => {
    const to = select.value;
    actRec(`Routed to ${chairLabel(to)}.`, () => advance(routeRecommendation(r, to), 'executing'));
  });
  const routeField = el('div', { class: 'hq-cos__route-field' },
    el('label', { class: 'hq-cos__note-input-label label', for: selectId }, 'Route the returned work to'),
    el('div', { class: 'hq-cos__route-row' }, select, routeBtn));

  const holdBtn = el('button', { class: 'hq-cos__withdraw', type: 'button' }, 'Hold for now') as HTMLButtonElement;
  holdBtn.addEventListener('click', () => actRec('Held by the office.', () => advance(r, 'held')));
  const withdrawBtn = el('button', { class: 'hq-cos__withdraw', type: 'button' }, 'Withdraw the work') as HTMLButtonElement;
  withdrawBtn.addEventListener('click', () => actRec('Withdrawn from the active record.', () => advance(r, 'withdrawn')));
  group.append(holdBtn, withdrawBtn);

  card.append(routeField, group, historyDetails(r));
  return card;
}

function brokerageConsultations(views: ConsultationView[]): HTMLElement {
  const block = el('section', { class: 'hq-cos__block' },
    el('div', { class: 'hq-cos__block-head' },
      el('h2', { class: 'hq-cos__block-title' }, 'Open Consultations'),
      el('span', { class: 'hq-cos__count', 'aria-label': `${views.length} in this queue` }, String(views.length))),
    el('p', { class: 'hq-cos__block-note' }, 'A Chair has asked another a focused question; the answer is awaited.'));
  if (views.length === 0) {
    block.append(el('p', { class: 'hq-cos__quiet' }, 'No consultations are open.'));
    return block;
  }
  const list = el('div', { class: 'hq-cos__decisions' });
  for (const v of views) {
    const c = v.consultation;
    const card = el('article', { class: 'hq-cos__decision' },
      el('div', { class: 'hq-cos__chair-head' },
        el('h3', { class: 'hq-cos__decision-title' }, v.rec.title),
        el('span', { class: 'hq-cos__tag label' }, 'Awaiting answer')),
      el('p', { class: 'hq-cos__decision-summary' },
        `${chairLabel(c.owningChairId)} asked ${chairLabel(c.consultedChairId)} · requested ${formatWhen(c.requestedAt)}`),
      cosField('Question', c.question),
      el('p', { class: 'hq-cos__quiet' },
        `Awaiting ${chairLabel(c.consultedChairId)}'s answer, which is recorded in that Chair's room. The office is not a message channel.`),
      historyDetails(v.rec));
    list.append(card);
  }
  block.append(list);
  return block;
}

/** A compact, collapsible collaboration history for one record — straight from the
    append-only annotations, never a second log. */
function historyDetails(rec: Recommendation): HTMLElement {
  const events = collaborationHistory(rec);
  const details = el('details', { class: 'hq-cos__history' });
  details.append(el('summary', { class: 'hq-cos__history-summary' }, `Collaboration history (${events.length})`));
  if (events.length === 0) {
    details.append(el('p', { class: 'hq-cos__quiet' }, 'No collaboration recorded yet.'));
    return details;
  }
  const ol = el('ol', { class: 'hq-cos__history-list' });
  for (const e of events) ol.append(el('li', { class: 'hq-cos__history-item' },
    el('span', { class: 'hq-cos__history-when' }, formatWhen(e.at)),
    el('span', {}, collaborationEventLine(e))));
  details.append(ol);
  return details;
}

function collaborationEventLine(e: CollaborationEvent): string {
  if (e.kind === 'handoff' && e.handoff) {
    const h = e.handoff;
    const verb: Record<string, string> = {
      proposed: 'Handoff proposed', authorized: 'Handoff authorized by the office',
      accepted: 'Handoff accepted — ownership moved', declined: 'Handoff declined — returned to the office',
      withdrawn: 'Handoff withdrawn',
    };
    return `${verb[h.status] ?? 'Handoff'} · ${chairLabel(h.fromChairId)} → ${chairLabel(h.toChairId)}`;
  }
  if (e.kind === 'consultation' && e.consultation) {
    const c = e.consultation;
    const verb: Record<string, string> = { open: 'Consultation requested', answered: 'Consultation answered', withdrawn: 'Consultation withdrawn' };
    return `${verb[c.status] ?? 'Consultation'} · ${chairLabel(c.owningChairId)} ↔ ${chairLabel(c.consultedChairId)}`;
  }
  return 'Collaboration event';
}

/* --- 3e. OPPORTUNITIES — the office prioritises Growth's intelligence (13A) --
   The Chief of Staff reviews what the Director of Growth has found and disposes:
   research further, recommend, route to work, archive, or ignore. Growth presents;
   the office prioritises; the Founder sees only what is recommended. Routing an
   opportunity promotes it into the Executive Inbox — the one store for work. */
let opportunitiesNotice: string | null = null;

function cosOpportunities(repaint: () => void): HTMLElement {
  const items = loadIntelligence();
  const queue = intelIntakeQueue(items);
  const pipeline = founderReadyPipeline(items);
  const s = intelStanding(items);

  const section = el('div', { class: 'hq-cos__section' },
    cosIntro('Opportunities', 'What the Director of Growth has found, for you to prioritise. The Founder sees only what you recommend — never raw research.'));

  const standingBits: string[] = [];
  if (s.captured) standingBits.push(`${s.captured} newly captured`);
  if (s.underReview) standingBits.push(`${s.underReview} under review`);
  if (s.researching) standingBits.push(`${s.researching} researching`);
  if (s.recommended) standingBits.push(`${s.recommended} recommended`);
  if (s.routed) standingBits.push(`${s.routed} routed to work`);
  if (standingBits.length) section.append(el('p', { class: 'hq-cos__line' }, standingBits.join(' · ')));

  const notice = el('p', { class: 'hq-cos__notice', role: 'status', 'aria-live': 'polite' });
  if (opportunitiesNotice) {
    notice.classList.add('is-ok');
    notice.append(el('span', { class: 'hq-cos__notice-mark', 'aria-hidden': 'true' }, '✓'), el('span', {}, opportunitiesNotice));
  }
  section.append(notice);

  // The intake queue — awaiting the office's prioritisation.
  const queueBlock = el('section', { class: 'hq-cos__block' },
    el('div', { class: 'hq-cos__block-head' },
      el('h2', { class: 'hq-cos__block-title' }, 'For Prioritisation'),
      el('span', { class: 'hq-cos__count', 'aria-label': `${queue.length} awaiting` }, String(queue.length))),
    el('p', { class: 'hq-cos__block-note' }, 'Found by Growth, awaiting your decision.'));
  if (queue.length === 0) {
    queueBlock.append(el('p', { class: 'hq-cos__quiet' }, 'Nothing is waiting. When Growth captures an opportunity, it appears here.'));
  } else {
    const list = el('div', { class: 'hq-cos__decisions' });
    for (const i of queue) list.append(opportunityReviewCard(i, repaint));
    queueBlock.append(list);
  }
  section.append(queueBlock);

  // The Founder-ready pipeline — recommended opportunities (foundation only).
  const pipeBlock = el('section', { class: 'hq-cos__block' },
    el('div', { class: 'hq-cos__block-head' },
      el('h2', { class: 'hq-cos__block-title' }, 'Founder-Ready Pipeline'),
      el('span', { class: 'hq-cos__count', 'aria-label': `${pipeline.length} recommended` }, String(pipeline.length))),
    el('p', { class: 'hq-cos__block-note' }, 'Curated opportunities you have recommended — the foundation of what the Founder will see.'));
  if (pipeline.length === 0) {
    pipeBlock.append(el('p', { class: 'hq-cos__quiet' }, 'Nothing recommended yet.'));
  } else {
    const list = el('div', { class: 'hq-cos__decisions' });
    for (const i of pipeline) list.append(intelCaptureCard(i));
    pipeBlock.append(list);
  }
  section.append(pipeBlock);

  // Content Opportunity Briefs (Sprint 13B) — Growth's ranked analysis, reviewed here.
  const opps = loadOpportunities();
  const forReview = opportunitiesForReview(opps);
  const founderReady = founderReadyOpportunities(opps);
  const os = opportunityStanding(opps);
  const oppBits: string[] = [];
  if (os.draft || os.analyzing) oppBits.push(`${os.draft + os.analyzing} in progress`);
  if (os.readyForReview) oppBits.push(`${os.readyForReview} ready for review`);
  if (os.recommended) oppBits.push(`${os.recommended} recommended`);
  if (os.routed) oppBits.push(`${os.routed} routed to work`);

  const briefsReview = el('section', { class: 'hq-cos__block' },
    el('div', { class: 'hq-cos__block-head' },
      el('h2', { class: 'hq-cos__block-title' }, 'Opportunity Briefs — For Review'),
      el('span', { class: 'hq-cos__count', 'aria-label': `${forReview.length} for review` }, String(forReview.length))),
    el('p', { class: 'hq-cos__block-note' }, 'Ranked content briefs from the Director of Growth, awaiting your prioritisation.'));
  if (oppBits.length) briefsReview.append(el('p', { class: 'hq-cos__line' }, oppBits.join(' · ')));
  if (forReview.length === 0) {
    briefsReview.append(el('p', { class: 'hq-cos__quiet' }, 'No briefs are ready for review.'));
  } else {
    const list = el('div', { class: 'hq-cos__decisions' });
    for (const o of forReview) list.append(briefReviewCard(o, repaint));
    briefsReview.append(list);
  }
  section.append(briefsReview);

  // The Founder-ready briefs — concise executive projections (recommended briefs).
  const founderBlock = el('section', { class: 'hq-cos__block' },
    el('div', { class: 'hq-cos__block-head' },
      el('h2', { class: 'hq-cos__block-title' }, 'Founder-Ready Briefs'),
      el('span', { class: 'hq-cos__count', 'aria-label': `${founderReady.length} recommended` }, String(founderReady.length))),
    el('p', { class: 'hq-cos__block-note' }, 'What the Founder sees — a concise brief and a single decision. No raw research.'));
  if (founderReady.length === 0) {
    founderBlock.append(el('p', { class: 'hq-cos__quiet' }, 'Nothing recommended to the Founder yet.'));
  } else {
    const list = el('div', { class: 'hq-cos__decisions' });
    for (const o of founderReady) list.append(founderBriefCard(o, repaint));
    founderBlock.append(list);
  }
  section.append(founderBlock);

  // Creative Assignment Packs (Sprint 13C) — Creative's planning, reviewed here.
  const assignments = loadAssignments();
  const asnReview = assignmentsForReview(assignments);
  const asnApproved = approvedAssignments(assignments);
  const as = assignmentStanding(assignments);
  const asnBits: string[] = [];
  if (as.draft || as.inDevelopment || as.returned) asnBits.push(`${as.draft + as.inDevelopment + as.returned} in development`);
  if (as.readyForReview) asnBits.push(`${as.readyForReview} ready for review`);
  if (as.approved) asnBits.push(`${as.approved} approved`);
  if (as.routed) asnBits.push(`${as.routed} routed to work`);

  const asnBlock = el('section', { class: 'hq-cos__block' },
    el('div', { class: 'hq-cos__block-head' },
      el('h2', { class: 'hq-cos__block-title' }, 'Creative Assignments — For Review'),
      el('span', { class: 'hq-cos__count', 'aria-label': `${asnReview.length} for review` }, String(asnReview.length))),
    el('p', { class: 'hq-cos__block-note' }, 'Creative Assignment Packs from the Creative Director, awaiting your approval.'));
  if (asnBits.length) asnBlock.append(el('p', { class: 'hq-cos__line' }, asnBits.join(' · ')));
  if (asnReview.length === 0) asnBlock.append(el('p', { class: 'hq-cos__quiet' }, 'No assignments are ready for review.'));
  else { const l = el('div', { class: 'hq-cos__decisions' }); for (const a of asnReview) l.append(assignmentReviewCard(a, repaint)); asnBlock.append(l); }
  section.append(asnBlock);

  // Founder-ready assignments — concise creative recommendations (approved packs).
  const asnFounder = el('section', { class: 'hq-cos__block' },
    el('div', { class: 'hq-cos__block-head' },
      el('h2', { class: 'hq-cos__block-title' }, 'Founder-Ready Assignments'),
      el('span', { class: 'hq-cos__count', 'aria-label': `${asnApproved.length} approved` }, String(asnApproved.length))),
    el('p', { class: 'hq-cos__block-note' }, 'What the Founder sees — what to make, the hook, and one decision.'));
  if (asnApproved.length === 0) asnFounder.append(el('p', { class: 'hq-cos__quiet' }, 'Nothing approved for the Founder yet.'));
  else { const l = el('div', { class: 'hq-cos__decisions' }); for (const a of asnApproved) l.append(founderAssignmentCard(a, repaint)); asnFounder.append(l); }
  section.append(asnFounder);

  // Creative Drafts (Sprint 13D) — Chief of Staff status visibility + Founder review.
  const drafts = loadDrafts();
  const ds = draftStanding(drafts);
  const founderDrafts = draftsForFounder(drafts);
  const dsBits: string[] = [];
  if (ds.requested + ds.generating) dsBits.push(`${ds.requested + ds.generating} requested`);
  if (ds.failed) dsBits.push(`${ds.failed} generation failed`);
  if (ds.ready) dsBits.push(`${ds.ready} ready for review`);
  if (ds.revisionRequested) dsBits.push(`${ds.revisionRequested} revision requested`);
  if (ds.approved) dsBits.push(`${ds.approved} approved`);

  const draftBlock = el('section', { class: 'hq-cos__block' },
    el('div', { class: 'hq-cos__block-head' },
      el('h2', { class: 'hq-cos__block-title' }, 'Creative Drafts — Founder Review'),
      el('span', { class: 'hq-cos__count', 'aria-label': `${founderDrafts.length} for review` }, String(founderDrafts.length))),
    el('p', { class: 'hq-cos__block-note' }, 'AI-assisted drafts prepared by Creative. You are the final editorial authority — approve, edit, revise, hold, or decline.'));
  if (dsBits.length) draftBlock.append(el('p', { class: 'hq-cos__line' }, `Status: ${dsBits.join(' · ')}`));
  // Ready/revised drafts await a decision; approved drafts stay visible to route to work.
  const reviewList = [...founderDrafts, ...drafts.filter((d) => d.status === 'approved')];
  if (reviewList.length === 0) {
    draftBlock.append(el('p', { class: 'hq-cos__quiet' }, 'No drafts are ready for your review.'));
  } else {
    const l = el('div', { class: 'hq-cos__decisions' });
    for (const d of reviewList) l.append(founderDraftCard(d, repaint));
    draftBlock.append(l);
  }
  section.append(draftBlock);

  // Production Readiness Packs (Sprint 13E) — office review + Founder production review.
  const packs = loadProduction();
  const prodReview = productionForReview(packs);
  const prodApproved = approvedProduction(packs);
  const ps = productionPackStanding(packs);
  const psBits: string[] = [];
  if (ps.draft + ps.preparing + ps.revision) psBits.push(`${ps.draft + ps.preparing + ps.revision} in preparation`);
  if (ps.readyForReview) psBits.push(`${ps.readyForReview} ready for review`);
  if (ps.approved) psBits.push(`${ps.approved} approved`);
  if (ps.routed) psBits.push(`${ps.routed} routed to work`);

  const prodBlock = el('section', { class: 'hq-cos__block' },
    el('div', { class: 'hq-cos__block-head' },
      el('h2', { class: 'hq-cos__block-title' }, 'Production Readiness — Review'),
      el('span', { class: 'hq-cos__count', 'aria-label': `${prodReview.length} for review` }, String(prodReview.length))),
    el('p', { class: 'hq-cos__block-note' }, 'Production Readiness Packs from the Head of Production, awaiting your decision.'));
  if (psBits.length) prodBlock.append(el('p', { class: 'hq-cos__line' }, psBits.join(' · ')));
  // Review list (ready) plus approved packs kept visible to route to work.
  const prodList = [...prodReview, ...prodApproved];
  if (prodList.length === 0) prodBlock.append(el('p', { class: 'hq-cos__quiet' }, 'No production packs are ready for review.'));
  else { const l = el('div', { class: 'hq-cos__decisions' }); for (const p of prodList) l.append(productionReviewCard(p, repaint)); prodBlock.append(l); }
  section.append(prodBlock);
  return section;
}

/** The office / Founder reviews a Production Readiness Pack — the recording plan
    and the decisions. Route to Work reuses the idempotent promotion carrying the
    full intelligence → opportunity → assignment → draft → production → recommendation
    chain. An approved pack shows only the route action. */
function productionReviewCard(p: ProductionReadiness, repaint: () => void): HTMLElement {
  const fv = founderProductionView(p);
  const card = el('article', { class: 'hq-cos__decision hq-briefs__founder' });
  card.append(
    el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__decision-title' }, `${p.title}`),
      el('span', { class: 'hq-cos__tag label', 'data-status': 'open' }, productionStatusLabel(p.status))),
    cosField('What will be recorded', fv.record),
    cosField('Estimated duration', fv.duration),
    cosField('Format', fv.format),
    cosField('Recording environment', fv.environment),
    cosField('Visual direction', fv.visual),
    cosField('CTA', fv.cta),
  );
  if (fv.assets.length) {
    const ul = el('ul', { class: 'hq-cos__tradeoffs' });
    for (const a of fv.assets) ul.append(el('li', {}, a));
    card.append(el('div', { class: 'hq-cos__field' }, el('p', { class: 'hq-cos__field-label label' }, 'Required assets'), ul));
  }
  card.append(cosField('Production cautions', fv.cautions), el('p', { class: 'hq-cos__decision-summary' }, `${productionAuthorLabel(p)}`));

  const persist = (next: ProductionReadiness, notice: string): void => { saveProduction(upsertProduction(loadProduction(), next)); opportunitiesNotice = notice; repaint(); };

  if (p.status === 'approved') {
    card.append(el('p', { class: 'hq-cos__quiet' }, 'Approved — nothing records or publishes. The office can route it into work.'));
    if (isProductionRoutable(p)) {
      const rg = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': 'Route production pack to work' });
      const b = el('button', { class: 'hq-cos__response', type: 'button' }, 'Route to Work') as HTMLButtonElement;
      b.addEventListener('click', () => {
        const res = routeProductionToWork(p, loadRecommendations());
        saveRecommendations(res.recommendations);
        saveProduction(upsertProduction(loadProduction(), res.pack));
        opportunitiesNotice = res.created ? 'Production pack routed to work.' : 'Already routed; existing work kept.';
        repaint();
      });
      rg.append(b); card.append(rg);
    } else {
      card.append(el('p', { class: 'hq-cos__quiet' }, `Routed to work — recommendation ${p.promotedRecommendationId}.`));
    }
    return card;
  }

  const group = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': `Your decision on “${p.title}”` });
  const act = (label: string, cls: string, fn: () => void): void => {
    const b = el('button', { class: cls, type: 'button' }, label) as HTMLButtonElement; b.addEventListener('click', fn); group.append(b);
  };
  act('Approve', 'hq-cos__response', () => persist(approveProduction(p), `${p.title} — approved.`));
  act('Route to Work', 'hq-cos__response', () => {
    const res = routeProductionToWork(p, loadRecommendations());
    saveRecommendations(res.recommendations);
    saveProduction(upsertProduction(loadProduction(), res.pack));
    opportunitiesNotice = res.created ? 'Production pack routed to work.' : 'Already routed; existing work kept.';
    repaint();
  });
  const revId = `prev_${p.id.replace(/[^a-z0-9]/gi, '')}`;
  const rev = el('input', { class: 'hq-cos__note-input', id: revId, type: 'text', maxlength: '200', placeholder: 'What to revise (optional)' }) as HTMLInputElement;
  act('Request Revision', 'hq-cos__withdraw', () => persist(returnProductionForRevision(p, rev.value), `${p.title} — returned for revision.`));
  act('Hold', 'hq-cos__withdraw', () => persist(holdProduction(p), `${p.title} — held.`));
  act('Decline', 'hq-cos__withdraw', () => persist(declineProduction(p), `${p.title} — declined.`));
  card.append(el('div', { class: 'hq-cos__note-field' }, el('label', { class: 'hq-cos__note-input-label label', for: revId }, 'Revision instruction'), rev), group);
  return card;
}

/** The Founder's concise draft review — the projection, the cautions, an editable
    hook, and the four decisions. Approval only ever comes from the Founder; the AI
    never self-approves, and nothing publishes. */
function founderDraftCard(d: CreativeDraft, repaint: () => void): HTMLElement {
  const fv = founderDraftView(d);
  const card = el('article', { class: 'hq-cos__decision hq-briefs__founder' });
  card.append(
    el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__decision-title' }, `${fv.draftType}`),
      el('span', { class: 'hq-cos__tag label', 'data-status': 'open' }, fv.platform)),
    cosField('What it’s for', fv.forWhat),
    cosField('Audience', fv.audience),
    cosField('From opportunity', fv.opportunity),
  );
  for (const h of fv.highlights) card.append(cosField(h.label, h.value));
  card.append(cosField('Connection', fv.connection), cosField('Call to action', fv.cta));
  const cl = el('ul', { class: 'hq-draft__cautions' });
  for (const c of fv.cautions) cl.append(el('li', {}, c));
  card.append(el('div', { class: 'hq-cos__field' }, el('p', { class: 'hq-cos__field-label label' }, 'Cautions'), cl));

  const persist = (next: CreativeDraft, notice: string): void => { saveDrafts(upsertDraft(loadDrafts(), next)); opportunitiesNotice = notice; repaint(); };

  // An already-approved draft: it is the Founder's; the only remaining office step
  // is to route it into work. No further editorial decision is offered.
  if (d.status === 'approved') {
    card.append(el('p', { class: 'hq-cos__quiet' }, 'Approved by you — nothing publishes. The office can route it into work.'));
    if (isDraftRoutable(d)) {
      const rg = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': 'Route draft to work' });
      const b = el('button', { class: 'hq-cos__response', type: 'button' }, 'Route to Work') as HTMLButtonElement;
      b.addEventListener('click', () => {
        const res = routeDraftToWork(d, loadRecommendations());
        saveRecommendations(res.recommendations);
        saveDrafts(upsertDraft(loadDrafts(), res.draft));
        opportunitiesNotice = res.created ? 'Draft routed to work.' : 'Already routed; existing work kept.';
        repaint();
      });
      rg.append(b); card.append(rg);
    } else {
      card.append(el('p', { class: 'hq-cos__quiet' }, `Routed to work — recommendation ${d.promotedRecommendationId}.`));
    }
    return card;
  }

  // The Founder may edit the final copy (the recommended hook / note) before approving.
  const editId = `fedit_${d.id.replace(/[^a-z0-9]/gi, '')}`;
  const current = (d.content && (d.content.recommendedHook || d.content.noteCopy)) || '';
  const edit = el('input', { class: 'hq-cos__note-input', id: editId, type: 'text', maxlength: '280', value: current, placeholder: 'Edit the final copy before approving (optional)' }) as HTMLInputElement;
  card.append(el('div', { class: 'hq-cos__note-field' }, el('label', { class: 'hq-cos__note-input-label label', for: editId }, 'Final copy (editable)'), edit));

  const group = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': `Your decision on the ${fv.draftType}` });
  const approve = el('button', { class: 'hq-cos__response', type: 'button' }, 'Approve') as HTMLButtonElement;
  approve.addEventListener('click', () => {
    let finalContent: DraftContent | null = null;
    if (d.content && edit.value.trim() && edit.value.trim() !== current) {
      finalContent = { ...d.content };
      if (d.content.recommendedHook) finalContent.recommendedHook = edit.value.trim();
      else if (d.content.noteCopy) finalContent.noteCopy = edit.value.trim();
    }
    persist(approveDraft(d, finalContent), 'Draft approved. It is yours now — nothing publishes.');
  });
  const reviseId = `frev_${d.id.replace(/[^a-z0-9]/gi, '')}`;
  const revNote = el('input', { class: 'hq-cos__note-input', id: reviseId, type: 'text', maxlength: '200', placeholder: 'What to change (optional)' }) as HTMLInputElement;
  const revise = el('button', { class: 'hq-cos__withdraw', type: 'button' }, 'Request Revision') as HTMLButtonElement;
  revise.addEventListener('click', () => persist(requestDraftRevision(d, revNote.value), 'Revision requested — back to Creative.'));
  const hold = el('button', { class: 'hq-cos__withdraw', type: 'button' }, 'Hold') as HTMLButtonElement;
  hold.addEventListener('click', () => persist(holdDraft(d), 'Draft held.'));
  const decline = el('button', { class: 'hq-cos__withdraw', type: 'button' }, 'Decline') as HTMLButtonElement;
  decline.addEventListener('click', () => persist(declineDraft(d), 'Draft declined.'));
  group.append(approve, hold, decline);
  card.append(el('div', { class: 'hq-cos__note-field' }, el('label', { class: 'hq-cos__note-input-label label', for: reviseId }, 'Revision instruction'), revNote, revise), group);
  return card;
}

/** The office reviews a Creative Assignment Pack — the creative direction and the
    five actions. Route to Work reuses the idempotent promotion carrying the full
    intelligence → opportunity → assignment → recommendation chain. */
function assignmentReviewCard(a: CreativeAssignment, repaint: () => void): HTMLElement {
  const card = el('article', { class: 'hq-cos__decision' });
  card.append(
    el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__decision-title' }, a.title),
      el('span', { class: 'hq-cos__tag label', 'data-status': 'open' }, assignmentStatusLabel(a.status))),
    el('p', { class: 'hq-cos__decision-summary' },
      `${assignmentPropertyLabel(a)} · ${contentPlatformLabel(a.primaryPlatform)}${a.tiktokFormat ? ` (${tiktokFormatLabel(a.tiktokFormat)})` : ''} · ${assignmentAuthorLabel(a)} · complexity ${a.complexity}`),
  );
  if (a.hook) card.append(cosField('Hook', a.hook));
  if (a.centralIdea) card.append(cosField('Central idea', a.centralIdea));
  if (a.talkingPoints.length) {
    const ul = el('ul', { class: 'hq-cos__tradeoffs' });
    for (const p of a.talkingPoints) ul.append(el('li', {}, p));
    card.append(el('div', { class: 'hq-cos__field' }, el('p', { class: 'hq-cos__field-label label' }, 'Talking points'), ul));
  }
  if (a.substackKind !== 'none') card.append(cosField('Substack', `${substackKindLabel(a.substackKind)}${a.substackConnection ? ` — ${a.substackConnection}` : ''}`));
  if (a.callToAction) card.append(cosField('Call to action', a.callToAction));
  // cross-property reasons
  const xr = crossPropertyReasons(a).filter((r) => r.reason);
  if (xr.length) card.append(cosField('Cross-property', xr.map((r) => `${contentPropertyLabel(r.property)}: ${r.reason}`).join(' · ')));
  if (a.cautions) card.append(cosField('Cautions', a.cautions));

  const persist = (next: CreativeAssignment, notice: string): void => {
    saveAssignments(upsertAssignment(loadAssignments(), next)); opportunitiesNotice = notice; repaint();
  };
  const group = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': `Review assignment “${a.title}”` });
  const act = (label: string, cls: string, fn: () => void): void => {
    const b = el('button', { class: cls, type: 'button' }, label) as HTMLButtonElement; b.addEventListener('click', fn); group.append(b);
  };
  act('Approve Assignment', 'hq-cos__response', () => persist(approveAssignment(a), `${a.title} — approved.`));
  act('Route to Work', 'hq-cos__response', () => {
    const res = routeAssignmentToWork(a, loadRecommendations());
    saveRecommendations(res.recommendations);
    saveAssignments(upsertAssignment(loadAssignments(), res.assignment));
    opportunitiesNotice = res.created ? `${a.title} — routed to work.` : `${a.title} — already routed; the existing work was kept.`;
    repaint();
  });
  // Return for Revision with a concise instruction.
  const noteId = `arev_${a.id.replace(/[^a-z0-9]/gi, '')}`;
  const note = el('input', { class: 'hq-cos__note-input', id: noteId, type: 'text', maxlength: '200', placeholder: 'What to revise (optional)' }) as HTMLInputElement;
  act('Return for Revision', 'hq-cos__withdraw', () => persist(returnAssignmentForRevision(a, note.value), `${a.title} — returned for revision.`));
  act('Hold', 'hq-cos__withdraw', () => persist(holdAssignment(a), `${a.title} — held.`));
  act('Decline', 'hq-cos__withdraw', () => persist(declineAssignment(a), `${a.title} — declined.`));
  card.append(el('div', { class: 'hq-cos__note-field' },
    el('label', { class: 'hq-cos__note-input-label label', for: noteId }, 'Revision instruction'), note), group);
  return card;
}

/** The Founder-ready creative recommendation — concise, one decision requested. */
function founderAssignmentCard(a: CreativeAssignment, repaint: () => void): HTMLElement {
  const fa = founderAssignment(a);
  const card = el('article', { class: 'hq-cos__decision hq-briefs__founder' });
  card.append(
    el('h3', { class: 'hq-cos__decision-title' }, a.title),
    cosField('What to make', fa.make),
    cosField('Why now', fa.whyNow),
    cosField('Who it’s for', fa.who),
    cosField('The hook', fa.hook),
    cosField('The main point', fa.mainPoint),
    cosField('Recommended format', fa.format),
    cosField('Substack connection', fa.substackConnection),
    cosField('Call to action', fa.cta),
    cosField('Decision needed', fa.decision),
  );
  if (isAssignmentRoutable(a)) {
    const group = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': `Route assignment “${a.title}”` });
    const b = el('button', { class: 'hq-cos__response', type: 'button' }, 'Route to Work') as HTMLButtonElement;
    b.addEventListener('click', () => {
      const res = routeAssignmentToWork(a, loadRecommendations());
      saveRecommendations(res.recommendations);
      saveAssignments(upsertAssignment(loadAssignments(), res.assignment));
      opportunitiesNotice = res.created ? `${a.title} — routed to work.` : `${a.title} — already routed; the existing work was kept.`;
      repaint();
    });
    group.append(b); card.append(group);
  }
  return card;
}

/** The office reviews a ranked content brief — score, explanation, and the five
    prioritisation actions. Route to Work reuses the idempotent promotion + full
    provenance (intelligence → opportunity → recommendation). */
function briefReviewCard(o: ContentOpportunity, repaint: () => void): HTMLElement {
  const sc = scoreOpportunity(o.signals, o.confidence);
  const card = el('article', { class: 'hq-cos__decision' });
  card.append(
    el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__decision-title' }, o.title),
      el('span', { class: 'hq-cos__tag label', 'data-status': o.confidence === 'low' ? 'low' : 'open' }, `Score ${sc.score} · ${sc.band}`)),
    el('p', { class: 'hq-cos__decision-summary' },
      `${o.properties.map(contentPropertyLabel).join(', ') || 'No property'} · ${o.types.map(opportunityTypeLabel).join(', ') || 'No format'} · ${opportunityAuthorLabel(o)}`),
  );
  if (o.summary) card.append(el('p', { class: 'hq-cos__field-body' }, o.summary));
  if (o.audienceNeed) card.append(cosField('Audience need', o.audienceNeed));
  if (o.angle) card.append(cosField('Recommended angle', o.angle));
  if (o.recommendation) card.append(cosField('Growth recommendation', o.recommendation));
  if (o.risks) card.append(cosField('Risks', o.risks));
  if (o.nextAction) card.append(cosField('Next action', o.nextAction));
  if (sc.caution) card.append(el('p', { class: 'hq-cos__quiet' }, sc.caution));

  // Transparent score explanation.
  card.append(briefScoreDetails(sc));

  const persist = (next: ContentOpportunity, notice: string): void => {
    saveOpportunities(upsertOpportunity(loadOpportunities(), next));
    opportunitiesNotice = notice; repaint();
  };
  const group = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': `Prioritise brief “${o.title}”` });
  const act = (label: string, cls: string, fn: () => void): void => {
    const b = el('button', { class: cls, type: 'button' }, label) as HTMLButtonElement;
    b.addEventListener('click', fn); group.append(b);
  };
  act('Recommend to Founder', 'hq-cos__response', () => persist(recommendOpportunity(o), `${o.title} — recommended to the Founder.`));
  act('Route to Work', 'hq-cos__response', () => {
    const res = routeOpportunityToWork(o, loadRecommendations());
    saveRecommendations(res.recommendations);
    saveOpportunities(upsertOpportunity(loadOpportunities(), res.opportunity));
    opportunitiesNotice = res.created ? `${o.title} — routed to work.` : `${o.title} — already routed; the existing work was kept.`;
    repaint();
  });
  act('Return for Research', 'hq-cos__withdraw', () => persist(returnOpportunityForResearch(o), `${o.title} — returned for research.`));
  act('Hold', 'hq-cos__withdraw', () => persist(holdOpportunity(o), `${o.title} — held.`));
  act('Decline', 'hq-cos__withdraw', () => persist(declineOpportunity(o), `${o.title} — declined.`));
  card.append(group);
  return card;
}

function briefScoreDetails(sc: ReturnType<typeof scoreOpportunity>): HTMLElement {
  const details = el('details', { class: 'hq-cos__history' });
  details.append(el('summary', { class: 'hq-cos__history-summary' }, `Why this scored ${sc.score}`));
  const ol = el('ul', { class: 'hq-briefs__factors' });
  for (const f of sc.factors) ol.append(el('li', {},
    el('span', { class: 'hq-briefs__factor-label' }, f.label),
    el('span', {}, `${ratingLabel(f.rating)} — ${f.note}`)));
  details.append(ol);
  return details;
}

/** The Founder-ready projection — concise, executive-level, one decision requested. */
function founderBriefCard(o: ContentOpportunity, repaint: () => void): HTMLElement {
  const fb = founderBrief(o);
  const card = el('article', { class: 'hq-cos__decision hq-briefs__founder' });
  card.append(
    el('h3', { class: 'hq-cos__decision-title' }, o.title),
    cosField('What Growth found', fb.found),
    cosField('Why it matters now', fb.whyNow),
    cosField('Where it fits', fb.where),
    cosField('Who it’s for', fb.who),
    cosField('Recommended content', fb.recommended),
  );
  if (fb.formats.length) card.append(cosField('Suggested formats', fb.formats.join(', ')));
  card.append(cosField('Strategic reason', fb.reason), cosField('Decision needed', fb.decision));

  // The office can still route a recommended brief straight into work.
  if (isOpportunityRoutable(o)) {
    const group = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': `Route brief “${o.title}”` });
    const b = el('button', { class: 'hq-cos__response', type: 'button' }, 'Route to Work') as HTMLButtonElement;
    b.addEventListener('click', () => {
      const res = routeOpportunityToWork(o, loadRecommendations());
      saveRecommendations(res.recommendations);
      saveOpportunities(upsertOpportunity(loadOpportunities(), res.opportunity));
      opportunitiesNotice = res.created ? `${o.title} — routed to work.` : `${o.title} — already routed; the existing work was kept.`;
      repaint();
    });
    group.append(b); card.append(group);
  }
  return card;
}

function opportunityReviewCard(i: IntelligenceItem, repaint: () => void): HTMLElement {
  const card = el('article', { class: 'hq-cos__decision' });
  card.append(
    el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__decision-title' }, i.title),
      el('span', { class: 'hq-cos__tag label', 'data-status': i.status }, intelStatusLabel(i.status))),
    el('p', { class: 'hq-cos__decision-summary' },
      `${intelSourceLabel(i.source)} · ${intelCategoryLabel(i.category)} · ${intelConfidenceLabel(i.confidence)} confidence · ${capturedByLabel(i)} · ${formatWhen(i.capturedAt)}`),
    el('p', { class: 'hq-cos__field-body' }, i.summary),
  );
  if (i.whyItMatters) card.append(cosField('Why it matters', i.whyItMatters));
  if (i.audience) card.append(cosField('Audience', i.audience));
  if (i.notes) card.append(cosField('Notes', i.notes));
  if (i.links.length) card.append(intelLinks(i.links));

  const noteId = `intel_note_${i.id.replace(/[^a-z0-9]/gi, '')}`;
  const note = el('input', { class: 'hq-cos__note-input', id: noteId, type: 'text', maxlength: '200', placeholder: 'A note for the record (optional)' }) as HTMLInputElement;
  card.append(el('div', { class: 'hq-cos__note-field' },
    el('label', { class: 'hq-cos__note-input-label label', for: noteId }, 'Prioritisation note'), note));

  const group = el('div', { class: 'hq-cos__responses', role: 'group', 'aria-label': `Prioritise “${i.title}”` });
  const decide = (outcome: IntelReviewOutcome): void => {
    // Routing promotes the opportunity into the Executive Inbox — the one store for
    // executive work — with a durable, bidirectional provenance link. Idempotent:
    // it never forks a second recommendation. The Founder is not involved; this is
    // office coordination, and the created record enters the normal lifecycle.
    if (outcome === 'route') {
      const result = routeIntelligenceToWork(i, loadRecommendations());
      saveRecommendations(result.recommendations);
      saveIntelligence(upsertIntelligence(loadIntelligence(), result.item));
      opportunitiesNotice = result.created
        ? `${i.title} — routed to work.`
        : `${i.title} — already routed; the existing work was kept.`;
      repaint();
      return;
    }
    const reviewed = reviewIntelligence(i, outcome, note.value);
    saveIntelligence(upsertIntelligence(loadIntelligence(), reviewed));
    opportunitiesNotice = `${i.title} — ${intelOutcomeLabel(outcome)}.`;
    repaint();
  };
  for (const o of INTEL_REVIEW_OUTCOMES) {
    const b = el('button', { class: o.id === 'ignore' || o.id === 'archive' ? 'hq-cos__withdraw' : 'hq-cos__response', type: 'button' }, o.label) as HTMLButtonElement;
    b.addEventListener('click', () => decide(o.id));
    group.append(b);
  }
  card.append(group);
  return card;
}

/* --- 4. Open Chairs — derived from the Executive Register ----------------- */
function cosChairs(): HTMLElement {
  const chairs = openChairViews();
  const list = el('div', { class: 'hq-cos__chairs' });
  for (const chair of chairs) {
    const resp = el('ul', { class: 'hq-cos__chair-resp' });
    for (const r of chair.responsibilities) resp.append(el('li', {}, r));
    const head = el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__chair-name' },
        `Chair #${String(chair.ordinal).padStart(3, '0')} — ${chair.title}`),
      el('span', { class: 'hq-cos__tag label', 'data-status': chair.status },
        chair.statusLabel));
    const card = el('article', { class: 'hq-cos__chair' },
      head,
      el('p', { class: 'hq-cos__chair-purpose' }, chair.purpose),
      cosField('Charge', chair.charge),
      el('div', { class: 'hq-cos__field' },
        el('p', { class: 'hq-cos__field-label label' }, 'Standing Responsibilities'),
        resp));
    if (chair.establishedOn) {
      card.append(el('p', { class: 'hq-cos__chair-established' },
        el('span', { class: 'label' }, 'Established'), ` ${chair.establishedOn}`));
    }
    list.append(card);
  }
  return el('div', { class: 'hq-cos__section' },
    cosIntro('Open Chairs', 'The seats the House is preparing to fill, drawn from the Executive Register. Each is described in full before anyone is ever invited to it. No recruitment yet — this is the ground being made ready.'),
    list);
}

/* --- 5. Leadership Records — derived from Register history ----------------- */
function cosLeadership(): HTMLElement {
  // Each Chair's truthful current standing, derived from the Register.
  const holders = el('ul', { class: 'hq-cos__holders' });
  for (const c of leadershipViews()) {
    const holder = el('li', { class: 'hq-cos__holder' },
      el('p', { class: 'hq-cos__holder-chair' },
        `Chair #${String(c.ordinal).padStart(3, '0')} — ${c.title}`),
      el('p', { class: 'hq-cos__holder-name' }, c.standing));
    if (c.operatingNote) {
      holder.append(el('p', { class: 'hq-cos__holder-standing' }, c.operatingNote));
    }
    if (c.founderNote) {
      holder.append(el('p', { class: 'hq-cos__holder-standing' },
        el('span', { class: 'label' }, 'Founder’s note'), ` ${c.founderNote}`));
    }
    holders.append(holder);
  }

  // Appointments — only real records; honestly empty until the first letter.
  const onRecord = appointmentsOnRecord();
  const appts = el('div', { class: 'hq-cos__block' },
    el('h2', { class: 'hq-cos__block-title' }, 'Appointments'));
  if (onRecord.length === 0) {
    appts.append(el('p', { class: 'hq-cos__quiet' },
      'No appointments have been made yet. Every Chair is established but not yet formally appointed; when the first is seated, its letter is kept here.'));
  } else {
    const list = el('ul', { class: 'hq-cos__lines' });
    for (const a of onRecord) {
      list.append(el('li', { class: 'hq-cos__line' },
        `${a.appointee} — ${a.chairId}${a.effectiveDate ? ` · ${a.effectiveDate}` : ''}`));
    }
    appts.append(list);
  }

  // Leadership history — the preserved Register entries, oldest first.
  const history = el('ol', { class: 'hq-cos__history' });
  for (const e of leadershipHistoryView()) {
    history.append(el('li', { class: 'hq-cos__history-entry' },
      el('span', { class: 'hq-cos__history-when label' }, e.on),
      el('span', { class: 'hq-cos__history-event' }, e.event)));
  }

  return el('div', { class: 'hq-cos__section' },
    cosIntro('Leadership Records', 'Who holds each charge, how it was given, and the story of the House’s leadership as it grows.'),
    el('section', { class: 'hq-cos__block' },
      el('h2', { class: 'hq-cos__block-title' }, 'Chairs & Charges'),
      holders),
    appts,
    el('section', { class: 'hq-cos__block' },
      el('h2', { class: 'hq-cos__block-title' }, 'Leadership History'),
      history),
  );
}

/* --- 6. Archive ----------------------------------------------------------- */
function cosArchive(): HTMLElement {
  const recorded = loadResponses().length;
  const shelves = archiveShelves(recorded);

  const grid = el('ul', { class: 'hq-cos__shelves' });
  for (const s of shelves) {
    const shelf = el('li', { class: 'hq-cos__shelf' },
      el('div', { class: 'hq-cos__shelf-head' },
        el('h3', { class: 'hq-cos__shelf-name' }, s.label),
        el('span', { class: 'hq-cos__shelf-count label' },
          s.count > 0 ? `${s.count} kept` : 'Empty')),
      el('p', { class: 'hq-cos__shelf-note' }, s.note),
      el('p', { class: 'hq-cos__shelf-state' },
        s.count > 0 ? 'Held in the record.' : s.emptyLine));
    grid.append(shelf);
  }

  return el('div', { class: 'hq-cos__section' },
    cosIntro('Archive', 'The institutional record, given its shelves. Each category is ready the moment a document exists — the House keeps what it decides.'),
    grid);
}

/* --- small shared helpers for the office ---------------------------------- */

/** Spell out small counts for the Briefing's prose (falls back to digits). */
function spellCount(n: number): string {
  const words = ['zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  return words[n] ?? String(n);
}

/** A gentle, human "when" from an ISO datetime (date only; never a raw stamp). */
function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  } catch { return ''; }
}

/** ERROR — an unrecognised route. Offers the way home rather than a dead end. */
function renderError(root: HTMLElement): void {
  setMode('seated');
  root.replaceChildren(
    el(
      'section',
      { class: 'hq-view hq-view--seated' },
      el(
        'div',
        { class: 'hq-view__inner container' },
        el(
          'div',
          { class: 'hq-state hq-state--error', role: 'alert' },
          el('p', { class: 'hq-state__title' }, 'This corridor doesn’t lead anywhere'),
          el('p', { class: 'hq-state__lede' }, 'There is no room at that address.'),
          el('a', { class: 'hq-back', href: getRoom(HOME_ROOM)!.route }, '← Return to the Executive Office'),
        ),
      ),
    ),
  );
}

/**
 * ACCESS-DENIED — a styled panel for completeness. The AUTHORITATIVE gate is the
 * edge middleware (functions/_middleware.js), which returns 403 via Cloudflare
 * Access BEFORE this page is ever served — a denied founder never reaches this
 * code. This view exists so the state is designed and reachable for review at
 * `#/denied`; it is not, and must not be treated as, a security control.
 */
function renderAccessDenied(root: HTMLElement): void {
  setMode('seated');
  root.replaceChildren(
    el(
      'section',
      { class: 'hq-view hq-view--seated' },
      el(
        'div',
        { class: 'hq-view__inner container' },
        el(
          'div',
          { class: 'hq-state hq-state--denied', role: 'alert' },
          el('p', { class: 'hq-eyebrow label' }, 'Headquarters · private'),
          el('p', { class: 'hq-state__title' }, 'This Headquarters is private'),
          el('p', { class: 'hq-state__lede' }, 'A valid House identity is required. Sign in through Cloudflare Access to continue.'),
          el('a', { class: 'hq-back', href: '/' }, '← Return to the corridor'),
        ),
      ),
    ),
  );
}

/* =============================================================================
   THE DESK — the Executive Office seated work state (the Founder’s Desk).
   Route: #/executive/desk. One queue for every submission, over the existing
   submissions spine. A few audited decisions happen here; the Editorial Office
   remains the complete review workspace. HQ owns no data.
   ============================================================================= */

// Founder-oriented groupings over the existing workflow states (the data model
// and API are unchanged; grouping is a presentation concern). The Editorial
// Office remains the detailed, per-status workflow environment.
type DeskGroup = 'review' | 'coordination' | 'waiting' | 'done' | 'all';
interface GroupDef {
  id: DeskGroup;
  label: string;
  statuses: SubmissionStatus[] | null; // null = everything
  empty: { title: string; lede: string };
}
const DESK_GROUPS: GroupDef[] = [
  { id: 'review', label: 'Needs My Review', statuses: ['sent_for_review', 'under_review'],
    empty: { title: 'Nothing needs you right now', lede: 'When a submission is waiting on your decision, it will rest here.' } },
  { id: 'coordination', label: 'In Coordination', statuses: ['approved', 'scheduled'],
    empty: { title: 'Nothing in coordination', lede: 'When you accept a submission, it becomes a coordinated creative matter and gathers here.' } },
  { id: 'waiting', label: 'Waiting on Others', statuses: ['changes_requested', 'approved', 'scheduled'],
    empty: { title: 'Nothing in waiting', lede: 'Submissions back with a creator, or moving toward publication, will appear here.' } },
  { id: 'done', label: 'Completed', statuses: ['published', 'not_accepted'],
    empty: { title: 'Nothing completed yet', lede: 'Published and closed submissions gather here in time.' } },
  { id: 'all', label: 'Everything', statuses: null,
    empty: { title: 'The desk is clear', lede: 'No submissions yet. When one arrives, it will be waiting here.' } },
];
function groupDef(id: DeskGroup): GroupDef { return DESK_GROUPS.find((g) => g.id === id) || DESK_GROUPS[0]; }

let deskFilter: DeskGroup = 'review';
let deskSelectedId: number | null = null;

function renderDesk(root: HTMLElement): void {
  setMode('seated');

  const filters = el('div', { class: 'hq-deskbar__filters', role: 'group', 'aria-label': 'Show' });
  for (const g of DESK_GROUPS) {
    const chip = el('button', {
      class: 'hq-chip', type: 'button', 'data-filter': g.id,
      'aria-pressed': deskFilter === g.id ? 'true' : 'false',
    }, g.label);
    chip.addEventListener('click', () => { deskFilter = g.id; deskSelectedId = null; renderDesk(root); });
    filters.append(chip);
  }

  const list = el('div', { class: 'hq-inbox', id: 'hq-inbox', 'aria-live': 'polite', 'aria-busy': 'true' },
    el('p', { class: 'hq-state__lede' }, 'Opening the inbox…'));
  const detail = el('div', { class: 'hq-detail', id: 'hq-detail' },
    el('p', { class: 'hq-detail__empty' }, 'Choose a submission to read it.'));

  const desk = el(
    'section',
    { class: 'hq-view hq-view--seated hq-view--desk', 'aria-label': 'Founder’s Desk' },
    el(
      'div',
      { class: 'hq-view__inner container' },
      el(
        'div',
        { class: 'hq-seated__bar' },
        el('a', { class: 'hq-back', href: getRoom(HOME_ROOM)!.route }, '← Return to the Executive Office'),
        renderRail(HOME_ROOM),
      ),
      el(
        'header',
        { class: 'hq-seated__head' },
        el('p', { class: 'hq-eyebrow label' }, 'Executive Office'),
        el('h1', { class: 'hq-title hq-title--seated' }, 'Founder’s Desk'),
        el('p', { class: 'hq-lede' }, 'Every submission, gathered in one place. Make the few decisions that are yours to make; the Editorial Office keeps the full review.'),
      ),
      el('div', { class: 'hq-deskbar' }, filters),
      el('div', { class: 'hq-desk' }, list, detail),
    ),
  );

  root.replaceChildren(desk);
  window.scrollTo({ top: 0 });
  void loadInbox(root);
  if (deskSelectedId != null) void loadDetail(root, deskSelectedId);
}

async function loadInbox(root: HTMLElement): Promise<void> {
  const host = root.querySelector('#hq-inbox') as HTMLElement | null;
  if (!host) return;
  // Fetch every submission and group client-side — the founder groupings are a
  // presentation layer over the existing statuses; the API is unchanged.
  const res = await fetchInbox();
  host.setAttribute('aria-busy', 'false');

  if (!res.ok) {
    host.replaceChildren(deskState(
      res.offline ? 'The desk is offline' : 'The desk couldn’t load',
      res.offline ? 'Your work is safe — try again in a moment.' : res.error,
    ));
    return;
  }
  const def = groupDef(deskFilter);
  const items = (res.data.submissions || []).filter((s) => def.statuses === null || def.statuses.includes(s.status));
  if (items.length === 0) {
    host.replaceChildren(deskState(def.empty.title, def.empty.lede));
    return;
  }

  const ul = el('ul', { class: 'hq-inbox__list' });
  for (const s of items) {
    const row = el('button', {
      class: 'hq-inbox__row', type: 'button', 'data-id': String(s.id),
      ...(s.id === deskSelectedId ? { 'aria-current': 'true' } : {}),
    },
      el('span', { class: 'hq-inbox__name' }, s.name),
      el('span', { class: 'hq-inbox__meta' }, `${typeLabel(s.type)} · ${fmtAge(s.created_at)}`),
      el('span', { class: 'hq-inbox__summary' }, s.summary || ''),
      statusPill(s.status),
    );
    row.addEventListener('click', () => { deskSelectedId = s.id; markSelected(root, s.id); void loadDetail(root, s.id); });
    ul.append(el('li', {}, row));
  }
  host.replaceChildren(ul);
}

function markSelected(root: HTMLElement, id: number): void {
  root.querySelectorAll('.hq-inbox__row').forEach((r) => {
    if (r.getAttribute('data-id') === String(id)) r.setAttribute('aria-current', 'true');
    else r.removeAttribute('aria-current');
  });
}

async function loadDetail(root: HTMLElement, id: number): Promise<void> {
  const host = root.querySelector('#hq-detail') as HTMLElement | null;
  if (!host) return;
  host.replaceChildren(el('p', { class: 'hq-detail__empty' }, 'Opening…'));
  const res = await fetchItem(id);
  if (!res.ok) {
    host.replaceChildren(deskState(
      res.offline ? 'Offline' : 'Couldn’t open this submission',
      res.offline ? 'Your work is safe. Try again shortly.' : res.error,
    ));
    return;
  }
  renderDetail(root, host, res.data.submission);
}

function renderDetail(root: HTMLElement, host: HTMLElement, s: SubmissionDetail): void {
  const head = el('div', { class: 'hq-detail__head' },
    el('div', { class: 'hq-detail__title' },
      el('h2', {}, s.name), statusPill(s.status)),
    el('p', { class: 'hq-detail__sub' }, `${typeLabel(s.type)} · ${s.email} · arrived ${fmtAge(s.created_at)}`),
  );
  if (s.summary) head.append(el('p', { class: 'hq-detail__summary' }, s.summary));

  // Once ACCEPTED, the submission becomes a coordinated creative matter: the House
  // derives who is responsible and the next step, so the Founder never re-enters
  // the work or assigns departments by hand. Otherwise, the valid inline decisions
  // (derived from the shared transition rules; the API re-validates on the server).
  let actions: HTMLElement;
  if (isAcceptedMatter(s.status)) {
    actions = buildMatterPanel(deriveCreativeMatter(s)!);
  } else {
    actions = el('div', { class: 'hq-detail__actions', role: 'group', 'aria-label': 'Decisions' });
    const available = inlineActions(s.status);
    if (available.length === 0) {
      actions.append(el('p', { class: 'hq-detail__resolved' }, 'Nothing to decide here — the Editorial Office holds the full review.'));
    } else {
      for (const a of available) {
        const btn = el('button', { class: 'hq-action', type: 'button', 'data-to': a.status }, a.label);
        btn.addEventListener('click', () => { void doAdvance(root, host, s.id, a.status, btn); });
        actions.append(btn);
      }
    }
  }

  // Internal note (audited through the existing API; never emailed, never public).
  const noteField = el('textarea', { class: 'hq-note__field', rows: '2', 'aria-label': 'Internal note', placeholder: 'Add a private note…' }) as HTMLTextAreaElement;
  const noteBtn = el('button', { class: 'hq-action hq-action--ghost', type: 'button' }, 'Add note');
  noteBtn.addEventListener('click', () => { void doNote(root, host, s.id, noteField, noteBtn); });
  const note = el('div', { class: 'hq-note' }, noteField, noteBtn);

  // The correspondence + audit trail (read-only), newest at the bottom.
  const thread = el('div', { class: 'hq-thread' }, el('p', { class: 'hq-thread__label label' }, 'History'));
  const entries = [
    ...s.messages.map((m) => ({ at: m.created_at, who: m.author || 'system', text: noteText(m), kind: 'note' })),
    ...s.events.map((e) => ({ at: e.created_at, who: e.actor, text: eventText(e), kind: 'event' })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  for (const e of entries) {
    thread.append(el('div', { class: `hq-thread__row hq-thread__row--${e.kind}` },
      el('span', { class: 'hq-thread__meta' }, `${fmtAge(e.at)} · ${e.who}`),
      el('span', { class: 'hq-thread__text' }, e.text)));
  }

  host.replaceChildren(head, actions, note, thread);
}

/**
 * THE ACCEPTED CREATIVE MATTER — presented in the Headquarters' institutional
 * language. It states what is true (which areas are responsible, the next step),
 * offers the correct existing workspace to open, and never claims work has
 * happened or exposes software mechanics. All of it is derived from the accepted
 * submission and its requested involvement — no new state, no fabricated activity.
 */
function buildMatterPanel(m: CreativeMatter): HTMLElement {
  const panel = el('section', { class: 'hq-matter', 'aria-label': 'The accepted creative matter' });
  panel.append(el('p', { class: 'hq-matter__eyebrow label' }, m.phase === 'settled' ? 'In the House’s record' : 'Accepted — in coordination'));
  panel.append(el('p', { class: 'hq-matter__narrative' }, matterNarrative(m)));

  // The responsible Collective areas, each with what it holds (derived, not claimed).
  if (m.responsibilities.length) {
    const list = el('ul', { class: 'hq-matter__areas' });
    for (const a of m.responsibilities) {
      const role = a === 'Production' && m.voiceNotes.eligible
        ? `will coordinate ${m.voiceNotes.purpose} in the Voice Notes Studio`
        : responsibilityRole(a);
      list.append(el('li', { class: 'hq-matter__area' },
        el('span', { class: 'hq-matter__area-name' }, a),
        el('span', { class: 'hq-matter__area-role' }, ` ${role}`)));
    }
    panel.append(list);
  }

  // The Voice Notes Studio handoff — only when a spoken/recorded element fits.
  // The existing Studio does not ingest parameters, so the House carries the
  // context here beside the entrance rather than inventing a parallel state.
  if (m.voiceNotes.eligible && m.phase === 'active') {
    const hand = el('div', { class: 'hq-matter__handoff' },
      el('p', { class: 'hq-matter__handoff-eyebrow label' }, 'Production → Voice Notes Studio'),
      el('p', { class: 'hq-matter__handoff-context' },
        `For ${m.artist} — ${m.voiceNotes.purpose}. Carry this context into the session; the Studio opens ready.`),
      el('a', { class: 'hq-matter__handoff-enter button', href: VOICE_NOTES_STUDIO.href }, VOICE_NOTES_STUDIO.label));
    panel.append(hand);
  }

  // The single next institutional recommendation + the workspace it opens.
  const next = nextRecommendation(m);
  const nextEl = el('div', { class: 'hq-matter__next' },
    el('p', { class: 'hq-matter__next-eyebrow label' }, 'Next'),
    el('p', { class: 'hq-matter__next-line' }, next.line));
  if (next.open) nextEl.append(el('a', { class: 'hq-action hq-action--ghost', href: next.open.href }, next.open.label));
  panel.append(nextEl);

  panel.append(el('p', { class: 'hq-matter__disposition' }, m.disposition));
  return panel;
}

async function doAdvance(root: HTMLElement, host: HTMLElement, id: number, status: SubmissionStatus, btn: HTMLButtonElement): Promise<void> {
  btn.disabled = true; btn.textContent = 'Saving…';
  const res = await advanceStatus(id, status);
  if (!res.ok) {
    btn.disabled = false; btn.textContent = 'Try again';
    host.prepend(el('p', { class: 'hq-detail__error' }, res.offline ? 'Offline — not saved.' : res.error));
    return;
  }
  // The spine is authoritative — re-read the item and the list to reflect it.
  await loadDetail(root, id);
  void loadInbox(root);
}

async function doNote(root: HTMLElement, host: HTMLElement, id: number, field: HTMLTextAreaElement, btn: HTMLButtonElement): Promise<void> {
  const body = field.value.trim();
  if (!body) { field.focus(); return; }
  btn.disabled = true; btn.textContent = 'Saving…';
  const res = await addNote(id, body);
  if (!res.ok) {
    btn.disabled = false; btn.textContent = 'Try again';
    host.prepend(el('p', { class: 'hq-detail__error' }, res.offline ? 'Offline — not saved.' : res.error));
    return;
  }
  await loadDetail(root, id);
}

/* --- desk helpers -------------------------------------------------------- */

function deskState(title: string, lede: string): HTMLElement {
  return el('div', { class: 'hq-state hq-state--empty', role: 'note' },
    el('p', { class: 'hq-state__title' }, title),
    el('p', { class: 'hq-state__lede' }, lede));
}

function statusPill(status: string): HTMLElement {
  return el('span', { class: 'hq-pill', 'data-status': status }, STATUS_LABELS[status] || status);
}

function typeLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function noteText(m: { body: string; kind: string }): string {
  return m.kind === 'internal_note' ? `Note: ${m.body}` : m.body;
}

function eventText(e: { action: string; from_status: string | null; to_status: string | null; detail: string | null }): string {
  if (e.action === 'status_changed') {
    return `Moved ${e.from_status ? (STATUS_LABELS[e.from_status] || e.from_status) + ' → ' : ''}${STATUS_LABELS[e.to_status || ''] || e.to_status}`;
  }
  if (e.action === 'created') return 'Submitted';
  if (e.action === 'message_added') return e.detail === 'acknowledgment' ? 'Acknowledgment sent' : 'Note added';
  return e.action;
}

// Compact relative age from a D1 'YYYY-MM-DD HH:MM:SS' (UTC) timestamp.
function fmtAge(ts: string): string {
  if (!ts) return '';
  const iso = ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z';
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* --- Morning Arrival ceremony -------------------------------------------- */

/**
 * The first open of the day. A brief warm light-up before the residence resolves
 * — never on every navigation. Hard ceiling of 4s and ALWAYS skippable (button,
 * click, or any key). Under reduced motion it does not play at all; the founder
 * lands directly in a complete room (Build Bible §9.3, §4.2).
 */
function playArrival(done: () => void): void {
  // The arrival is the residence's eternal first-of-summer morning — it always
  // greets as morning, regardless of the real clock. The time-of-day greeting is
  // a real-world courtesy shown in the scene, not in this ceremony.
  const overlay = el('div', { class: 'hq-arrival', role: 'dialog', 'aria-label': 'Entering the Headquarters' });
  const enter = el('button', { class: 'hq-arrival__enter', type: 'button' }, 'Enter');
  overlay.append(
    el(
      'div',
      { class: 'hq-arrival__inner' },
      el('p', { class: 'hq-arrival__wordmark wordmark' }, 'Luscious Honey Collective'),
      el('p', { class: 'hq-arrival__greeting' }, 'Good morning.'),
      el('p', { class: 'hq-arrival__line' }, 'You’re safe. You’re well. It’s a beautiful morning.'),
      enter,
    ),
  );

  let finished = false;
  let timer = 0;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timer);
    overlay.removeEventListener('click', finish);
    document.removeEventListener('keydown', onKey);
    overlay.classList.add('is-leaving');
    const cleanup = (): void => { overlay.remove(); done(); };
    // Let the exit fade run, but never block the founder from the work.
    overlay.addEventListener('transitionend', cleanup, { once: true });
    window.setTimeout(cleanup, 700);
  };
  const onKey = (e: KeyboardEvent): void => { if (e.key) finish(); };

  overlay.addEventListener('click', finish);
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  // Reveal on the next frame so the entrance transition runs.
  requestAnimationFrame(() => overlay.classList.add('is-in'));
  enter.focus({ preventScroll: true });

  timer = window.setTimeout(finish, 3200); // well under the 4s ceiling
}

let arrivalHandled = false;

/** Play the arrival at most once per session-load, and only once per calendar day. */
function maybePlayArrival(then: () => void): void {
  if (arrivalHandled || !shouldPlayArrival()) { then(); return; }
  arrivalHandled = true;
  if (prefersReducedMotion()) { markArrivalSeen(); then(); return; }
  playArrival(() => { markArrivalSeen(); then(); });
}

/* --- router -------------------------------------------------------------- */

/** Parse the leading segment of the hash, e.g. '#/operations' → 'operations'. */
function currentSegment(): string {
  return location.hash.replace(/^#\/?/, '').split('/')[0] ?? '';
}

/** The second segment, e.g. '#/executive/desk' → 'desk'. */
function subSegment(): string {
  return location.hash.replace(/^#\/?/, '').split('/')[1] ?? '';
}

function route(): void {
  const root = document.getElementById('hq-app');
  if (!root) return;

  const seg = currentSegment();

  // Empty hash → restore the last room from Headquarters Memory (or the atrium).
  if (seg === '') {
    const restored = loadLastRoom();
    location.replace(`${location.pathname}${getRoom(restored ?? HOME_ROOM)!.route}`);
    return;
  }

  if (seg === 'denied') {
    renderAccessDenied(root);
    return;
  }

  // The Office of the Chief of Staff is an operational WORKSPACE, not a room in
  // the residence (Headquarters is architecturally complete). It is reached from
  // the House Toolbar / Quick Actions, lives at #/chief-of-staff, and is handled
  // here — before the room registry — so it never appears in the atrium or rail.
  if (seg === 'chief-of-staff') {
    renderChiefOfStaff(root);
    window.scrollTo({ top: 0 });
    root.setAttribute('tabindex', '-1');
    root.focus({ preventScroll: true });
    return;
  }

  if (!isRoomId(seg)) {
    renderError(root);
    return;
  }

  const room = getRoom(seg)!;
  saveLastRoom(room.id); // remember where we are, for the next return
  if (room.kind === 'atrium') {
    // The Executive Office has a seated work state: the Founder’s Desk.
    if (room.id === HOME_ROOM && subSegment() === 'desk') renderDesk(root);
    else renderScene(root);
  } else if (room.id === 'operations') {
    // The Operations Office is the first department with a real, room-first
    // purpose — the flow view over the spine. Every other live department keeps
    // the generic seated placeholder until its own milestone.
    renderOperations(root, room);
  } else if (room.id === 'creative') {
    // The Creative Director room — the library where the making lives.
    renderCreative(root, room);
  } else if (room.id === 'production') {
    // The Production Suite — a glass studio for momentum without noise.
    renderProduction(root, room);
  } else if (room.id === 'growth') {
    // The Growth Studio — a sunlit publishing salon overlooking the horizon.
    renderGrowth(root, room);
  } else if (room.id === 'business') {
    // The Business Office — a private counsel's study where what's built is kept safe.
    renderBusiness(root, room);
  } else {
    renderSeated(root, room);
  }

  // Minimal navigation transition only: return focus to the top of the surface.
  window.scrollTo({ top: 0 });
  root.setAttribute('tabindex', '-1');
  root.focus({ preventScroll: true });
}

/* =============================================================================
   HEADQUARTERS SHARED SERVICES — Dictation + Calendar (Usability sprint).
   One quiet launcher, available in every room; two calm overlays. Native to the
   residence, touch-first. NO speech API and NO backend: transcripts and scheduled
   events are the founder's own and persist client-side (localStorage), architected
   so a real Web Speech / Google Calendar integration drops in without UI change.
   ============================================================================= */
const DRAFTS_KEY = 'lhc.hq.dictation.v1';

function currentRoomId(): RoomId {
  const seg = currentSegment();
  return isRoomId(seg) ? seg : HOME_ROOM;
}

let hqModal: HTMLElement | null = null;
let hqModalOpener: HTMLElement | null = null;
function closeHqModal(): void {
  hqModal?.remove(); hqModal = null;
  document.removeEventListener('keydown', hqModalKey);
  // Return focus to whatever opened the dialog (keyboard/screen-reader courtesy).
  if (hqModalOpener && document.contains(hqModalOpener)) hqModalOpener.focus({ preventScroll: true });
  hqModalOpener = null;
}
function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')];
}
function hqModalKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') { closeHqModal(); return; }
  if (e.key !== 'Tab' || !hqModal) return;
  // Contain Tab focus within the open dialog.
  const items = focusables(hqModal);
  if (items.length === 0) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
function openHqModal(panel: HTMLElement, label: string): void {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  closeHqModal();
  hqModalOpener = opener;
  const scrim = el('div', { class: 'hq-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': label });
  scrim.addEventListener('click', (e) => { if (e.target === scrim) closeHqModal(); });
  const close = el('button', { class: 'hq-modal__close', type: 'button', 'aria-label': 'Close' }, '×');
  close.addEventListener('click', closeHqModal);
  scrim.append(el('div', { class: 'hq-modal__sheet' }, close, panel));
  document.body.append(scrim);
  hqModal = scrim;
  document.addEventListener('keydown', hqModalKey);
  requestAnimationFrame(() => scrim.classList.add('is-in'));
  // Move focus into the dialog: the first meaningful control, else the close button.
  const target = focusables(panel)[0] ?? close;
  target.focus({ preventScroll: true });
}

const MIC_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 11a6 6 0 0 0 12 0"/><path d="M12 17v4"/></svg>`;

/** DICTATION — tap the mic, write the transcript, choose a destination, save.
    The mic arms the field (no fake listening — there is no speech API yet). */
function dictationPanel(): HTMLElement {
  const status = el('p', { class: 'hq-dict__status' },
    'Tap the microphone, then speak — or write your note below.');
  const mic = el('button', { class: 'hq-dict__mic', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Dictate' });
  mic.innerHTML = MIC_SVG;
  const field = el('textarea', { class: 'hq-dict__field', rows: '4',
    'aria-label': 'Transcript', placeholder: 'Your note…' }) as HTMLTextAreaElement;
  mic.addEventListener('click', () => {
    const armed = mic.getAttribute('aria-pressed') === 'true';
    mic.setAttribute('aria-pressed', armed ? 'false' : 'true');
    status.textContent = armed ? 'Tap the microphone, then speak — or write your note below.'
      : 'Go ahead — dictate naturally. (Type it here for now; voice arrives soon.)';
    field.focus();
  });

  const dest = el('select', { class: 'hq-dict__dest', 'aria-label': 'Destination' }) as HTMLSelectElement;
  for (const d of DICTATION_DESTINATIONS) dest.append(el('option', { value: d.id }, `${d.label} — ${d.hint}`));

  const save = el('button', { class: 'hq-action hq-dict__save', type: 'button' }, 'Save');
  const wrap = el('section', { class: 'hq-dict', 'aria-label': 'Dictation' },
    el('p', { class: 'hq-modal__eyebrow label' }, 'Dictation'),
    el('div', { class: 'hq-dict__miczone' }, mic, status),
    field,
    el('div', { class: 'hq-dict__row' },
      el('label', { class: 'hq-dict__lbl' }, 'Send to'), dest, save));

  save.addEventListener('click', () => {
    const draft = makeDraft(field.value, dest.value);
    if (!draft) { field.focus(); return; }
    if (draft.destination === 'calendar') { openHqModal(calendarPanel(draft.text), 'Headquarters Calendar'); return; }
    try {
      const raw = localStorage.getItem(DRAFTS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push(draft); localStorage.setItem(DRAFTS_KEY, JSON.stringify(arr));
    } catch { /* client-only; ignore */ }
    const label = DICTATION_DESTINATIONS.find((d) => d.id === draft.destination)?.label ?? draft.destination;
    wrap.replaceChildren(
      el('p', { class: 'hq-modal__eyebrow label' }, 'Dictation'),
      el('p', { class: 'hq-dict__done' }, `Saved to ${label}.`),
      el('p', { class: 'hq-dict__note' }, 'Held in the residence — kept for when this destination’s home is wired.'));
  });
  return wrap;
}

/** CALENDAR — a Headquarters service, home in the Executive Office, with a
    filtered view for whichever room it is opened from. Schedule → held client-side. */
function calendarPanel(prefill = ''): HTMLElement {
  const room = currentRoomId();
  const home = room === HOME_ROOM;
  const cats = home ? CALENDAR_CATEGORIES : categoriesForRoom(room);
  const active = new Set(cats.map((c) => c.id));
  const wrap = el('section', { class: 'hq-cal', 'aria-label': 'Headquarters Calendar' });
  const list = el('div', { class: 'hq-cal__list', 'aria-live': 'polite' });
  const chips = el('div', { class: 'hq-cal__filters', role: 'group', 'aria-label': 'Filter by category' });

  const labelOf = (id: string): string => CALENDAR_CATEGORIES.find((c) => c.id === id)?.label ?? id;

  const drawList = (): void => {
    const all = loadEvents();
    const scoped = home ? all : eventsForRoom(all, room);
    const shown = upcoming(scoped.filter((e) => active.has(e.category)), dayKey(), 40);
    list.replaceChildren();
    if (shown.length === 0) {
      list.append(el('p', { class: 'hq-cal__empty' },
        'Nothing scheduled yet. Add the first event below — it stays here in the residence.'));
      return;
    }
    for (const day of groupByDay(shown)) {
      const box = el('div', { class: 'hq-cal__day' }, el('p', { class: 'hq-cal__date' }, day.date));
      for (const e of day.events) {
        const ev = el('div', { class: 'hq-cal__event', 'data-cat': e.category },
          el('span', { class: 'hq-cal__cat' }, labelOf(e.category)),
          el('span', { class: 'hq-cal__title' }, e.title));
        if (e.note) ev.append(el('span', { class: 'hq-cal__evnote' }, e.note));
        box.append(ev);
      }
      list.append(box);
    }
  };

  const drawChips = (): void => {
    chips.replaceChildren();
    for (const c of cats) {
      const chip = el('button', { class: 'hq-chip hq-cal__chip', type: 'button', 'data-cat': c.id,
        'aria-pressed': active.has(c.id) ? 'true' : 'false' }, c.label);
      chip.addEventListener('click', () => {
        if (active.has(c.id)) active.delete(c.id); else active.add(c.id);
        chip.setAttribute('aria-pressed', active.has(c.id) ? 'true' : 'false');
        drawList();
      });
      chips.append(chip);
    }
  };

  // Scheduling workflow
  const title = el('input', { class: 'hq-cal__in', type: 'text', 'aria-label': 'Event', placeholder: 'What’s happening?' }) as HTMLInputElement;
  title.value = prefill;
  const date = el('input', { class: 'hq-cal__in', type: 'date', 'aria-label': 'Date' }) as HTMLInputElement;
  date.value = dayKey();
  const cat = el('select', { class: 'hq-cal__in', 'aria-label': 'Category' }) as HTMLSelectElement;
  for (const c of cats) cat.append(el('option', { value: c.id }, c.label));
  const add = el('button', { class: 'hq-action', type: 'button' }, 'Schedule');
  add.addEventListener('click', () => {
    const evt = makeEvent({ title: title.value, date: date.value, category: cat.value });
    if (!evt) { title.focus(); return; }
    const all = loadEvents(); all.push(evt); saveEvents(all);
    title.value = ''; active.add(evt.category);
    drawChips(); drawList();
  });

  wrap.append(
    el('p', { class: 'hq-modal__eyebrow label' }, home ? 'Headquarters Calendar · Executive Office' : `Calendar · ${getRoom(room)!.name}`),
    chips,
    list,
    el('div', { class: 'hq-cal__form' },
      el('p', { class: 'hq-cal__form-eyebrow label' }, 'Schedule'),
      el('div', { class: 'hq-cal__form-row' }, title),
      el('div', { class: 'hq-cal__form-row hq-cal__form-row--split' }, date, cat, add)),
  );
  drawChips(); drawList();
  return wrap;
}

/* --- Global Search (a House service; searches the archive) ----------------- */
function globalSearchPanel(): HTMLElement {
  const search = el('input', { class: 'hq-archive__search', type: 'search', enterkeyhint: 'search',
    'aria-label': 'Search the House', placeholder: 'Search the House…', autocomplete: 'off' }) as HTMLInputElement;
  const results = el('div', { class: 'hq-gsearch__results', 'aria-live': 'polite' },
    el('p', { class: 'hq-archive__empty' }, 'Loading the archive…'));
  let works: import('./adapters.ts').Submission[] | null = null;

  const draw = (): void => {
    const q = search.value.trim();
    results.replaceChildren();
    if (works === null) { results.append(el('p', { class: 'hq-archive__empty' }, 'The archive is offline just now.')); return; }
    if (!q) { results.append(el('p', { class: 'hq-archive__empty' }, 'Type a word to search the House’s work.')); return; }
    const tree = archiveTree(works, q, null);
    if (tree.total === 0) { results.append(el('p', { class: 'hq-archive__empty' }, 'Nothing matches yet — try another word.')); return; }
    const list = el('ul', { class: 'hq-gsearch__list' });
    for (const cat of tree.categories) for (const g of cat.groups) for (const e of g.entries) {
      const a = el('li', { class: 'hq-gsearch__hit' },
        el('span', { class: 'hq-gsearch__crumb' }, `${cat.label} · ${g.label}`),
        el('span', { class: 'hq-gsearch__name' }, e.name));
      if (e.summary) a.append(el('span', { class: 'hq-gsearch__desc' }, e.summary));
      list.append(a);
    }
    results.append(el('p', { class: 'hq-archive__count' }, `${tree.total} result${tree.total === 1 ? '' : 's'}`), list);
  };

  let t = 0;
  search.addEventListener('input', () => { window.clearTimeout(t); t = window.setTimeout(draw, 120); });
  void fetchInbox('published').then((res) => { works = res.ok ? res.data.submissions : null; draw(); });

  return el('section', { class: 'hq-gsearch', 'aria-label': 'Global search' },
    el('p', { class: 'hq-modal__eyebrow label' }, 'Search the House'),
    el('div', { class: 'hq-archive__searchwrap' },
      el('span', { class: 'hq-archive__search-ico', 'aria-hidden': 'true' }, '⌕'), search),
    results);
}

/* --- Notifications — real notice state from the D1 spine (/api/notifications).
   The panel mounts immediately and fills in when the desk answers; offline and
   empty states stay honest. Nothing here is fabricated and nothing is stored
   client-side. ------------------------------------------------------------- */
function notificationsPanel(): HTMLElement {
  const body = el('div', { class: 'hq-notes__body', 'aria-busy': 'true' },
    el('p', { class: 'hq-notes__note' }, 'Checking the desk…'));
  const panel = el('section', { class: 'hq-notes', 'aria-label': 'Notifications' },
    el('p', { class: 'hq-modal__eyebrow label' }, 'Notifications'), body);
  void mountNotifications(body);
  return panel;
}

async function mountNotifications(body: HTMLElement): Promise<void> {
  const res = await fetchNotifications();
  body.setAttribute('aria-busy', 'false');
  if (!res.ok) {
    body.replaceChildren(
      el('p', { class: 'hq-notes__empty' }, res.offline ? 'The desk is offline.' : 'The desk couldn’t answer.'),
      el('p', { class: 'hq-notes__note' }, res.offline ? 'Your work is safe — try again in a moment.' : res.error));
    return;
  }
  body.replaceChildren(...notificationsContent(res.data));
}

function notificationsContent(state: NotificationState): Node[] {
  const out: Node[] = [];

  // Matters currently sitting quiet — the live reading, freshest truth first.
  if (state.stale.length > 0) {
    out.push(el('p', { class: 'hq-notes__group label' },
      `Gone quiet (past ${state.config.staleAfterHours} hours)`));
    for (const s of state.stale.slice(0, 8)) {
      out.push(el('p', { class: 'hq-notes__item' },
        `${s.name} — ${typeLabel(s.type)} · ${STATUS_LABELS[s.status as SubmissionStatus] ?? s.status} since ${s.updated_at.slice(0, 10)}`));
    }
  }

  // The notice record — arrivals and stale digests, with delivery truth.
  if (state.notifications.length > 0) {
    out.push(el('p', { class: 'hq-notes__group label' }, 'Recent notices'));
    for (const n of state.notifications.slice(0, 10)) {
      const who = n.name ?? `#${n.submission_id}`;
      const what = n.kind === 'arrival'
        ? `New arrival — ${who}${n.type ? ` (${typeLabel(n.type)})` : ''}`
        : n.kind === 'stale' ? `Gone-quiet notice — ${who}` : `${n.kind} — ${who}`;
      const delivery = n.delivery_status === 'sent' ? 'notice sent'
        : n.delivery_status === 'failed' ? `notice failed — ${n.delivery_error ?? 'unknown error'}`
        : n.delivery_status === 'not_configured' ? 'recorded (no notice address configured)'
        : 'sending…';
      out.push(el('p', { class: `hq-notes__item${n.delivery_status === 'failed' ? ' is-failed' : ''}` },
        `${what} · ${delivery}`));
    }
  }

  if (out.length === 0) {
    out.push(
      el('p', { class: 'hq-notes__empty' }, 'Nothing needs you right now.'),
      el('p', { class: 'hq-notes__note' },
        'When work arrives or a matter goes quiet, it will appear here — quietly, and never as a red badge.'));
  } else if (!state.config.recipientConfigured) {
    out.push(el('p', { class: 'hq-notes__note' },
      'Notices are being recorded, but no outbound address is configured yet (NOTIFY_EMAIL).'));
  }
  return out;
}

/* --- Room-specific Quick Actions — each routes into a real House service ----- */
interface QuickAction { label: string; run: () => void; soon?: boolean; }
function quickActions(room: RoomId): QuickAction[] {
  const dictate = (): void => openHqModal(dictationPanel(), 'Dictation');
  const schedule = (): void => openHqModal(calendarPanel(), 'Headquarters Calendar');
  const search = (): void => openHqModal(globalSearchPanel(), 'Search the House');
  const go = (route: string) => (): void => { closeHqModal(); location.hash = route; };
  const common: Record<RoomId, QuickAction[]> = {
    executive: [{ label: 'Open the Chief of Staff', run: go('#/chief-of-staff') }, { label: 'Dictate', run: dictate }, { label: 'Schedule', run: schedule }, { label: 'Search', run: search }],
    operations: [{ label: 'Dictate Observation', run: dictate }, { label: 'Schedule Follow-up', run: schedule }, { label: 'Open Founder’s Desk', run: go('#/executive/desk') }, { label: 'Search', run: search }],
    creative: [{ label: 'Dictate', run: dictate }, { label: 'Open Archive', run: go('#/creative') }, { label: 'Schedule Creative Time', run: schedule }, { label: 'Search', run: search }],
    production: [{ label: 'Dictate Production Note', run: dictate }, { label: 'Schedule Session', run: schedule }, { label: 'Open Calendar', run: schedule }, { label: 'Search', run: search }],
    growth: [{ label: 'Dictate Idea', run: dictate }, { label: 'Schedule Conversation', run: schedule }, { label: 'Open Calendar', run: schedule }, { label: 'Search', run: search }],
    business: [{ label: 'Dictate Note', run: dictate }, { label: 'Schedule Follow-up', run: schedule }, { label: 'Open Archive', run: go('#/creative') }, { label: 'Search', run: search }],
  };
  return common[room] ?? common.executive;
}
function quickActionsPanel(): HTMLElement {
  const room = currentRoomId();
  const panel = el('section', { class: 'hq-qa', 'aria-label': 'Quick actions' },
    el('p', { class: 'hq-modal__eyebrow label' }, `Quick actions · ${getRoom(room)!.name}`));
  const grid = el('div', { class: 'hq-qa__grid' });
  for (const a of quickActions(room)) {
    const btn = el('button', { class: 'hq-qa__btn', type: 'button' }, a.label);
    if (a.soon) btn.append(el('span', { class: 'hq-qa__soon' }, 'not yet connected'));
    btn.addEventListener('click', a.run);
    grid.append(btn);
  }
  panel.append(grid);
  return panel;
}

/**
 * THE HOUSE TOOLBAR — one Headquarters-wide bar of House SERVICES, present in
 * every room and permanently part of the residence (not an app nav bar). Search ·
 * Dictate · Calendar · Notifications · room Quick Actions. iPad-first with clear
 * labels; icon-only compact on phone; keyboard-reachable; reduced-motion honoured.
 */
function mountHouseToolbar(): void {
  if (document.querySelector('.hq-bar')) return;
  const svc = (label: string, glyph: string, open: () => void, aria = label): HTMLButtonElement => {
    const b = el('button', { class: 'hq-bar__btn', type: 'button', 'aria-label': aria }) as HTMLButtonElement;
    b.innerHTML = `<span class="hq-bar__ico" aria-hidden="true">${glyph}</span><span class="hq-bar__lbl">${label}</span>`;
    b.addEventListener('click', open);
    return b;
  };
  const bar = el('nav', { class: 'hq-bar', 'aria-label': 'House services' },
    // The Office of the Chief of Staff — the founder's operational workspace,
    // reached from here rather than being a room in the residence. It navigates
    // (a full surface) instead of opening a modal like the other services.
    svc('Chief of Staff', ICON_COS, () => { closeHqModal(); location.hash = COS_ROUTE; },
      'Open the Office of the Chief of Staff'),
    svc('Search', ICON_SEARCH, () => openHqModal(globalSearchPanel(), 'Search the House')),
    svc('Dictate', ICON_MIC, () => openHqModal(dictationPanel(), 'Dictation')),
    svc('Calendar', ICON_CAL, () => openHqModal(calendarPanel(), 'Headquarters Calendar')),
    svc('Notifications', ICON_BELL, () => openHqModal(notificationsPanel(), 'Notifications')),
    svc('Actions', ICON_STAR, () => openHqModal(quickActionsPanel(), 'Quick actions')),
  );
  document.body.append(bar);
}

const ICON_COS = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3.5h6v2.5H9z"/><path d="M8.5 11h7M8.5 15h4.5"/></svg>`;
const ICON_SEARCH = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>`;
const ICON_MIC = MIC_SVG;
const ICON_CAL = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9h17M8 3v4M16 3v4"/></svg>`;
const ICON_BELL = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>`;
const ICON_STAR = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 4l2.2 4.9L19.5 9l-4 3.6 1.1 5.4L12 15.8 7.4 18l1.1-5.4-4-3.6 5.3-.1z"/></svg>`;

function boot(): void {
  setTimeOfDay();
  ensureAtmosphere();
  mountHouseToolbar();
  window.addEventListener('hashchange', route);
  // The Morning Arrival wraps the first render of the day, then the residence
  // resolves to wherever the founder last was.
  maybePlayArrival(route);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// Re-exported for tests and future milestones (kept off the module's happy path).
export { renderScene, renderSeated, renderOperations, renderCreative, renderProduction, renderGrowth, renderBusiness, renderChiefOfStaff, renderError, renderAccessDenied };
export type { Room, RoomId };
