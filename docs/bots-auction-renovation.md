# Bots, auctions and coffee-business renovation - design and balance notes

Branch `maxifox-bots-auction-reno`, schema 7. The two headline rules are **owner-approved (2026-10-27)**: the auction floor is half the printed down payment, and a renovation-skipped card goes to auction like a passed one. Renovation costs/gains remain sim-tuned numbers the owner saw in the demo context.

## Renovation ("שיפוץ העסק")

On an opportunity tile, a player holding a coffee-category business gets a **third option**: renovate an existing coffee business instead of buying the drawn card.

| Level | Cost | Monthly gain | Simple payback |
|-------|------|--------------|----------------|
| 1 - paint & equipment | 40,000 | +800 | ~4.2 years |
| 2 - terrace or takeaway (style choice, cosmetic) | 60,000 | +1,000 | ~5.0 years |
| 3 - roof garden (terrace) / delivery kitchen (takeaway) | 90,000 | +1,200 | ~6.25 years |

* Cash only, one level per landing, each level once per business. Level 3 takes the form matching the level-2 style (roof garden above a terrace, a delivery kitchen next to a takeaway window) - same cost, same gain; neither style is stranded.
* The skipped card is **not** lost: it goes to auction among the other players, exactly like a passed card (owner-approved 2026-10-27).
* Inspired by the growing-business demo (`demo/model.js` levels).

### Tradeoffs
* **Renovation replaces the card decision** (owner-approved 2026-10-27): keeps opportunity-tile income per player roughly constant, and preserves the chance of drawing a coffee card with none in hand. The skipped card is auctioned among the others, so nobody's draw disappears.
* **Costs/gains curve**: level 1 is clearly good, level 3 is mediocre on pure payback (chosen for prestige/rat race exit). Alternative curve: 50k/+800, 75k/+1,100, 110k/+1,500 - slower, level 3 still weak.
* Simulation effect (100 games per cell, sensible bot): single-player median winner turns moved family 23->22, full 26->23. Full mode now sits just under the v3 target band (25-40); if that matters, raise costs ~15-20%.

## Auction ("מכרז")

When a player **passes** on a purchasable deal card (apartment/business; stocks excluded), the other players bid on it openly, in turn order, starting after the decliner:

* Bids rise in steps of 1,000 (junior: 10,000). **Opening bid floor: half the card's printed down payment** (owner-approved 2026-10-27, see the controlled experiment below).
* **Cash only** - bids limited by cash on hand. Decliner does not bid. If everyone passes, the card is discarded.
* **Winner's economics**: the bid is paid as the down payment; the card's **original mortgage and monthly payment are kept unchanged**, so the asset's monthly cash flow is exactly as printed. Asset price = bid + mortgage (the balance sheet always balances and immediate resale can never beat paying the bid: 90%·(B+M)−M < B). Renovation levels already bought stay with the asset.
* Applies to multiplayer matches (human or bot seats). Single-player unchanged. UI: open card with a stepper; bots bid up to a payback ceiling by personality.

### Tradeoffs
* **Bid = effective down payment** (recommended): simpler for kids, one number, zero arbitrage. Alternative: classic auction of the whole asset price - needs new-loan mechanics for the difference, more complex and lets the winner pay less than the card's printed financing terms.
* **Open ascending** (recommended): transparent, exciting, kids learn pricing. Alternative: sealed single-round bids - faster, less social.
* **Controlled experiment** (scripts/sim-auction-variants.mjs; 60 matches/variant, 4 sensible bots, seeds 1-60 fixed; metric = winner's own turns, total player-turns in parens):

| Variant | family winner (total) | full winner (total) | auctions/match | sold | avg bid/down |
|---|---|---|---|---|---|
| no auction | 16 (63) | 18 (70) | - | - | - |
| no floor, step 1k | 7 (27) | 6 (21) | 5.6 / 5.1 | ~80% | 0.3-0.4 (steals) |
| **floor = half down (default)** | 14 (52) | 14 (55) | 9-11 | 21-26% | 0.8 |
| floor = full down | 16 (60) | 17 (64) | 10-13 | 6% | 1.4-1.5 |
| step 5k vs 1k | same | same | same | same | same |

  The no-floor variant trivialized progression (games 2.5x shorter, winning bids at 30-40% of the printed down). The full-down floor keeps baseline pacing but the mechanic almost never sells (6%) - the user's idea would feel absent. Half-down is the recommended middle: auctions regularly find a buyer (~2-3 sales/match) at sane prices, pacing mildly faster than baseline. (The no-auction baseline itself is 16/18 here vs BALANCE.md's 18/19 because bots now renovate - same conditions across variants.)

## Bots ("בוטים")

* Each multiplayer seat can be a person or a bot with a personality: **wise** (sensible), **careful**, **risky**. Same policy code as the simulation bots, so balance sims reflect real play.
* Bots play their own turn on the device (dice, cards, decisions, auctions, renovation) with visible animation and speech, so kids can watch and learn. End-of-turn is automatic unless a "bot" note needs dismissing.
* Setup picks bot seats instead of name/profession; bots get named avatars (foxy names). A dismissed bot resumes its turn after reload (resumePlan covers auctions).

## Owner decisions (2026-10-27)
1. Auction floor = half the printed down payment - **approved**.
2. A renovation-skipped card goes to auction among the others (not discarded) - **approved**.

## Open questions for the user
1. Are the three renovation costs/gains right (see paybacks), or should we slow it down?
2. Bot personalities: 3 enough? Default suggested seat = wise bot?
