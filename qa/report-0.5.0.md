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
