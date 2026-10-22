// The Back button (Android / browser) for full-screen flows that have no history entry of their own, e.g. the story.
// holdBack() pushes ONE entry and calls onBack() when the player presses Back (the entry is re-pushed, so Back can be used
// again). The listener runs in the capture phase and stops the event, so the board's own Back handling ('go home?') never
// sees it. release() gives the entry back; the pop that causes is swallowed.

/** @returns {() => void} release */
export function holdBack(name, onBack) {
  const marker = { passivo: name };
  history.pushState(marker, '');
  let live = true;
  let swallow = 0;
  const onPop = (e) => {
    if (swallow > 0) { swallow -= 1; e.stopImmediatePropagation(); if (!live && swallow === 0) window.removeEventListener('popstate', onPop, true); return; }
    if (!live) return;
    e.stopImmediatePropagation();
    history.pushState(marker, '');
    onBack();
  };
  window.addEventListener('popstate', onPop, true);
  return () => {
    if (!live) return;
    live = false;
    if (history.state?.passivo === name) { swallow += 1; history.back(); } else window.removeEventListener('popstate', onPop, true);
  };
}
