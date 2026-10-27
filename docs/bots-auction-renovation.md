# Bots, auctions and coffee-business renovation - design and balance notes

Branch `maxifox-bots-auction-reno`, schema 7. All numbers below are **provisional**, pending user review.

## Renovation ("שיפוץ העסק")

On an opportunity tile, a player holding a coffee-category business gets a **third option**: renovate an existing coffee business instead of buying the drawn card.

| Level | Cost | Monthly gain | Simple payback |
|-------|------|--------------|----------------|
| 1 - paint & equipment | 40,000 | +800 | ~4.2 years |
| 2 - terrace or takeaway (style choice, cosmetic) | 60,000 | +1,000 | ~5.0 years |
| 3 - roof garden | 90,000 | +1,200 | ~6.25 years |

* Cash only, one level per landing, each level once per business. Level 3 requires a terrace.
* The card is abandoned without an auction (same as the demo card).
* Inspired by the growing-business demo (`demo/model.js` levels).

### Tradeoffs
* **Renovation replaces the card** (recommended): keeps opportunity-tile income per player roughly constant, and preserves the chance of drawing a coffee card with none in hand. Alternative: allow renovation *in addition to* the card - stronger acceleration.
* **Costs/gains curve**: level 1 is clearly good, level 3 is mediocre on pure payback (chosen for prestige/rat race exit). Alternative curve: 50k/+800, 75k/+1,100, 110k/+1,500 - slower, level 3 still weak.
* Simulation effect (100 games per cell, sensible bot): single-player median winner turns moved family 23->22, full 26->23. Full mode now sits just under the v3 target band (25-40); if that matters, raise costs ~15-20%.

## Auction ("מכרז")

When a player **passes** on a purchasable deal card (apartment/business; stocks excluded), the other players bid on it openly, in turn order, starting after the decliner:

* Bids rise in steps of the current mode's loan step (junior 10,000 / family 20,000 / full 40,000).
* **Cash only** - bids limited by cash on hand. Decliner does not bid. If everyone passes, the card is discarded.
* **Winner's economics**: the bid is paid as the down payment; the card's **original mortgage and monthly payment are kept unchanged**, so the asset's monthly cash flow is exactly as printed. Asset price = bid + mortgage (the balance sheet always balances and immediate resale can never beat paying the bid: 90%·(B+M)−M < B). Renovation levels already bought stay with the asset.
* Applies to multiplayer matches (human or bot seats). Single-player unchanged. UI: open card with a stepper; bots bid up to a payback ceiling by personality.

### Tradeoffs
* **Bid = effective down payment** (recommended): simpler for kids, one number, zero arbitrage. Alternative: classic auction of the whole asset price - needs new-loan mechanics for the difference, more complex and lets the winner pay less than the card's printed financing terms.
* **Open ascending** (recommended): transparent, exciting, kids learn pricing. Alternative: sealed single-round bids - faster, less social.
* **Simulation effect**: 4-bot matches accelerate sharply - winner median turns 18->9 (family), 19->5 (full) - because deals no longer go to waste and auctions spread assets. That is inherent to "every deal finds a buyer" (like Monopoly auctions). If a slower game is preferred: add a floor (min bid = a % of down payment) or auction only in full mode.

## Bots ("בוטים")

* Each multiplayer seat can be a person or a bot with a personality: **wise** (sensible), **careful**, **risky**. Same policy code as the simulation bots, so balance sims reflect real play.
* Bots play their own turn on the device (dice, cards, decisions, auctions, renovation) with visible animation and speech, so kids can watch and learn. End-of-turn is automatic unless a "bot" note needs dismissing.
* Setup picks bot seats instead of name/profession; bots get named avatars (foxy names). A dismissed bot resumes its turn after reload (resumePlan covers auctions).

## Open questions for the user
1. Renovation replaces the drawn card - OK, or allow both?
2. Are the three costs/gains right (see paybacks), or should we slow it down?
3. Auction for every passed deal - OK for family mode with kids, or full mode only / with a floor?
4. Bot personalities: 3 enough? Default suggested seat = wise bot?
