// Lazy entry of the tutorial package: the story, the check and the parent card. Everything here is loaded with import()
// the first time one of them is needed (first family game, 'ראו שוב את הסיפור', the help button), never at startup.
import { runStory } from './story.js';
import { runAfterStory } from './check.js';
import { openParentCard } from './parent.js';
import { markStoryDone, loadTutorial } from '../../learn/tutorial-store.js';
import { markConceptSeen } from '../../learn/store.js';
import { STORY_COVERED } from '../../learn/tutorial.js';
import { toast } from '../fx.js';
import { tut } from '../hint-ui.js';

export { openParentCard };

/**
 * The whole 'first game' introduction: the 5 screens, then the optional 3-question check. Skipping saves the flag too (the story
 * never nags again; it can be replayed from the settings). Finishing marks the concepts the story covered as already explained.
 * @returns Promise<{ completed, skipped, quiz? }>
 */
export async function openStory({ engine, professionId = 'teacher', startAt = 0, offerCheck = true } = {}) {
  const r = await runStory({
    engine, professionId, startAt,
    onSkip: () => {
      markStoryDone();
      toast(tut().ui.skipToast);
    },
    onEnd: async (hosts) => {
      markStoryDone();
      for (const id of STORY_COVERED) markConceptSeen(id);
      if (!offerCheck) { hosts.close({ completed: true, skipped: false }); return null; }
      return runAfterStory(hosts, { openParent: () => openParentCard() });
    },
  });
  return r;
}

/** The first family game: play the introduction once per device (the flag lives in passivo.tutorial). */
export async function runFirstGameIntro({ engine, professionId }) {
  if (loadTutorial().storyDone) return { completed: false, skipped: false, already: true };
  return openStory({ engine, professionId });
}
