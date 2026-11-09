# MaxiFox randomness (v0.5 step 1)

Goal (spec v0.5 step 1, §0): two players on the same seed face the same dice and the same cards, whatever they decide.
That is what friend challenges by link (0.5.1) and live rooms (0.5.2) need.

Status: done. Dice and the tax audit are 100% the same for both players, squares are the same until a movement changer, and
cards are 97.9-99.4% the same for players in the same deal tier. The owner decided the flagged items on 2026-11-03:
- turn-keyed draws, with the v2 family tier bands recalibrated (docs/BALANCE.md, "v0.4 baseline and v0.5 keyed RNG");
- charity's bonus die and reroll tokens are off in challenge mode (0.5.1);
- the daily switch date stays a placeholder with a TODO.
See §9.

All numbers below come from `node scripts/rng-fairness.js --seeds=500`, `node scripts/rng-fairness.js --lengths` and
`npm run simulate -- --games=300 --rng=v1|turn|positional`. They were measured on branch `maxifox-v05-rng`.

## 1. Audit: every source of randomness in `src/` (before v0.5)

The line numbers are those of merge commit a9f8483 (v0.4 + PR 17), before any RNG change. The plan cites app.js:124-131 and
:177; on this base the same code sits at app.js:217-226 and :277.

| # | Source | file:line (a9f8483) | Class | What it decided | v0.5 |
|---|---|---|---|---|---|
| 1 | `rand` (mulberry32 over `state.rngState`), `randInt`, `shuffle` | src/engine/engine.js:105-120 | game | every die and card of a normal game: one stream, so any extra draw shifts all the later ones | v1 only (old saves) |
| 2 | first shuffle of the three decks | engine.js:263 | game | deck order | v1 only; v2 has no pile |
| 3 | reshuffle of an empty deck | engine.js:145 (draw), :199 (deal-choice peek) | game | deck order of the next cycle | v1 only |
| 4 | dice | engine.js:376 | game | movement, paydays, squares | v2: `dice:{turn}:{k}` |
| 5 | the reroll token's second set | engine.js:378-386 (`rollSet()` again on the same stream) | game | movement | v2: `reroll:{turn}:{k}` |
| 6 | tax-audit question pick | engine.js:449 | game (knowledge points only) | which question | v2: `audit:{turn}` |
| 7 | tiered deal pools: the out-of-tier swap | engine.js:150-162 | game | reorders the player's own pile by **their own stage**, so the pile depends on decisions | v2: the same rule on a keyed pile (see §3) |
| 8 | `requires` cards sent to the bottom | engine.js:144-164 | game | reorders the pile by the player's assets / loans | v2: the same rule on a keyed pile |
| 9 | match seed `Date.now() % 2147483647 + 1` (or `?seed=`) | src/ui/app.js:217-226 | game (input) | the seed of a new match / rematch | kept: it is the input; a challenge link will carry it |
| 10 | bot seat profession `Math.random()` | src/ui/app.js:277 | game | a bot's profession | v2: `botProfessionId(seed, seat)` (rng.js) |
| 11 | per-seat seed `seed + i * 7919` | src/engine/match.js:8, :67 | game (derivation) | each seat's own streams | kept (see §8) |
| 12 | daily seed `hash('passivo-daily|' + date)` | src/engine/daily.js:31-34 | game (derivation) | the day's game | kept, byte-identical |
| 13 | daily profession `unit(seed, 'profession', 0, 0)` | daily.js:43-45 | game | the day's profession | kept, byte-identical |
| 14 | daily dice / card / audit picks `unit(seed, 'die'/deck/'taxAudit', turn, k)` | daily.js:37-41, engine.js:140-143, :376, :449 | game | already decision-independent since v2.5 | kept before `DAILY_RNG_V2_FROM`, v2 keys from it on |
| 15 | daily day key `new Date()` (device local date) | src/daily/calendar.js:7, :20, :34-35 | game (input) | which day it is | kept (see Flagged F3) |
| 16 | die tumble angles `Math.random()` | src/ui/die.js:129-130 | cosmetic | the 3D start tilt of the die animation (the faces shown are the engine's dice) | kept; never reaches the engine (tested) |
| 17 | coin burst / confetti `Math.random()` | src/ui/fx.js:154-155, :192-200 | cosmetic | particle spread, drift, rotation, delay | kept; never reaches the engine (tested) |
| 18 | tutorial quiz option order `shuffled(list, rand = Math.random)` | src/learn/tutorial.js:245, src/ui/tutorial/check.js:54 | cosmetic | answer order of the story check | kept; not a game state |
| 19 | fox feedback rotation `hash32(seed|group) + counter` | src/learn/feedback.js:58-67 | cosmetic, already hashed | which phrasing | kept |
| 20 | guess reveal line `seed: state.seed + state.turn` | src/ui/play.js:1236, modals.js:413 | cosmetic, already hashed | which reveal line | kept |
| 21 | tax-audit option order `shuffledOptions(options, pick)` | src/ui/tax-audit.js:36-37 | cosmetic, already hashed (by the pick) | answer order | kept |
| 22 | conversation order `conversationOrder(mode, tip, themes, seed)` | src/engine/learn.js:264 | cosmetic, already hashed | tip order | kept |
| 23 | countdown / "next challenge" text `new Date()` | src/ui/daily-format.js:6, calendar.js:34 | cosmetic | a label | kept |

`crypto` is not used anywhere in `src/`. After v0.5, `grep -n "Math.random\|Date.now" src/engine` is empty (it was already
empty). `tests/rng.test.js` checks both rules: the engine has no `Math.random`, `Date.now`, `new Date` or `crypto.`, and the
cosmetic modules (die.js, fx.js, tutorial.js) import nothing from the engine's RNG, bots or match code.

## 2. The keys (rngVersion 2)

All values come from `src/engine/rng.js`. `unit(seed, tag, a, b) = hash(\`${seed}|${tag}|${a}|${b}\`) / 2^32`. The hash is
the daily challenge's FNV-1a 32-bit finished with murmur3's fmix32, moved from daily.js and re-exported there unchanged.
`keyedInt(seed, purpose, a, b, n) = floor(unit(...) * n)`.

| Purpose | Key | Rule |
|---|---|---|
| Die k of turn t | `dice:{t}:{k}` (`v2Die`) | the same for everyone on the seed; the charity bonus die is k = 1 of the same turn, so it never shifts a later value |
| Reroll token's second set | `reroll:{t}:{k}` (`v2RerollDie`) | its own stream; the higher total moves, as before; nothing later shifts |
| Tax-audit pick | `audit:{t}` (`v2AuditPick`) | per turn |
| Cards of deck D on turn t | order `keyedShuffle(seed, 'deck:D', t, eligible)` (`v2DeckOrder`) | §3 |
| Bot seat profession (UI) | `botProfession:{seat}` | from the match seed |

Here t is the player's own turn counter (`state.turn`). Every roll adds one to it, so two players on one seed reach turn t
together. Uniformity: a chi-square test of 60,000 keyed dice stays below the 0.1% critical value (`tests/rng.test.js`).

A v2 state has no `rngState` and no `decks`. It keeps only `draws` counters per deck, for stats (and for the positional
scheme's position).

## 3. Card draws: both options, measured

The v1 pile rules carry over unchanged, applied to a keyed pile instead of a stored one:
- a card whose `requires` is not met goes to the bottom (after 64 tries it is dealt anyway, as in v1);
- an out-of-tier deal is swapped for the first in-tier deal still in the pile; if none is left, it stands;
- the deal-choice alternative is a peek at the pile after the drawn card.

- **Option 2, turn-keyed (`'turn'`, shipped).** The pile of deck D on turn t is the eligible list in the order keyed by
  `(seed, D, t)`, and the card is that pile's first draw.
- **Option 1, positional (`'positional'`).** The n-th draw of D replays its keyed cycle `floor(n / len)` up to position
  `n mod len`, using the player's current requirements and tier. This rebuilds the v1 pile instead of storing it.

The option is set by `V2_DRAW_SCHEME` (rng.js). `createEngine(data, { drawScheme })` and `--rng=` in the scripts measure the
other option. Saves do not record the scheme, so it must not change once v2 games exist; a change after that needs a new
rngVersion.

### Fairness (500 seeds per row, both players on the same profession and seed; family rows on the recalibrated v2 bands)

"dice" = every die both players rolled matches. "card" = the same card on turns when both stood on a tile of the same deck.
"same tile" = they also stood on the same square. "same tier" = same-deck opportunity turns where both were in the same deal
tier. "desynced" = games whose squares split at least once. For v1 the split comes from the shared stream shifting; the
charity column is the label for "not a reroll".

| scheme | mode | pair | dice % | square % | card % (same deck tile) | card % (same tile) | card % (same tier) | tier differs % | games desynced % | first split: charity / reroll % |
|---|---|---|---|---|---|---|---|---|---|---|
| v1 | family | alwaysBuy vs cautious | 92.6 | 90.3 | 73.6 | 74.9 | 88.9 | 48.4 | 19.6 | 19.6 / 0.0 |
| v1 | family | sensible vs alwaysPass | 52.8 | 40.4 | 64.0 | 79.1 | 86.6 | 51.7 | 90.6 | 90.6 / 0.0 |
| v1 | family | sensible+reroll vs sensible | 24.4 | 7.4 | 30.7 | 54.4 | 38.6 | 39.1 | 100.0 | 5.6 / 94.4 |
| v1 | full | alwaysBuy vs cautious | 86.5 | 83.4 | 73.9 | 76.9 | 86.3 | 45.2 | 25.6 | 25.6 / 0.0 |
| v1 | full | sensible vs alwaysPass | 44.5 | 31.8 | 61.3 | 81.9 | 79.2 | 48.6 | 93.8 | 93.8 / 0.0 |
| v1 | full | sensible+reroll vs sensible | 24.4 | 7.6 | 30.4 | 53.6 | 37.5 | 40.9 | 100.0 | 6.0 / 94.0 |
| **turn** | family | alwaysBuy vs cautious | **100.0** | 91.5 | 90.2 | 90.6 | **97.9** | 45.0 | 17.4 | 17.4 / 0.0 |
| **turn** | family | sensible vs alwaysPass | **100.0** | 36.4 | 87.0 | 91.7 | **98.6** | 51.1 | 89.8 | 89.8 / 0.0 |
| **turn** | family | sensible+reroll vs sensible | **100.0** | 39.8 | 95.9 | 99.0 | **99.4** | 19.8 | 68.0 | 0.0 / 68.0 |
| **turn** | full | alwaysBuy vs cautious | **100.0** | 85.5 | 88.4 | 89.0 | **98.5** | 45.7 | 26.8 | 26.8 / 0.0 |
| **turn** | full | sensible vs alwaysPass | **100.0** | 31.5 | 84.9 | 90.6 | **98.7** | 45.7 | 94.6 | 94.6 / 0.0 |
| **turn** | full | sensible+reroll vs sensible | **100.0** | 42.5 | 94.8 | 98.4 | **99.4** | 18.6 | 68.0 | 0.0 / 68.0 |
| positional | family | alwaysBuy vs cautious | 100.0 | 90.9 | 75.9 | 77.3 | 91.5 | 46.5 | 18.0 | 18.0 / 0.0 |
| positional | family | sensible vs alwaysPass | 100.0 | 37.2 | 63.0 | 80.8 | 81.0 | 50.3 | 90.8 | 90.8 / 0.0 |
| positional | family | sensible+reroll vs sensible | 100.0 | 40.8 | 75.3 | 93.3 | 81.6 | 17.1 | 68.0 | 0.0 / 68.0 |
| positional | full | alwaysBuy vs cautious | 100.0 | 83.8 | 74.4 | 77.0 | 89.0 | 44.8 | 26.0 | 26.0 / 0.0 |
| positional | full | sensible vs alwaysPass | 100.0 | 32.1 | 59.4 | 80.7 | 76.8 | 46.8 | 93.8 | 93.8 / 0.0 |
| positional | full | sensible+reroll vs sensible | 100.0 | 40.3 | 72.7 | 91.2 | 78.4 | 16.6 | 68.0 | 0.0 / 68.0 |

Why the same-tile card is not 100% under turn-keyed draws:
- **The tiers differ in 45-51% of shared opportunity turns** (players who decide differently progress differently). Out of
  tier, the swap legitimately gives another deal.
- **A tier fit is relative to the player's own expenses.** Kids and loans change those expenses, so two players in the same
  tier can still have different fit sets.
- **`requires` depends on each player's assets and loans** (a decision card that needs an apartment or a bank loan).

When none of these differ, the card is always the same: `tests/rng.test.js` checks this over 30 turns × 3 decks, with
different cash, draw counts and purchases.

### Balance (`npm run simulate -- --games=300`, median / p90 turns to win, % lost)

v1 = v0.4 as shipped (the same numbers as `origin/maxifox-v04-review`, byte for byte).

| mode | bot | v1 (v0.4) | turn | positional |
|---|---|---|---|---|
| family | sensible | 24 / 33, 0% | 24 / 39, 0% | 24 / 34, 0% |
| family | cautious | 31 / 48, 2% | 32 / 48, 2% | 31 / 45, 2% |
| family | alwaysBuy | 25 / 48, **23%** | 26 / 45, **33%** | 25 / 45, 25% |
| family | overBorrow | 27 / 55, **28%** | 28 / 46, **43%** | 28 / 46, 35% |
| family | overBorrowLite | 27 / 55, **25%** | 27 / 49, **36%** | 26 / 45, 26% |
| full | sensible | 29 / 43, 0% | 27 / 43, 0% | 27 / 42, 0% |
| full | cautious | 37 / 56, 0% | 37 / 58, 2% | 37 / 57, 2% |
| full | alwaysBuy | 35 / 86, 14% | 29 / 74, 16% | 30 / 79, 14% |
| full | overBorrow | 35 / 89, 37% | 31 / 75, 34% | 33 / 81, 36% |
| full | overBorrowLite | 36 / 89, 28% | 31 / 84, 27% | 32 / 81, 26% |
| multiplayer (4 sensible) | winner's median | family 13, full 15 | family 14, full 16 | family 13, full 15 |

With 300 games, one standard error of a loss rate near 25% is about 2.5 points. That puts the turn-keyed family
over-borrowing rows 4-6 standard errors above v1. Sensible play, cautious play and full mode stay within noise or close to it.

**Why.** v0.4's tier swap is soft in v1. Each swap uses up an in-tier deal of the player's pile, so late in a pile cycle the
in-tier deals run out and out-of-tier deals come through. With the tier held fixed, a toy model of the v1 pile deals every
card equally often over a full cycle: the tier only delays out-of-tier deals. A turn-keyed pile is fresh every turn and never
runs out, so the tier filter becomes strict. A mid-stage player then never sees the small, cheap deals below their tier's
minimum. Reckless bots buy only bigger deals, borrow more and go bankrupt more often. With the tier filter off, the two
schemes give the same balance (family alwaysBuy 19% vs 21%, overBorrow 25% vs 27%). The pile is not the cause either:
capping the keyed pile at the depth v1 would have left did not move the numbers (29% / 40%).

**Choice (owner, 2026-11-03): option 2 (turn-keyed), with recalibrated tier bands.** Same tile and same tier give the same
card 97.9-99.4% of the time, against 76.8-91.5% for positional. Positional rebuilds a whole cycle from each player's own
predicates, so any difference in loans or kids anywhere in the cycle compounds; after a desync it also drifts, because the
draw counts differ.

The balance drift above is fixed with tier bands, not with the draws: rngVersion-2 family games use `DEAL_TIERS_V2.family`.
Only the lower bounds changed, from 0.12 / 0.22 / 0.32 to 0.08 / 0.15 / 0.22. Family reckless bankruptcy is back at
27 / 31 / 28% (v0.4: 23 / 28 / 25%), and sensible play is within noise (mean 24.6 vs 24.5). Full mode keeps the v0.4 bands,
since it was already within noise. v1 games are untouched. Tables: docs/BALANCE.md, "v0.4 baseline and v0.5 keyed RNG".

## 4. Movement changers

Movement depends only on the dice, except for:
1. **Charity**: 2 dice for 3 turns. The bonus die is keyed (`dice:{t}:1`), but the player who donated moves further.
2. **The reroll token** (armed before a roll): the higher of two sets moves.
3. Forced dice (`engine.roll(s, dice)`) is a test hook only. A dispatched roll takes no dice and the action log refuses them,
   so it cannot be used in a game.

Nothing else moves a pawn (`state.position` is written in one place, the hop loop of `roll`).

Charity breaks position sync often: in 19-27% of games when both players use the same charity rule (alwaysBuy vs cautious),
and in 90-95% when one player never donates. A single reroll desyncs 68% of the games in which a player holds 2 tokens. After
a desync the dice stay identical and the squares stay apart by a fixed offset. Cards still match on any turn when both land
on a tile of the same deck (turn-keyed: 85-96% of those turns).

**Decided (owner, 2026-11-03), built in 0.5.1 (`newGame({ challenge: true })`):** in challenge mode, charity gives no bonus die and
reroll tokens are not offered. Both players' squares then stay 100% in sync, and so do the cards whenever the tiers match.
Normal games keep both rules unchanged.

## 5. Replay and the dispatch seam

`engine.dispatch(state, { type, ...args })` is the single entry point. It runs the engine function and appends the action
(only its known fields) to `state.log`. `engine.replay(seed, config, actions)` runs `newGame({ ...config, seed })` and then
folds `dispatch`. These go through dispatch:
- in play.js: both roll sites, the guess, buy, pass, chooseDeal, renovate, loans, repayments, sales, charity, offers,
  decisions, the tax audit, armReroll, forfeit and the debug force;
- every move a bot makes (bots.js `step`);
- the auction result (auction.js).

The daily keeps its v2.5 log (`state.daily.log`, the stored record format). `replayDaily` maps it onto the same table.

| type | args | note |
|---|---|---|
| roll | none | a dispatched roll never carries dice |
| armReroll | none | |
| chooseDeal | cardId | the gap the audit found (daily's table had none) |
| guess | cardId, light, guess | was a direct `recordGuess` in play.js. A right guess takes 10% off the down payment and streaks earn reroll tokens, so it is game-affecting. The engine checks that it is on the open deal and that the light is that deal's own (`dealMetrics`) |
| buy | qty | |
| pass | none | |
| renovate | assetId, level, style | the level is logged and checked on replay (daily's table dropped it) |
| auctionWin | card, price | multiplayer only (see F5) |
| acceptOffer / declineOffer / donate / declineCharity / forfeit | none | |
| takeLoan | amount | |
| repayLoan | id, amount | |
| sellAsset | id, qty? | |
| decide | option | |
| answerAudit | questionId?, correct? | |
| debugForce | outcome | `?debug=1` only; refused in a link |

`stateHash(state)` is a 32-bit digest of the stable (sorted-key) JSON of the state. It leaves out `events` and the UI's
seen-flags (`learn.shown`, `learn.concepts`), which the screen sets without an action and no rule reads.

**Fuzz** (`tests/replay-fuzz.test.js`, 500 seeds):
- the games cover family, full, junior, and a daily on each side of the boundary;
- moves are random and legal, from `tests/support/legal-moves.js` (`decisionOptions`, `maxLoan`, `renovationOption`, the
  deal choice, the guess, auctions, voluntary loans, repayments and sales);
- each log is encoded, decoded and replayed, and the result is compared deep-equal and by `stateHash`.

**Result: 500/500**, and every action type except debugForce appears.

Not replayable from `(seed, config, log)` alone: the practice missions (first-asset, repay, buffer). They inject a scripted
pending card. They are single scenarios, not challenges.

## 6. Compact action log (`src/engine/actionlog.js`)

`encodeActionLog({ rngVersion, seed, config, actions, name? })` produces base64url. The layout:
- `'MF'`, the format byte, rngVersion, the seed and the flags:
  - bit0 full mode, bit1 junior, bit2 daily date present (format 1 and 2);
  - bit3 friend challenge (the game ran under the 0.5.1 challenge rules), bit4 display name present (format 2 only);
- a string table, so each card, asset and loan id is written once; the profession, then the daily date and the display name
  (when their bits are set) are references into it;
- one type byte per action, followed by varint arguments;
- a CRC32.

`decodeActionLog` validates the header, version, type codes, every argument, the string references, the lengths, trailing
bytes and the checksum, and throws `ActionLogError` with a `code`: `CRC` (checksum), `VERSION` (another format, or an
unknown rngVersion) or `FORMAT` (anything else malformed).

**Format 2 (0.5.1).** `FORMAT_VERSION` is 2 and encode always writes it. Decode accepts format 1 (v0.5 step 1 links, where
any flag above bit2 is refused) and format 2. The display name is the creator's optional name for a challenge link:
`sanitizeDisplayName` makes it NFC, drops control, bidi-override and zero-width characters, collapses whitespace, trims, and
keeps at most 16 code points. An empty name is left out. Decode refuses a name that is not already in sanitized form, and
the challenge bit together with a daily. Tests: `tests/actionlog-v2.test.js`.

**Verification (0.5.1).** `engine.verifyResult(textOrDecoded)` (src/engine/challenge.js) decodes and replays, and returns
`{ ok, comparable, status, turns, freedomPct, stats }`. It refuses rngVersion 1 (`VERSION`), a daily (`DAILY`), any auction
action (`AUCTION`), an illegal move (`REPLAY`) and a game that did not end (`UNFINISHED`). `comparable` is false when the
log rolled charity's bonus die or a reroll, because a challenge player's dice then differ. A log with no actions is a
seed-only "new challenge on the same game" (`empty`, ok, not comparable). The CRC catches a damaged or hand-edited link but is not a signature:
replaying the decoded log is the proof that a result is real.

Encoded length of whole games (`node scripts/rng-fairness.js --lengths`, 500 games per row, rngVersion 2):

| mode | log | median turns | median actions | **median chars** | p95 turns | p95 actions | **p95 chars** | max chars |
|---|---|---|---|---|---|---|---|---|
| family | bot | 24 | 37 | **108** | 39 | 58 | **150** | 227 |
| family | player (guess on every deal + deal choice examined) | 23 | 51 | **256** | 38 | 78 | **360** | 534 |
| full | bot | 28 | 44 | **116** | 51 | 76 | **176** | 290 |
| full | player | 28 | 59 | **286** | 50 | 101 | **419** | 680 |

Every game is far below the 2,000-character target (the longest was 680), so no compression is needed.

## 7. Compatibility

- **Saves.** Schema 8 -> 9 stamps every player state `rngVersion: 1`. A v1 game keeps `rngState`, its deck arrays and every
  v1 code path behind `rngVersionOf(d) === 1`.
  - `tests/fixtures/v1-games-golden.json` holds 48 bot games recorded on the pre-v0.5 engine; they replay to the same final
    state digest.
  - `tests/fixtures/save-v0.4-schema8.json` is a 2-player full match saved by v0.4. It loads as version 1 and plays 3 turns
    exactly as v0.4 did: dice, position, cash, rng state, decks and assets (`.expected.json`).
- **Daily challenge.** `DAILY_RNG_V2_FROM = '2026-11-17'` (config.js) and `dailyRngVersion(date)`.
  - Every earlier date keeps the v2.5 streams. `tests/fixtures/daily-v1-golden.json` has 4 dates × 3 bots of dice, cards,
    picks and logs recorded before v0.5, including today, 2026-11-03, and they are byte-identical.
  - From that date on, the daily uses the v2 keys with the daily rules unchanged: no decision cards, no deal choice, no
    reroll, no tiers.
  - Both sides of the boundary are tested, and v2 dailies replay through `replayDaily`.
- **The production build and the PWA** are unchanged (no new assets; the engine chunk grows by the RNG and action-log code).

## 8. Matches and live rooms

A hot-seat match keeps the per-seat seed `seed + i * 7919` (match.js), so every seat plays its own keyed streams. A friend
challenge is a single-player game on one seed: the link carries that seed. A live room (0.5.2) that wants everyone to face
the same dice must give every seat the **same** seed (not `seed + i * 7919`), or derive the keys from the room seed and the
turn only. That is a match-layer choice for 0.5.2; the engine already supports it.

## 9. Flagged items and the owner's answers (2026-11-03)

- **F1. Card-draw option vs balance: decided.** Turn-keyed draws were kept, and the v2 family tier bands were recalibrated
  (§3, docs/BALANCE.md). Full mode is within noise on the v0.4 bands; v1 games keep v0.4's bands.
- **F2. "Same tile + turn ⇒ same card: 100%"** cannot hold with per-player deal tiers and `requires`. Measured: 89-92% on the
  same tile, 97.9-99.4% in the same tier, 100% when the players' tier fit and requirements match (tested). Challenges turn
  off the movement changers (§4), which removes the square desync but not the tier differences.
- **F3. Daily boundary: placeholder kept.** `2026-11-17` stays, with a TODO in config.js to set it to the first day after the
  release. The day key is the device's local date (`calendar.js dayKey`), not Asia/Jerusalem.
- **F4. docs/BALANCE.md: closed.** It now has the v0.4 baseline and the v0.5 before/after tables.
- **F5. `auctionWin` carries a card object: closed (0.5.1).** It only occurs in hot-seat matches. The link format refuses every
  auction action in encode and decode, and `verifyResult` refuses a decoded log that has one (`AUCTION`), so a forged auction
  can never verify (tests/challenge-engine.test.js, tests/actionlog.test.js).
- **F6. Smokes: green.**
  - v0.4's deal-choice card, game-length chips and one-payday-per-turn rule were never taught to the smokes. They are fixed
    test-side (docs/v4/test-changes.md 28-33).
  - The 2p players screen's start button (816 px in an 800 px viewport after the PR 17 merge) is pinned to the bottom over a
    fade.
  - The decision pass line has 3 variants, rotated by the commentary picker, and a decision line that would repeat the last
    one is not shown again (QA L3).
- **F7. Repeats.** Turn-keyed draws are with replacement. Within one game, a card can come back before the eligible list is
  exhausted, which a v1 pile cycle prevented. This is part of F1 (positional keeps the cycles).
