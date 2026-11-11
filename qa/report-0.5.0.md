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
