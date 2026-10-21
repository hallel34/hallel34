# QA Report - "חברה" v1

Date: 2026-10-21. Method: full read of CLAUDE.md, GAME_DESIGN.md, ROADMAP.md, public/index.html (470 script lines), firestore.rules, plus a node harness that loads the real pure functions from index.html (winnerOf, mafiaTarget, nightDone, resolveNightUpd, resolveVoteUpd, startError). No live Firebase and no browser run (no credentials). Multi-device races are analysed from the transaction/update code, not executed.
Harness: /tmp/claude-0/-home-user-hallel34/b51c1007-a287-5659-86c5-c866674bce38/scratchpad/sim.js (not part of the repo; ask if you want it committed under docs/qa/).

**Status: RED** (4 x P0/P1 gameplay blockers, 2 security P1, see below). Already known in ROADMAP and not re-ranked as new: host handoff, hidden roles, secure rules. They are listed so they get a severity.

Verified OK by simulation: vote tally (2-2-1 tie -> nobody, skip plurality -> nobody, clear plurality -> out), win condition (mafia >= others), doctor save, night does not resolve when mafia disagree or target is dead, startError rules.

---

## P0 / P1

### [P0] Night stalls forever if any mafia player leaves, or if mafia disagree; no host override
- Where: nightDone / mafiaTarget (night), leaveRoom
- Repro (sim confirmed): 5 players, 1 mafia. Mafia taps "יציאה מהחדר" (or closes the app) during night. alive mafia list is empty so mafiaTarget returns null, nightDone false forever. Same with 2 mafia that pick different targets: no tie-break, no timeout, no host "skip night" button.
- Also: leaveRoom removes the player but never re-runs winnerOf, so the game should end with "town wins" but doesn't. A leaving player in any phase never triggers a win check (e.g. leaver makes mafia >= others).
- Expected: leave/disconnect of a role holder is handled; night has a timeout / host override; win checked after any player removal.
- Fix: in leaveRoom transaction (and in a new host "remove player" action) recompute winnerOf and set status 'over'. Add night timeout (e.g. nightEndsAt = host-set 90s): on expiry use majority/random among mafia picks, treat missing doctor/detective as skipped. Add host button "סיום לילה" like endVote.

### [P1] Host as sole game master: any host disconnect/background freezes the game (known, confirm severity)
- All progress (reveal->night, night resolve, day timer end, vote resolve) runs only in the host client's hostTick (setInterval 500ms). Phone lock, tab in background (interval throttled), network drop, or app kill stops everything for all players. Wake lock is requested only on a click and is never re-acquired on visibilitychange.
- Fix: heartbeat field (hostSeen), any client may take over when hostSeen is older than ~10s (transaction guarded by status + hostSeen), and elect the next oldest player. Re-request wake lock on visibilitychange. Better long term: let ANY client run hostTick (all transactions are already idempotent and guarded by `expect` status), removing the host-role dependency for progression entirely.

### [P1] Detective result (and night secrecy) lost when the detective picks last
- detPick writes night.detective and checks.<round> together. If everyone else is already done, nightDone is true on that same snapshot, the host transaction flips to 'day' within ~100-500 ms. The detective sees the "תוצאת הבדיקה" screen for a flash, or never. vDay has no detective result view. The result is only shown in "בדיקות קודמות" the next night (filter rd < round), i.e. a full day late, so the core ability is unreliable.
- Same mechanism: doctor "אפשר לשנות עד סוף הלילה" is false once the last role picks; mafia "✓ הקורבן נבחר" is never visible.
- Related to roadmap item "משך לילה מינימלי": night end time also leaks who acts (first to finish, speed of day start).
- Fix: do not resolve instantly. Host sets nightEndsAt = max(now + random 15-25s, ...) after all picks; or resolve only when detective has pressed "הבנתי" (add night.ack.<id>). Also show last check in vDay for the detective.

### [P1] Players removed/ghosted from the lobby cannot be kicked; closed tabs block the next game
- A player who closes the tab in lobby or after a game stays in players (only the explicit leave removes). newGame (lobbyUpd) keeps them. In reveal, `alive(r).every(p=>p.ready)` never becomes true: game cannot start, no skip, no kick (roadmap "הוצאת שחקן"). Same in vote (host can end vote, OK) and night (no override, see P0).
- Fix: host kick button in lobby/reveal; presence heartbeat per player (players.<id>.seen); ready timeout; startGame ignores players with stale seen.

### [P1] Security: roles, night picks and detective results readable by all; any client can write anything
- firestore.rules: `allow read, write: if true`. Any player can read all roles (DevTools or a Firestore REST GET to rooms/XXXX), change settings, force status, write other players' votes (`votes.<otherId>`), mafia picks, mark all ready, delete or overwrite rooms (4-digit codes: 9000 guessable rooms, and createRoom overwrites any room older than 12h). Trivial cheating makes the game non-competitive.
- Fix (matches roadmap): Anonymous Auth; roles in rooms/{code}/private/{uid}; Rules restricting each uid to write only own player fields/votes/picks; state transitions via host or Cloud Function. Short-term minimum: rules with field-level checks and a longer alphanumeric code.

### [P1] Injection via unescaped player id (stored XSS / broken handlers)
- pid is generated on the client and stored as the map key, so a hostile client can join with an id like `x"><img src=x onerror=...>`. pgrid renders `data-arg="${t.id}"` without esc(), tallyHtml uses `esc(nameOf(t))` (OK) but keys are inserted raw in pgrid. A malicious joiner can execute script on all other devices (they hold only a random pid, but can read other things in the page, spoof actions, redirect). Also an id containing "." breaks the dotted update paths `night.mafia.${myId}` / `votes.${myId}` / `players.${myId}`.
- Fix: esc() all ids in attributes; validate ids with /^p[a-z0-9]{6,16}$/ on join (Rules), and server-assigned uid via Auth.

---

## P2 (should fix)

1. [P2] Mafia balance when allowed config is extreme: startError allows mafia*2 < n. For (n=5,m=2), (7,3), (9,4), (11,5), (13,6) after the FIRST unsaved night kill mafia >= others and the mafia wins immediately on night 1 (sim). Fix: require mafia*2 < n-1 (n>=m*2+2), or clamp the stepper to the allowed max and show the limit. Even allowed configs are mafia-heavy: with random play (pessimistic, town votes randomly) town wins only 20% (4p/1m), 29% (6p/1m), 8% (8p/2m), 3% (12p/3m), 0% (20p/6m). Real play is better because players reason, but the defaults for large rooms need a playtest; suggest default mafia = floor(n/4).
2. [P2] Leaver / identity: identity is localStorage pid only. Opening the invite link in another browser (WhatsApp in-app browser -> Chrome), private mode or cleared storage gives a new pid: "המשחק כבר התחיל" with no way to reclaim the seat; ls failure silently makes a new pid on every load. Add "rejoin as <name>" for unclaimed names or a per-seat PIN.
3. [P2] Refresh mid-phase works for room membership (resume via mafia_room), but local UI state is lost: reveal card un-flips (fine), and a refresh with a stale mafia_room of a deleted/finished room auto-enters it. Joining a different room via home leaves a ghost in the old room (stalls it, see P1 ghost issue). Clear/leave the old room before joining another.
4. [P2] Date.now() across devices: dayEndsAt is host clock; clients show timer using their own clock, so skew of seconds-minutes shows wrong time. Use serverTimestamp or send remaining ms and compute offset on first snapshot.
5. [P2] Whole-DOM re-render (app.innerHTML) on every snapshot: with 8-20 players each ready/vote/pick re-renders every screen; a tap between touchstart and touchend can be lost when the button is replaced, and focus/scroll is disturbed. Render only on changes relevant to the current view or diff.
6. [P2] Firestore doc hot-spot: one document, ~1 sustained write/sec soft limit. 20 players voting/readying within seconds plus the host transactions (which retry/abort under contention) can cause failed updates ("שגיאה: ..." toasts). Cost note: if a transaction fn returns null while the local snapshot says "done" the host retries every 500 ms, burning reads.
7. [P2] Renaming in lobby (join with existing pid) skips the duplicate-name check, so duplicate names are possible.
8. [P2] Peek modal: click handler ignores taps on the card (target !== modal), the "הקישו לסגירה" text does nothing; only the thin backdrop closes it. Make any tap close it.
9. [P2] Mid-night edits are mostly illusory (see detective P1). Also host-only controls can be fired by anyone (no check inside actions, Rules open).
10. [P2] Touch targets under 48px: stepper buttons 38x38, `.seg` time buttons (~38px high), toggles 52x30, `.peek` (~30px), `.btn.sm` (~35px), `.btn.link`. Fix to min 48px.
11. [P2] Accessibility: viewport has `maximum-scale=1` (blocks zoom); toggles have English aria-labels ("doctor"); no aria-pressed/role state; emoji-only cues; no aria-live for phase changes; toast has no role=status. Fonts load from Google CDN (render-blocking, privacy; fails offline - no PWA/service worker yet).
12. [P2] Toggle thumb uses `right:` positioning (physical) - OK in RTL now but breaks if LTR is ever added. Use inset-inline-start.
13. [P2] Hebrew copy: mixed gender/number forms: "בחר/י", "אינו/ה", "מוכן/ה", "את/ה" mixed with plural "בחרו", "דברו" and masculine singular in role descriptions ("בחר שחקן אחד להציל", "בדוק", "מצא"). CLAUDE.md asks for neutral/plural wording. Suggest plural-imperative everywhere ("בחרו", "בדקו"). "יורד לילה" -> "מתחיל הלילה". Mafia role is named "מאפיונר" in singular masculine only. Message "הרופא הציל את הקורבן בלילה האחרון" is stored in lastEvent but vOver shows it as the game-end text only when over; OK.
14. [P2] Vibration on every status change is 150ms for everyone, including dead/sleeping players; at night it reveals nothing but pattern is identical per phase (fine). No toggle to disable (accessibility).
15. [P2] Rooms are never deleted unless the last player leaves via the button (cost/clutter); createdAt-based 12h reuse can overwrite a live room that is >12h old.

## Not verified (needs live Firebase/browser)
Real latency races between two devices (e.g. doctor pick vs. host resolve in the same 100 ms), offline/reconnect behaviour of runTransaction, 360x800 layout and screenshots, axe/Lighthouse. By code: transactions guard on `expect` status and re-run nightDone/votes inside the tx, so double resolve and stale writes (late `night.*`/`votes.*` writes after a phase change) are harmless because night/votes are reset on entry to each phase.

## Suggested fix order
1. Night timeout/host override + win check on leave (P0).
2. Any-client progression with heartbeat (removes host SPOF and ghost blocking).
3. Night timing/detective result UX.
4. Auth + Rules + escape ids.
5. Config limits, 48px targets, copy.
