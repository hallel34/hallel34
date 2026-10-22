// The Back button (Android / browser) for full-screen flows that have no history entry of their own, e.g. the story.
// holdBack() pushes ONE entry and calls onBack() when the player presses Back (the entry is re-pushed, so Back can be used
// again). The listener runs in the capture phase and stops the event, so the board's own Back handling ('go home?') never
// sees it. release() only removes the listener (the harmless entry stays).

/** @returns {() => void} release */
export function holdBack(name, onBack) {
  const marker = { passivo: name };
  history.pushState(marker, '');
  let live = true;
  const onPop = (e) => {
    if (!live) return;
    e.stopImmediatePropagation();
    history.pushState(marker, '');
    onBack();
  };
  window.addEventListener('popstate', onPop, true);
  // release: the listener goes; the entry stays (a history.back() here could pop an entry the board pushed meanwhile)
  return () => {
    if (!live) return;
    live = false;
    window.removeEventListener('popstate', onPop, true);
  };
}
