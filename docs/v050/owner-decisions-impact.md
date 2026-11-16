# 0.5.0 owner decisions: scope and impact (analysis only, no code changed)

Branch maxifox-v050-career @ 201d1c3. New files only: this document and `scripts/career-pace.mjs`
(`node scripts/career-pace.mjs [--win=0.85] [--dailyxp=10]`, uses the real `awardGame`, `createProfile`, `promoWeekProfession`, config).

## (a) Drop rule: at most one drop per return, none for the protected band

### Finding: setting `CAREER_MAX_DROPS_PER_RETURN = 1` alone does NOT give the rule
`syncSeniority` counts `drops` in a local variable that starts at 0 on every call. The cap therefore limits one call, not one absence.
Verified on a copy of the tree with the constant set to 1: a player who opens the app every week and never finishes a game loses
a rank at week+3, +4 and +5 (rank 3 -> 2 -> 1 -> 0), because each weekly settling (`needsSettling` on launch) is a fresh call and `missed`
stays >= 2. The existing test `tests/career-config.test.js` "1 = at most one drop per return" only passes because it settles the whole
absence in ONE call.

### Exact changes
1. `src/engine/config.js`: `CAREER_MAX_DROPS_PER_RETURN = 1` (comment: per absence, not per settling). `SENIORITY_COUNT_AFTER_DROP` becomes
   irrelevant once the cap is 1 (nothing can follow a drop until a game is finished); keep it at 1 and say so in the comment, or delete it and its test.
2. `src/career/career.js`:
   - `parseProfile`: new field `dropped` (boolean, default false). No schema bump (an optional field; old records parse to false).
   - `syncSeniority`: seed `drops` from `profile.dropped ? CAREER_MAX_DROPS_PER_RETURN : 0`; when a drop happens set `dropped = true`;
     while `dropped`, a further missed week changes nothing (no reset, no drop; `missed` may keep counting). Return `dropped` in the profile.
   - `awardGame` (and `awardDaily` if (b) lands): `dropped: false` together with `missed: 0`.
   - `setAge`: a profile that becomes protected clears `dropped` as it clears `missed`.
3. `src/career/lite.js` `chipView`: when `p.dropped` there is nothing left to lose: never `warn`; state `open`/`kept` only. The
   `career.seniority.warnProgress/warnRank/warnAfterDrop` texts then are never shown after a drop (`warnAfterDrop` can go).
4. Strings (`src/i18n/he.json` career group): `career.rules.week2` add "פעם אחת בלבד עד שחוזרים למשחק" (one rank, once, until you finish a game);
   `career.back.drop.next` already reads right ("משחק אחד בכל שבוע, והכול נשמר").
5. Protected band: already implemented (`guarded` branch: only a `waited` event). Add a test that pins it with the cap on.
6. `docs/decisions.md`: replace item (4) of the 2026-11-11 build decisions.

### Tests to add (`tests/career.test.js`, `tests/career-config.test.js`)
- Default config: 9 absent weeks in ONE sync -> events `reset, drop` only; every rank exactly one lower.
- Weekly syncs over the same absence (the loop in the finding): ranks lower by exactly one after 6 weekly settlings; `dropped` true.
- Return, one game, then a new absence: reset, one drop again (the flag is cleared by `awardGame`).
- Clock set back after a drop restores nothing and does not clear `dropped`.
- Protected profile (`upTo10`, and `11to13` with `CAREER_PROTECTED_AGE`): only `waited`, `dropped` stays false, ranks untouched, however long.
- `setAge` unprotected -> protected clears `dropped`; protected -> unprotected starts with a grace week (existing).
- `chipView` after a drop: no `warn`.
- Replace the old "default drops once per further missed week" and `SENIORITY_COUNT_AFTER_DROP` tests; `career.test.js:163-174` ("one drop per further
  missed week", `missed` expected 1) is the current behaviour and must be rewritten.
- `smoke:career`: the return screen after a long absence shows the drop once and the chip afterwards has no warning.
Estimate: 0.5 day.

## (b) Daily challenge gives XP and seniority, once a day per profile

### Today
The daily has no profile: `recordOf` returns null for `state.daily`, `afterGame` and `endDailyGame` never touch `passivo.career`. It is a rank-0,
family-mode, one-player game with no promotion; its profession is the day's (`dailyProfessionId`). Results live per device in `passivo.dailyResults`
(by date), the streak in `passivo.dailyStreak`.

### Scope (recommended: small)
Keep ONE daily attempt per device per day (do not make the daily per profile: that would split results, streak, share text, resume slot and
the `?debug` reset by profile, roughly 3x the work and it changes "the same challenge for everyone").

| File | Change |
|---|---|
| `src/engine/config.js` | `XP_DAILY_WIN`, `XP_DAILY_LOSS` (proposal 10 / 5; see pace below). Nothing in the engine or daily rules. |
| `src/career/career.js` | `parseProfile` field `lastDailyDate` (date key or null); `awardDaily(profile, { date, outcome, professionId, today, professionIds })`: settle seniority, mark the week played (and `lastPlayDate`), pay XP into the day's profession, raise ranks; refuses when `date <= lastDailyDate` or `outcome === 'gaveUp'`. `games` is NOT incremented (so `profile.gamesFinished` keeps meaning real games). Refactor the shared tail of `awardGame`. |
| `src/career/finish.js` | `finishDaily({ engine, profile, entry, today })`: the ladder achievements (first-rank-up, top-rank) are judged after the XP lands as for a game; no other achievement and no counters (daily never feeds `badPasses`, `challengeStreak`, `wonProfessions`). |
| `src/ui/career/flow.js` | `afterDaily(entry, fresh)`: active profile -> credit and return `{ el, run }` for the result card, or the existing create-profile prompt when there is none; rank-up dialog reused. |
| `src/ui/app.js` | `finishDaily(m)`: after `commitDaily`, only when `out.fresh`, call `afterDaily`; pass the block into `createDailyResult`. `goDailyResult` for an already-done day shows no block. |
| `src/ui/screens/daily.js` | `createDailyResult({ career })`: mount the block. |
| `src/ui/career/screens.js` + `src/i18n/he.json` | `createEndBlock` variant for the daily; new string `career.xp.forDaily` ("אתגר יומי: {xp}") with a junior variant; update the wording listed in the last section. `tests/kid-vocabulary.test.js` already walks the career group. |
| `docs/decisions.md` | Reverse item (5) of 2026-11-11. |

### Which profile
The active profile at the moment the daily finishes (`activeProfile(loadCareer())`), like `afterGame`. Several profiles: whoever is active. Profile switching
is only on launch or from the profile sheet, so a mid-game switch is rare; resolving at the end (not the start) needs no change to `dailySave`.
No profile: nothing is credited; the end card shows the existing "שמרו את ההתקדמות בפרופיל" prompt, and creating the profile there credits that
daily at once (same pattern as the first game). No retroactive credit after leaving the screen, and none by merely opening an old result
(otherwise a sibling profile could claim the day's XP without playing).

### Once per day, clock skew
Three layers, all pure and testable:
1. `completeAttempt(...).fresh` (an existing entry for the date makes it false): the device already allows one result per date key.
2. Per profile `lastDailyDate`: credit only when `entry.record.date > lastDailyDate` (ISO keys compare as strings). The key is the day the
   game started (`state.daily.date`), so a game that crosses midnight is still that day's, once.
3. The week credit uses `dayKey()` at finish and `effectiveWeek` (existing 104-week jump guard).
Clock moved back: the earlier date is `<= lastDailyDate` -> nothing. Clock far forward then back: a `lastDailyDate` more than 1 day ahead of the
date being played is ignored (same rule as `recordPlay`), bounded to one credit per date key. A device clock can always be cheated on a
local-only game; this is the same stance as the streak.
A crash between the result write and the career write loses that one credit (the day is already "done"); accepted, mention in the README.

### XP amount and effect
- Proposal: win 10, timed out 5, gave up 0 (no XP, no seniority: otherwise "give up at once" keeps the week in two taps). Into the day's profession
  through the normal `gameXp` path, so the half-XP rule for a game below the profession's rank applies (5 once that profession is above rank 0).
  No promotion-week doubling, no achievements.
- Pace (script): daily-only play gives 7 of 8 professions rank 1 after 12 weeks, all 8 after 26 weeks and 13 of 24 possible ranks after a year; 7 dailies = 70 XP/week vs about 81 XP/week
  from 3 normal games. Higher than 10 would make the daily outrun real games; 10 keeps it a supplement.
- Seniority: a daily alone keeps the week. That makes the owner's weekly FOMO cheap for anyone who opens the app once a week for a 40-turn family game.
  This is the intended effect of the decision, flagged so it is chosen knowingly. (The alternative: count the daily for XP only.)
- Rank 0 / byte-identical: no engine, daily-state, `dailyResult`, `dailyResults`, `dailyStreak` or action-log change (the career writes happen after
  `endDailyGame`, in a separate key). The 4-date x 3-bot daily golden fixture and the replay of `DAILY_RNG_V2_FROM` days are unaffected; assert it with a
  test that runs the daily with and without a profile and compares `JSON.stringify` of the results and streak stores.

### Tests and smokes
- `career.test.js`: `awardDaily` pays XP once; second call same date pays 0; earlier date (clock back) pays 0; gave-up pays 0 and keeps no week;
  keeps the week and settles seniority first (reset/drop events); protected age gets XP and no loss; half XP above rank 0; `games` unchanged;
  ladder achievements only; far-future `lastDailyDate` ignored; two profiles each credited once for their own daily date.
- `daily.test.js`: stores byte-identical with and without a profile.
- `ui-flow.test.js`: `finishDaily` with a profile shows the block once, with no profile shows the prompt, creating a profile credits.
- `smoke:daily`: add a profile first, finish the daily at 360x800, see the XP line, reload -> the day shows done and no second credit.
  `smoke:career`: the chip turns to "kept" after the daily.
Estimate: 1.5 developer days (logic 0.5, UI and strings 0.5, tests and smokes 0.5) plus a short QA round.

### Anything that now implies saved progress that is not (until the daily is wired nothing should say it counts)
Nothing says the daily counts today; the risk is wording that says "any game":
- `career.rules.whatCounts` "כל משחק שמסתיים נחשב, גם בלי ניצחון." and `career.intro.how` / `howJunior` "מסיימים משחקים ... מקבלים נקודות ניסיון".
- `career.seniority.openText` / `warn*` ("משחק אחד שמסתיים עד סוף יום שבת", "אם לא יסתיים משחק"): a player who finished the daily is still told the week is open.
- `career.endBlock.toast` is shown only after a friend challenge; fine. `career.endBlock.createLine` on the end card appears only after a counting game; fine.
- The daily result screen and home card show the daily STREAK ("רצף", badges); that is real and saved separately, but sits next to "ותק": say on
  the rules sheet that the daily streak and seniority are different things.
Interim fix (strings only, no logic): `career.rules.whatCounts` -> "כל משחק רגיל שמסתיים נחשב, גם בלי ניצחון. האתגר היומי עדיין לא נחשב." and the same
sentence in the chip's `openText`. Remove once (b) ships. Also: the hot-seat games and practice missions do not count either; the rules sheet should say "משחק של שחקן אחד".
Separate, existing: `docs/decisions.md` (2026-11-10) says the daily streak "keeps its one free day a week", but `src/daily/streak.js` has no free
day: one missed day (a Saturday included) resets it. See (d).

## (c) Pace analysis (thresholds 90 / 180 / 300 kept)

### The best possible first game (win)
One game can earn at most 12 of the 16 achievements (240 XP): not `challenge-streak-3` (3 challenge games), `all-professions` (8 wins), `top-rank` (570 XP),
and `repaid-bank-loan` excludes `win-no-bank-loan`. Results with the real `awardGame` loop:

| first game | XP | rank after |
|---|---|---|
| perfect game, ordinary week | 30 + 220 = 250 | 1 (160/180 toward 2) |
| perfect game, in that profession's promotion week (x2 on everything) | 60 + 480 = 540 | 2 (270/300 toward 3) |
| plain win | 30 (60 in a promotion week) | 0 |

So a first game can never reach rank 3 (30 XP short even in the best case); the fastest first game is rank 2 and needs the promotion week.
Once only: a second identical perfect game pays game XP only; the one new record is `top-rank` when the rank reached unlocks it; offering
every stored id again pays 0 (`fresh` filter in `awardGame` and `awardAchievements`). OK.

### Over time (win rate 0.85, always plays at the top rank, one game a week at least, median over 16 start weeks)
| goal | 7 games/wk | 3 games/wk | 1 game/wk |
|---|---|---|---|
| rank 3, ONE profession, typical achievements | 12 g / 3 w | 9 g / 4 w | 10 g / 10 w |
| rank 3, ONE profession, no achievements | 18 g / 4 w | 18 g / 7 w | 18 g / 18 w |
| rank 3 in ALL 8, weakest first | 145 g / 22 w | 146 g / 50 w | 143 g / 143 w (2.7 y) |
| rank 3 in ALL 8, chasing the promotion profession (x2) | 108 g / 17 w | 94 g / 32 w | 86 g / 86 w |
| rank 1 in the first profession | 1-4 g, 1-2 w | 1-4 g, 1-2 w | 1-4 g, 1-4 w |

"Typical" = 4 achievements in game 1, about one per game up to 12 (it is a model; see the script header). Min-max ranges are in the script output.

### Verdict
- Rank 1 within the first one to three games and rank 2 within about 5-9 games is a good hook, not too fast: every promotion is a harder game
  (deal scale), so the ladder gates itself.
- One profession to rank 3 in 18 games (4-18 weeks) is reasonable. The 7-a-week player finishes it in about 4 weeks; fine because the long tail is the 8 professions.
- All 8 at rank 3: 22 weeks heavy, about 50 weeks at 3/wk, 2.7 years at 1/wk (86 weeks if the player chases the double-XP profession). Slow for the casual
  player, but nothing blocks play: the rank-0 game stays available. It is the right size for a completionist goal.
- Recommendation: keep 90/180/300, `XP_WIN` 30, `XP_ACHIEVEMENT` 20. Do not raise the daily XP above about 10. If a casual all-8 goal in under two years is wanted,
  raise `PROMO_WEEK_XP_MULTIPLIER` to 3 rather than lowering thresholds (it only pays when the player chases the profession of the week, which is the retention behaviour).
  If the owner finds 3-4 weeks to rank 3 for heavy players too fast, `RANK_XP_NEEDED[2]` 300 -> 400 stretches it to about 5-6 weeks and leaves the first two ranks alone.
- Caveat: a first game in the promotion week of the chosen profession gives rank 2 at once (540 XP). That week is shown on home, so it is a planned reward.

## (d) Shabbat

Verified with `src/daily/calendar.js` and the real functions (scratch run):
- Weeks are Sunday to Saturday, local calendar date (`weekNumber`: 2026-11-08 Sunday = start, 2026-11-14 Saturday = end, 2026-11-15 starts the next).
- A game counts for the week of the day it FINISHES (`dayKey()` at the end, not the start). A game finished on Friday or on Saturday keeps the week
  (checked: Friday 13.11 and Saturday 21.11 / 28.11 -> no event, `missed` 0). A game finished on Sunday counts for the new week (a missed week before it gives the reset).
  Midnight is civil midnight, so a game finished Saturday night after Shabbat ends still counts for the old week until 00:00.
- Nobody is forced to play on Saturday: a player who finishes one game Sunday to Friday never loses anything. The only way to be affected by Saturday
  is to have played on none of the six days before it.
- But the wording pushes Saturday: `CAREER_DEADLINE_WEEKDAY = 6`, the chip counts Thursday as "3 days left" (Thu, Fri, Sat) and the warning says
  "עד סוף יום שבת". For a Shabbat-keeping family that overstates the time left by one day and reads like "play on Shabbat". `CAREER_DEADLINE_WEEKDAY = 5`
  only changes the wording and the day count (the week still ends Saturday, so a Saturday game still counts).
  Recommended: set it to 5 (Friday), so Thursday shows 2 days and Saturday shows "היום האחרון" only for those who need it.
- Proposed wording (plural address, no promise that is false):
  - rules: "יש שישה ימים לסיים משחק, מיום ראשון עד יום שישי. שבת היא יום בונוס: משחק שמסתיים בשבת נחשב לאותו שבוע, אבל לא חייבים לשחק בשבת."
  - warn: "אם לא יסתיים משחק עד סוף יום שישי ({days}), ...". On Saturday (the real last day): "היום האחרון של השבוע".
  - Do not write "שבת לא נחשבת": it counts when played.
- Checks to add: `calendar` boundary test (Sat -> Sun, a DST week in Israel: last Friday of March, last Sunday of October); game on Friday 23:59 and Sunday 00:01
  fall in different weeks; Friday-only and Saturday-only players are never penalized over 10 weeks; chip days with the deadline 5 (Thu = 2, Fri = 1, Sat = 1, never 0);
  string check that the warn text names Friday when the deadline is 5; a junior profile still never sees a loss word on any weekday.
- Not Shabbat-aware: the day key is the device's civil date (a traveller changes day at the local midnight). Mention in the README.
- Related, existing: the daily STREAK breaks on a missed Saturday (no free day in code, although the decision log says there is one). If (b) ships, daily
  XP is per day, so a Shabbat skipper simply earns six dailies a week (no loss). Recommended small fix with (b): in `recordPlay` / `streakView` treat Friday -> Sunday as consecutive
  (one weekly free Saturday), which also makes the log true.

## Order of work and open questions for the owner
1. (a) first: the drop rule has a real bug under the owner's chosen value. 0.5 day.
2. (d) wording and `CAREER_DEADLINE_WEEKDAY = 5`: 0.25 day, strings and one constant.
3. (b) after the QA round: 1.5 days. Owner to confirm: daily XP 10/5 (give-up 0), no daily achievements, the daily keeps its seniority power knowingly, Saturday free day in the streak.
4. (c) no change needed; confirm the thresholds stay.
