---
name: unit-economics
description: Building a conservative revenue/cost model for an indie mobile game — ad revenue math, IAP, store fees, scenarios and break-even, as a formula-driven spreadsheet with a plain-language summary. Use for any finance deliverable.
---
# Unit economics for an indie game

## Revenue formulas
- DAU = installs_cumulative_active (use retention curve: D1, D7, D30)
- Ad revenue/day = DAU × sessions/DAU × impressions/session × eCPM / 1000
  (compute rewarded and interstitial separately — different eCPMs)
- IAP revenue/month = MAU × conversion % × avg price × (1 − store fee)
- Net = ad revenue + IAP net − costs

## Assumption ranges (label as "estimate", verify with WebSearch)
| Item | Pessimistic | Base | Optimistic |
|---|---|---|---|
| Israel rewarded eCPM | low | mid | high |
| Tier-1 English rewarded eCPM | — | — | — |
| D1 / D7 / D30 retention | 25/8/3% | 35/12/5% | 45/18/8% |
| IAP conversion | 0.5% | 1.5% | 3% |
| Monthly organic installs | 200 | 1,000 | 5,000 |
Search current eCPM benchmarks for Israel and US/UK casual games and
cite them; note that Hebrew-only market is small.

## Costs
- Google Play developer: $25 one-time. Apple: $99/year.
- Optional: domain, paid design assets, small ad tests, Mac access for
  iOS builds. Developer time — show it as hours, valued separately.

## Spreadsheet rules
- Assumptions on one sheet; every other cell is a formula referencing
  it. Inputs blue, formulas black. No hardcoded results.
- Monthly columns for 24 months. Scenario switch cell.
- Break-even month = first month cumulative net ≥ 0.
- Chart: cumulative net per scenario.

## Summary for the founder (Hebrew, 1 page)
What it costs to launch, realistic month-12 revenue per scenario, the
3 assumptions that matter most, and what to measure in the first 30
days to know which scenario is real. Be honest if the Hebrew-only base
case is small.
