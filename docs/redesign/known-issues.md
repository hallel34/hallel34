# Known issues (pre-existing, not part of the redesign; for the owner)

## 1. Offline within the first moments after the first load (P2-3)
**Present on 2af50a7 (before any redesign commit) and on this branch.**

Symptom: a first-time visitor whose device goes offline within roughly 0.8 s of the first load and then taps the daily challenge (or "Start") sees nothing happen: the lazy chunks (`play-*.js`, `challenge-*.css`, `scene-*.js`, `copy-*.js`) are not served from the cache yet. From about 1.5-2.5 s after the first load it works.

Repro (clean 2af50a7 build or this branch, `npx vite build && npx vite preview --port 4743`):
1. Open `http://localhost:4743/` in a fresh browser context (no storage), wait for `[data-screen="start"]`.
2. `await navigator.serviceWorker.ready`, wait **800 ms**, `context.setOffline(true)`.
3. Click `[data-action="daily"]`: `[data-screen="board"]` never appears (30 s timeout).
4. Same with a **2500 ms** wait: the board opens.
Observed in the repro: the page is controlled by the service worker and the cache holds 95 entries in both cases, so the exact cause was not found (the precache list does contain the play chunk); it looks like a window in which the first-load requests are still being completed / the first fetches of the lazy chunks are not yet cached.

Impact: only a first visit that goes offline almost immediately. A returning visitor is unaffected.
Why `tests/e2e/daily-smoke.mjs` waits 3000 ms (was 800): the test is about "the daily starts while offline", not about this window; at 800 ms it fails on a clean 2af50a7 as well, so the wait stays at 3000 ms until the owner decides whether to fix the window (for example by awaiting the precache before `skipWaiting`, or by showing a calm "connect once to finish installing" message).

## 2. 200% root-font zoom (QA P2-7)
Fox bubble text clips at 200% root font size (the old build is worse); the cash wrap and the flow chip clip slightly. Not addressed in the redesign.
