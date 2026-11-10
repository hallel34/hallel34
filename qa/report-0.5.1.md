# QA report — MaxiFox 0.5.1 friend challenges (`maxifox-v051-challenges` @ 5496d36, base main 9c9b8a4) — **GREEN** (P0 0, P1 0, P2 4, P3 4)

Author: the independent qa-tester. The harness blocks the agent from writing report files, so the CEO saved its delivered report text without editing its findings.

The challenges work end to end:
- forged and tampered links are caught;
- two players on one link get identical dice;
- the other saves are never touched;
- every smoke passes.

None of the 4 P2s blocks the release, but two need a decision soon: junior links can show a stranger's name to a child (P2-1), and home performance has no margin left (P2-3).

I verified with my own scripts, my own random player and my own seeds, and opened links I built myself in a real browser. I did not change code or push anything; screenshots are listed at the end.

## Gate
| Check | Result |
|---|---|
| vitest | 860/860 (47 files) |
| build | OK |
| Smokes (each ran once, in parallel) | family 352, full 251, 640 family 352, 640 full 251, 2p 180, daily 119, r11 125, r12 134, tutorial 114, payday 54, players 34, challenge 99, business, mission, missions: **all PASS, 0 FAIL** |
| Contrast | contrast-check 205 ok, v3 113, v4 board 44, v051 45 pairs: 0 failing |
| axe | 0 violations on the intro (family and junior), compare (360x800 and 320x568), the error screens and the 16-combo board matrix. Exception: the timeline (P2-2) |
| Layout at 360x800 and 320x568 | No horizontal scroll on intro, compare, timeline or the error screens. All touch targets ≥48px (the timeline filter's tap area is its 48px chip). RTL correct, including mixed Hebrew/Latin names |
| Lighthouse home (5 runs) | perf **0.90 / 0.91 / 0.90 / 0.90 / 0.90**; a11y, best practices and SEO 1.00 every run |

## Feature checks
- **Opening a link.** The intro shows the creator's name, the verified result and both challenge rules. The match uses the link's seed, mode, profession and junior setting. The hash is cleared after reading.
- **Challenge rules.**
  - Engine: a charity roll gives 1 die in a challenge (2 in a normal game), and arming a reroll is refused ("no reroll in a friend challenge").
  - UI: the reroll button is in the page but hidden.
- **Two real games on one link.** 200 seeds, one player buying and one passing, 6,484 turns compared:
  - dice identical **100%**;
  - squares identical **100%**;
  - the same card in the same tier 98.6%. The rest are the documented tier-fit exceptions.
- **Compare screen.**
  - My link (creator won in 34 turns) against a different browser policy (won in 45 turns): both results "אומת", the correct winner, and the takeaway shown.
  - The timeline marks 11 split turns out of 45.
  - Reply `#r=`: covered by the challenge smoke.
- **Bad links.** Each opens the right error screen:
  - tampered → "משהו בקישור השתנה" (CRC);
  - truncated, garbage or an empty hash → "הקישור לא נפתח" (FORMAT);
  - rngVersion 1 → "קישור מגרסה אחרת" (VERSION);
  - a hand-built auction code → refused.
  - An unfinished log is still playable with "לא אומת". A seed-only log gives the "אתגר חדש" intro (smoke).
- **Saves.**
  - With sentinels in the normal, daily and mission slots, playing a whole challenge left all three byte-identical.
  - The game lives only in `challengeSave`.
- **Short, daily, mission and hot-seat games.** "שלחו אתגר" is not offered: `challengeEligibility` returns false for each.
- **Junior link at 320x568.** Coins only, no ₪ and no number over 999 on the intro and the compare screen.
- **Offline.** On the installed PWA after one visit, a `#c=` link opens the intro offline, the challenge board loads and play works.

## Adversarial checks on links (engine)
| Attempt | Result |
|---|---|
| Legit finished game | verified (won in 55 turns) |
| Drop half the actions | UNFINISHED |
| Insert a buy, inflate loans ×50, turn passes into buys | REPLAY (refused) |
| Same actions on another seed, profession, mode, junior or challenge-off config | REPLAY |
| rngVersion 1 | VERSION |
| auctionWin, debugForce, a daily config | refused at encoding |
| 500 random bit flips | 500 rejected |
| Truncations | CRC / FORMAT |
| Buy qty ×100 | Same result (the quantity is ignored for deals): harmless |

**Names.** `<img …>` comes through as plain text, and bidi-override and zero-width characters are stripped. Names are capped at 16 characters.

**URL length** (my own measurement, finished challenge games, 16-character Hebrew name, full URL):

| Players | median | p95 | max |
|---|---|---|---|
| Engine bots, family | 196–208 | 242–305 | ≤588 |
| Engine bots, full | 205–268 | 261–621 | ≤826 |
| My "busy" random buyer, family | 406 | 858 | 1,352 |
| My "busy" random buyer, full | 676 | 1,518 | 2,001 (1 of 290 games over 2,000) |

The developer's figures (p95 464 family / 550 full) sit between my bot and busy-player numbers.

## Findings
- **P2-1. Junior links carry and show the creator's name.**
  - Decision (3) says no name for juniors. The sender UI hides the name field, but the encoder still writes a name into a junior link, and the intro and compare show it.
  - A crafted junior link put "ShouldNotShow" in front of a child (`qa-intro-junior-320x568.png`).
  - Fix: drop the name when `config.junior` is set, in both encode and decode.
- **P2-2. Timeline row buttons fail an axe rule.** `label-content-name-mismatch` (serious, WCAG 2.5.3), all 45 `button[data-turn]` rows, at 360x800 and 320x568. The visible text is not part of the aria-label, which breaks voice control. The challenge smoke's axe pass does not catch it.
- **P2-3. Home performance has no margin.**
  - 0.5.1: 0.90–0.91 (FCP 1.9–2.0 s).
  - Main 9c9b8a4, run alternately: 0.91 / 0.91 / 0.94 (FCP 1.8 s).
  - 0.5.1 costs about 0.1–0.2 s of FCP. The gate holds today, but one noisy run fails it.
- **P2-4. Very busy games can pass 2,000 characters.** One of 290 full-mode games in my busiest random play did (max 2,001; 2,220 in an earlier run). There is no length guard or fallback in the share sheet. Real browsers and WhatsApp accept longer URLs, so add a guard or the seed-only fallback above a threshold.

### P3
- The family board identifies a friend by name + profession + mode, so two friends with the same name and profession merge into one row.
- Anyone can replay a seed many times and send their best run. This is inherent to seed-shared challenges; consider saying so in the copy.
- The hand-built auction link opens the generic "invalid" error rather than a specific one. Fine as is.
- Lost games rank after wins by freedom %; unfinished logs never reach the board, because only verified results count. The decision text calls them "unfinished games"; the wording should match.

## Test changes 40–41
- **40** (kid-vocabulary adds the `challenge` group): strengthens coverage.
- **41** (win-screen smoke follows the challenge button layout): forced by the approved spec. The old checks still run on every non-challenge win screen. Not a weakening.

## Screenshots
Not committed. They are in `/tmp/claude-0/-home-user-hallel34/797437b1-0eab-5655-9747-70eabea0ace1/scratchpad/shots-ch/`:
- intro: family and junior;
- compare: family at 360x800 and 320x568, junior;
- timeline at 360x800 and 320x568;
- the 8 bad-link error screens;
- offline: the intro and the board.

---

## Delta report — 0.5.1 re-check of the four P2s (`maxifox-v051-challenges` @ 82b63cc) — **GREEN** (P0 0, P1 0, P2 0)

All four P2s are fixed, and splitting the challenge code into lazy-loaded chunks broke nothing, online or offline. The full smoke set and unit tests are green. I used my own scripts, links and seeds throughout, and changed no code.

### The four P2s
| Finding | Status | Evidence |
|---|---|---|
| **P2-1** junior name | **Fixed** | Encoding a junior link with a name drops it. I also hand-built a named family link, set the junior flag and recomputed the checksum: it decodes with no name. In the browser at 320x568 the intro shows "אתגר חדש באותו משחק" and never the name. |
| **P2-2** label-in-name (timeline) | **Fixed** | I ran axe with WCAG 2.0 A/AA, 2.1 A/AA and best-practice tags. **0 violations** on intro, compare, timeline and the family board, in family and junior, at 360x800 and 320x568. The 45 timeline rows that failed last round now pass. |
| **P2-4** URL length | **Fixed** | My busiest random buyer: 581 finished games, 5 with a full URL over 1,800 (max 1,979). The guard sent exactly those 5 as the seed-only link (0 mismatches), and the longest URL actually sent was 1,798. |
| **P2-3** home performance | **Fixed** (same as main) | Lighthouse mobile, alternating runs, below. |

**Lighthouse home** (a11y 1.00 on every run):

| Run | Branch perf | Branch FCP | Main perf | Main FCP |
|---|---|---|---|---|
| 1 | 0.91 | 1.9 s | (1.00, outlier) | 0.9 s |
| 2 | 0.93 | 1.8 s | 0.91 | 1.8 s |
| 3 | 0.91 | 1.8 s | 0.95 | 1.8 s |

The branch now matches main's FCP (round 1 was 2.0 s). The margin over the 0.90 gate is still thin on both branches.

### The lazy split
- **Production, family and junior, at 360x800 and 320x568:** no leaked i18n keys, `{placeholder}` text, or "undefined/null/NaN" on any challenge screen:
  - intro
  - board
  - compare
  - timeline
  - family board
  - send sheet
- **Junior:** coins only, no ₪.
- **Home and end screens:**
  - Home has 4 icons (dictionary, how to play, family board, settings), axe 0, no leaked keys.
  - A normal win shows "שלחו אתגר", "שחק שוב", "מה למדתי" and "שנו מצב או מקצוע". The send sheet is clean, with 0 console errors.
- **Offline, after one visit to home:**
  - The service worker had precached every new chunk (challenge, challenge-intro, compare, family-board, flow, share-sheet, timeline, copy and challenge CSS).
  - Offline I opened a `#c=` link, played the challenge to compare, then opened the timeline and the family board (ranked correctly, 34 vs 45 turns). Strings were complete and there were 0 console errors.
- **Layout:** no horizontal scroll. Every touch target is ≥48px; the timeline filter's radio inputs measure 44px, but each sits inside a 48px chip label.

### Gate
- vitest **864/864**; build OK.
- Smokes, all **0 FAIL**:

| Smoke | ok |
|---|---|
| family | 352 |
| full | 251 |
| 2p | 180 |
| 640 family | 352 |
| 640 full | 251 |
| daily | 119 |
| r11 | 115 |
| r12 | 134 |
| tutorial | 114 |
| payday | 54 |
| players | 34 |
| challenge | 102 |
| business | PASS |
| mission | PASS |
| missions | PASS |

### Test changes
- `docs/v4/test-changes.md` has no new rows since 5496d36.
- Three test files changed, all strengthening:
  - `tests/challenge-store.test.js` adds a length-guard test (the only deletions are import lines);
  - `tests/actionlog-v2.test.js` adds the junior-name test;
  - `smoke:challenge` adds `wcag21a` to its axe pass and now uses a named junior link.
- No assertion was loosened.

### Screenshots
Not committed; they are in `/tmp/claude-0/-home-user-hallel34/797437b1-0eab-5655-9747-70eabea0ace1/scratchpad/shots-ch2/`. They cover the crafted junior link, compare / timeline / board for family and junior at both sizes, the family board offline, the normal win screen and the send sheet.
