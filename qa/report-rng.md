# QA report — MaxiFox v0.5 step 1, keyed RNG — re-test (HEAD 3ece129) — **GREEN** (P0 0 · P1 0 · P2 1 for the owner · P3 1)

Author: the independent qa-tester. The CEO saved the report text as delivered. Round 1 (f76c6d4) was RED with 1 P1 and 4 P2. Screenshots: `qa/screens/rng/` (commits 99d0d3b, ae8b57b).

## Round-1 findings
| Finding | Status |
|---|---|
| P1: 2p full smoke (repeated decision line) | **Fixed**: 3/3 runs at 180 ok; the line is kept per device; 3 variants for the "do nothing" options |
| P2-2: forged auctionWin link (F5) | **Fixed for links**: all auction actions and debugForce are refused, including hand-built links with a valid CRC. Engine: no auction / wrong card / bid below the floor or off-step / old auction / losing seat are all refused |
| P2-3: coverage | **Fixed**: the rule tests run on both versions; the mean bound is back |
| P2-4: tutorial smoke | **Fixed**: 114 ok |
| P3: age chip at 320 | **Fixed** |
| P2-1: full-mode reckless bots faster | Left for the owner, stated plainly in BALANCE.md |

## Regression (QA's own scripts)
- **Dice:** 300 seeds × 3 pairs × 2 modes, 100% identical and 100% equal to the published key.
- **Cards:** 100% the same when tier, fit and `requires` match.
- **Replay fuzz:** 400/400, also after encode → decode.
- **Tampering:** 2,400 flips, 240 truncations and 120 appends all rejected; a wrong version is rejected even with a valid CRC.
- **v1 vs the old engine (a9f8483):**
  - 120/120 games identical;
  - 40/40 saves resume identically;
  - the schema-8 fixture loads as v1 and plays identically.
- **Daily:** byte-identical before 2026-11-17, v2 from that date.
- **Purity:** no Math.random, Date or crypto in src/engine.

## Gate
- vitest 821/821, build OK, contrast 0 fail, Lighthouse 0.91 ×3 (a11y/BP/SEO 1.00).
- Smokes, all 0 FAIL:

  | Smoke | ok |
  |---|---|
  | family | 352 |
  | full | 251 |
  | 640 family / full | 352 / 251 |
  | 2p (×3) | 180 each |
  | daily | 119 |
  | r11 | 115 |
  | r12 | 134 |
  | tutorial | 114 |
  | business | 6 |
  | payday | 54 |
  | players | 34 |
  | mission | 5 |
  | missions | 4 |

## P3 (new)
A raw `dispatch`/`replay` (not a link) accepts `auctionOpen` with an invented card, followed by a matching `auctionWin`. Links refuse both, so challenge proofs are not affected. Defense in depth: validate the opened card against the card data.

## Test rows 34–39
Rows 34, 35, 37, 38 and 39 restore or strengthen tests. Row 36 (the fuzz no longer emits auctionWin) is justified, with coverage in actionlog.test.js.
