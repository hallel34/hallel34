# MaxiFox 0.5.0 QA report (branch maxifox-v050-career, tested on 201d1c3)

**Verdict: RED. P0: 0, P1: 3, P2: 8.** (independent qa-tester round, 2026-11-11)
Screenshots: `qa/screens/v050/` (kept locally, not committed). Later commits only add docs and `scripts/career-pace.mjs`.

## P1
1. **Profile screen shows raw string keys** on any launch after the first in a week (`src/ui/app.js:250` onProfile, `src/ui/career/flow.js:71` openProfile). `openProfile` never awaits `ensureCareerStrings`; the boot path only loads strings when `needsSettling` is true (`app.js:460`). Edit sheet and offline show the same keys. `smoke:career` misses it because strings were loaded by an earlier game. Fix: await `f.ready()` before openProfile, picker and edit sheet.
2. **Promotion card drops the raise amount** (`src/ui/career/promotion.js:23,34,42,65`, `src/ui/play.js:1353`). `money()` returns a DOM node and the same node is passed to two `tn()` calls, so the second call moves it out of the first. Keep text reads "נשארים לכם עוד  בכל חודש"; log lines read "המשכורת עלתה ב-, ..." and "נוספה הוצאה של  בחודש". Family, full and junior. Fix: fresh node per use, or strings.
3. **Return screen and rules text misstate the rank drop** (`he.json:1288` career.back.drop.body, `:1267` career.rules.week2). Copy says every profession drops one rank; the engine dropped rank 3 to 0 after 4 weeks (`SENIORITY_COUNT_AFTER_DROP`). Also `CAREER_MAX_DROPS_PER_RETURN=1` does not cap across weekly settlings (see docs/v050/owner-decisions-impact.md). Owner decision (2026-11-11): after 2 weeks of grace at most ONE drop per return; copy must match.

## P2
4. Career chip fails axe on Fridays at 320x568 (`label-content-name-mismatch`; start.js:44-48).
5. Rank titles ellipsized in the profile ranks list at 320x568 (`career.css:43`).
6. A junior profile does not make the game junior: game in ₪, end block in coins (flow.js `speak()` vs players-screen age chips).
7. `smoke:challenge` flakes under CPU load (B decided differently from A; race on the promotion card choice).
8. `SMOKE_PLAYERS=2` times out on a roll click. Identical on 0.5.1 baseline 53e6428, not in CI.
9. Educator wording: "השועל מקבל אביזר חדש" frames upgrade as a reward while only keep earns XP; promo-keep achievement. (Also the accessory is not rendered anywhere; see promotion-copy-review.md.)
10. `package.json` still says 0.4.0.
11. Rank 3 start cash flow exceeds the 300-2,500 skill band (by design with deal scaling): programmer 4,780, lawyer 5,580, engineer 4,620, teacher 3,260.

## Passed
- Engine: vitest 955/955, build OK, own fuzz 400 new seeds ranks 0-3 + promotion + junior replay identical, 120/120 tampered links rejected, resealed rank/promotion bits do not verify, formats 1-2 decode, 9 to 10 migration, daily and missions golden fixtures unchanged.
- Career logic (own script): Sun-Sat weeks, reset, drop, never below 0, titles kept, clock guards, time zones and DST identical, junior and no-age lose nothing, XP rules.
- Promotion: 96 combinations, raise 12% rounded to 100, upgrade expense 80%, no cash change, once per game, same turn per seed.
- UI 360x800 and 320x568, dark/light, reduced motion: no horizontal scroll, targets >=48px, RTL; no banned phrases; no Hebrew literals in JS.
- Balance (sensible bot, 40 seeds per cell): family medians 22/22/23/23, full 26/25/28/26, junior 22/22/23/22, 0% lost; reckless 26-35%; drift within +-2 vs docs/BALANCE.md; full mode 25-28 above target 15-25 (pre-existing).
- Smokes pass except items 7 and 8. Contrast 0 failures. Lighthouse home perf 0.91, a11y/BP/SEO 1.0. Offline and PWA OK.
- Child safety: upTo10 and no-age profiles protected; the 11-13 loss band remains the owner's Families-policy question (docs/v050/families-policy-check.md).

---

# Delta round (head 46ad01b) — verdict RED: P0 0, P1 1, P2 3

The three round-1 P1s are FIXED and re-verified: profile/picker/edit strings on a second launch in a week; promotion amounts in family/full/junior keep and upgrade (320x568 full upgrade run did not finish); drop rule (one drop per return over many weeks, weekly opens, daily opens; finished game clears `dropped`; upTo10 and no-age never lose; no chip warning after a drop; copy matches). Also verified: Friday deadline, Saturday counts, Fri 23:59 vs Sun 00:01, Israeli DST weeks, Friday-only/Saturday-only players never penalized, streak Fri-Sun free day, wrapping titles at 320, junior profile preselects the junior seat, version 0.5.0, educator strings (no cash, no accessory claim, lifestyle_creep, promo-keep wording), and no string claims the daily counts.

## [P1] smoke:career and smoke:challenge are still flaky
- smoke:career: 7 of 10 requested runs completed, 2 passed and 5 failed; 5 instrumented runs: 2 pass, 3 fail. smoke:challenge: 5 isolated runs, 3 pass, 2 fail.
- Failures: "a sentence after the choice carries its amounts (null)", "game A ended (start, 35 rolls)", "upgrade ... promo: kept" after the upgrade click, "B decided differently from A".
- Root cause (harness race, not load): the promotion's "keep" button reuses `data-action="pass"` (`src/ui/career/promotion.js:52`). The smokes select `#modal-root .layer:last-child [data-action="pass"]`; if the previous card closes and the promotion card opens between `decide()` and the click, the stale selector clicks keep. Page-level capture showed zero clicks in failing runs yet state already `kept`.
- Fix: give the promotion buttons their own data-action values (not `pass`), and make the smokes click atomically by card identity (`data-promotion` / `data-card`) in `tests/e2e/career-smoke.mjs` and `tests/e2e/challenge-smoke.mjs`. A fast double-tap on "pass" could also answer a fresh promotion card with keep: a real-user hazard, so the own action name also fixes that.

## [P2] Chip fails axe on the last day, at 360x800 and 320x568 (`label-content-name-mismatch`: visible "יום" vs aria "היום הוא היום האחרון"). Screenshot `home-warn-rank-dark-360x800.png`.
## [P2] Saturday chip shows the amber warn state although Saturday is a bonus day; copy should say so.
## [P2] SMOKE_PLAYERS=2 still fails (baseline, not in CI).

Gate at 46ad01b: vitest 959/959, build OK, all other smokes pass, contrast-check passes (designer script last run on 201d1c3, re-run needed), Lighthouse home perf 0.93/0.91/0.97, a11y 1.0.

---

# Round 3 (head 5b08bd3) — verdict GREEN: P0 0, P1 0, P2 1 (carried, not in CI)

## Flake checks (sequential, one run at a time, axe on)
- smoke:career x10: **10/10 pass**.
- smoke:challenge x10: **10/10 pass** (the last run overlapped the start of the next gate step; it still passed).
- Root cause of the earlier flakes confirmed closed: the promotion buttons no longer share `data-action="pass"`, and the smokes click by card key. No stale-click failure in 20 runs (before: 5 of 7 career runs and 2 of 5 challenge runs failed).

## Delta fixes
1. **Fast double tap.** The card opens with `promotion-keep` and `promotion-upgrade` both disabled; there is no `pass` on it. I fired programmatic clicks at 0 ms on the new card (keep, upgrade and a stale `pass` selector): nothing answered, card still open, save status `offered` after 150 ms. After the 450 ms settle the buttons were enabled and a real tap on upgrade recorded `upgraded`.
2. **Chip axe on the last day.** Friday, with and without a missed week, 360x800 and 320x568, dark and light: axe 0 violations, no horizontal scroll, targets >= 48px. The accessible name now leads with the visible text ("יום. ותק: היום הוא היום האחרון").
3. **Saturday bonus chip.** State `bonus`, label "בונוס", muted (no amber), no warn line on home; aria "שבת היא יום בונוס: משחק שמסתיים היום עדיין נחשב לשבוע הזה, אבל לא חייבים לשחק בשבת". Axe clean at both sizes and both themes. A profile that already played shows `kept`; a dropped profile shows no warning.

## Gate
- vitest 960/960; build OK.
- All other smokes pass: smoke (family), SMOKE_MODE=full, SMOKE_H=640, players-seats, daily, tutorial, round11, round12, business-demo, payday-pass, first-asset mission, short missions.
- contrast-check.py exit 0; designer contrast-v050.py 62 pairs, 0 failing.
- Lighthouse mobile home, 3 runs: performance 0.91 / 0.93 / 0.91, accessibility 1.0 on all (margin over 0.90 is thin; LCP 2.4-3.4 s).

## Open
- [P2] `SMOKE_PLAYERS=2` fails on a `roll` click timeout. Same on the 0.5.1 baseline, not in CI, not re-run this round.
- Not re-run this round: balance simulation, fuzz and offline/PWA (no engine or build-config change since round 2).

Regenerated qa/screens files restored; new untracked evidence only under qa/screens/v050/.

---

# Round 4 (head 1c8b5ce, live-play pass) — verdict GREEN: P0 0, P1 0, P2 3

Method: my own unseeded games in a real browser (random dice, my own driver, not the developer's smoke), plus the full gate. Screens: qa/screens/v050/r4/.

## Findings F1-F6, verified by playing
- **F1 career at each ending.**
  - Real short family game to rounds-over (360x800, no profile; 320x568, with a profile at rank 1): no career block, no profile prompt, no XP, profile `games` unchanged (3 before and after), no console error. This is the open owner decision, not a bug.
  - Real standard win (no profile): headline "חופש כלכלי!", the prompt "שמרו את ההתקדמות בפרופיל" appears; after creating a profile the game is credited (+380 XP = 60 for the game + 8 achievements, promotion week x2, teacher to rank 2 xp 110, 8 achievements stored), the rank-up shows, and a relaunch (reload) shows the home chip "ותק: שיחקתם השבוע" and a correct profile screen. No console errors.
- **F2 literal null/undefined/NaN.** My own scan of 105 screens (players, pick, preview sheets for 8 professions x ranks 0-3 with a profile and rank 0 without, family and full, board HUD for 8 professions x 2 modes, profile screen), text plus aria-label/alt/title: 0 hits.
- **F3 rounds-over end.** Headline "נגמרו הסיבובים", `data-freedom=false`, calm thinking fox (no confetti, no win sound), tagline "עוד לא הגעתם לחופש כלכלי: הכסף שעובד בשבילכם עוד לא מכסה את כל ההוצאות" (shown at 360x800; the tagline is hidden at 320x568 by the existing layout). Share text is honest: "שיחקנו 12 סיבובים ב-MaxiFox. כסף שעובד: ₪1,520, הוצאות: ₪8,210".
- **F4 recap and multiplayer copy.**
  - Solo recap ("מה למדתי"): "נגמרו הסיבובים, ועוד לא הגעתם לחופש כלכלי: ₪1,520 בחודש…". It never says someone else finished.
  - Hot-seat short game (2 players): winner by progress "הניצחון של שחקן1! … מי שהגיע הכי רחוק" and both recaps are honest. Player 2 reads "נגמרו הסיבובים, ועוד לא הגעתם לחופש".
  - Hot-seat full standard game: "…כשמישהו אחר הגיע לחופש כלכלי" appears only for the non-winner, which is correct there.
- **F5 glossary yield vs roi.** Distinct entries, each explicit that in the game they are the same calculation, with correct numbers (3,400 x 12 = 40,800 on 200,000 = 20.4%; 10,800 / 40,000 = 27% = about 3.7 years; 10,800 / 320,000 = about 3.4%; 12,200 x 12 / 1,800,000 = 8.1%). Family wording is child-appropriate; the repo's kid-vocabulary and glossary tests pass. I read the data, not the rendered dictionary.
- **F6 coffee cart (opp-biz-002) ledger.**
  - Played a seeded replay to the card at 360x800 and 320x568: rows "חובות היום 23,000", "+ הלוואה 80,000", "+ הלוואה מהבנק לתשלום הראשון 23,000", "= סך החובות אחרי הקנייה 126,000", exact. Cash short by 22,760, loan rounded up to 23,000.
  - Engine check over 30,960 deal-card states (400 seeds x 3 bots): total = report liabilities + mortgage + bank loan every time, bank loan always a multiple of 1,000. No clipping or horizontal scroll at either size.

## Other checks
- Real 2-player hot-seat: short family and standard full both played to the end. No horizontal scroll, no targets under 48px, no console errors.
- Junior profile at 320x568: junior seat preselected, all coins (end screen "110 מטבעות", "89 מטבעות"), no number over 999 outside cash, rank-up in child wording, relaunch shows the child chip "הקריירה שלכם תמיד מחכה לכם".
- 'Verified working' list: payday on the first roll "₪1,490 × 12 חודשים = ₪17,880, 9,000 to 26,880"; promotion keep/upgrade amounts (family, full, junior) correct in the cards and log; save and resume after reload (cash 26,880, turn 1 restored). Report math consistent in every recap.

## Gate
- vitest 969/969, build OK.
- `npm run smoke:live` x3: 3/3 pass.
- Smokes pass: smoke (family), SMOKE_MODE=full, SMOKE_H=640, career, challenge, players-seats, daily, tutorial, round11, round12, business-demo, payday-pass, first-asset mission, short missions.
- contrast-check.py exit 0, designer script 62 pairs 0 failing.
- Lighthouse mobile home x3: performance 0.93 / 0.91 / 0.93, accessibility 1.0.

## Open (P2)
1. Rounds-over end screen says "13 תורות" while the headline and share text say 12 rounds (the turn counter is one past the cap).
2. A solo share text reads "שיחקנו" (plural) for a one-player game.
3. The coffee-cart hint says "חסרים לכם ₪22,760" while the ledger shows a ₪23,000 bank loan; the rounding to 1,000 is not mentioned there.
