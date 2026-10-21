// The learning layer inside one game screen: queues the explainers (L1), shows the fox feedback after a decision (L3)
// and keeps the per-game record in sync. Pure rules live in src/learn and src/engine/learn.js; this file only wires them to the UI.
import { h } from './dom.js';
import { t } from '../i18n/index.js';
import { createNotes } from './notes.js';
import { openDictionary, recordSeen, explainEnabled } from './learn.js';
import { learnContent, conceptById, glossaryUi } from '../learn/content.js';
import { conceptsForTrigger, enqueueAt, pickExplainer, EXPLAINER_MAX_OFFERS } from '../learn/triggers.js';
import { renderFeedback } from '../learn/feedback.js';
import { seenConcepts } from '../learn/store.js';
import { markShown } from '../engine/learn.js';
import { getPrefs } from './prefs.js';

/** The feedback sentence as DOM: every slot value is isolated in a <bdi> (amounts keep their sign and digits together). */
export function feedbackNodes(template, slots) {
  const out = [];
  for (const part of template.split(/(\{\w+\})/)) {
    const m = part.match(/^\{(\w+)\}$/);
    if (m && m[1] in slots) {
      const v = String(slots[m[1]]);
      out.push(/^[+\-−]?[₪\d]/.test(v) && !/[\u0590-\u05FF]/.test(v) ? h('bdi', { dir: 'ltr' }, v) : h('bdi', null, v));
    } else if (part) out.push(part);
  }
  return out;
}

/**
 * @param zone      the .roll-zone element
 * @param mode      'family' | 'full'
 * @param seed      the player's game seed (a deterministic rotation of the phrasings)
 * @param getState / setState  the active player's engine state (setState also saves the match)
 * @param onActive  (boolean) the note slot is in use
 * @param onDismiss the explainer was dismissed with its button (keyboard focus goes back to the roll button)
 */
export function createLearnFlow({ zone, mode, seed, getState, setState, onActive, onDismiss }) {
  const notes = createNotes({ zone, onActive, onDismiss });
  const counters = {};
  let queue = []; // [{ id, turn, n }]: explainers waiting (see triggers.js pickExplainer)
  const offers = {}; // how many times an unread explainer was offered
  let shownThisTurn = false;
  // An explainer the player rolled past before reading (on screen under READ_MS) is not "seen": it comes back, at most
  // EXPLAINER_MAX_OFFERS times, so a fast player still meets every concept at its first relevant moments.
  const READ_MS = 3000;

  const state = () => getState();

  /** A moment of the game that may introduce concepts. */
  function trigger(name, ctx = {}) {
    const ids = conceptsForTrigger(name, { mode: state().mode ?? mode, ...ctx });
    queue = enqueueAt(queue, ids, seenConcepts(), state().turn ?? 0);
  }

  /** Fox feedback for requests from src/learn/feedback.js. */
  function feedback(requests) {
    for (const rq of requests) {
      const n = (counters[rq.group] = (counters[rq.group] ?? -1) + 1);
      const r = renderFeedback(learnContent().feedback, rq, { mode, seed, counter: n });
      if (rq.mark) setState(markShown(state(), rq.mark));
      if (rq.group === 'buy.diversify') trigger('diversified');
      if (!r) continue;
      notes.push({ kind: 'feedback', group: rq.group, pose: rq.pose, tone: rq.tone, plain: r.text, body: feedbackNodes(r.template, r.slots) });
    }
  }

  /** At the end of a turn: bring up the next queued explainer (at most one per turn, after any feedback). */
  function pumpExplain() {
    if (!explainEnabled() || shownThisTurn) return;
    const item = pickExplainer(queue, seenConcepts(), mode, state().turn ?? 0);
    if (!item) return;
    const id = item.id;
    shownThisTurn = true;
    queue = queue.filter((x) => x.id !== id);
    const ui = glossaryUi();
    notes.push({
      kind: 'explain', queued: item, urgent: (item.starved ?? 0) >= 1, concept: conceptById(id), label: ui.explainTitle, gotIt: ui.gotIt, whyLabel: ui.whyLabel,
      onMore: (cid) => openDictionary({ termId: cid }),
      onHide: ({ reason, ms }) => {
        const unread = reason === 'cleared' && ms < READ_MS;
        offers[id] = (offers[id] ?? 0) + (reason === 'cleared' ? 1 : 0);
        if (unread && offers[id] < EXPLAINER_MAX_OFFERS) queue = [{ ...item }, ...queue.filter((x) => x.id !== id)];
        else recordSeen(id);
      },
    });
  }

  return {
    notes, trigger, feedback, pumpExplain,
    /** A roll starts: a new turn (one explainer allowed again) and the old note goes away. */
    newTurn() {
      shownThisTurn = false;
      // an explainer that was queued but never shown (the player rolled on) goes back to the front of the queue
      // never shown (a feedback note was in front, or a card was open): it waits again, but its next turn is urgent
      const dropped = notes.clear().map((i) => ({ ...i.queued, starved: (i.queued.starved ?? 0) + 1 }));
      queue = [...dropped, ...queue.filter((x) => !dropped.some((d) => d.id === x.id))];
    },
    get queued() { return queue.map((x) => x.id); },
    destroy() { notes.destroy(); },
    // for tests / debugging
    get prefs() { return getPrefs(); },
    label: t('learn.foxSays'),
  };
}
