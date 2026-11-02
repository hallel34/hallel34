# General Market Research Agent

Does market research on its own, for any topic, before anyone writes product code.
Pick an idea to validate, or leave it empty and it hunts for underserved opportunities.

## Install (once)
```
pip install -r requirements.txt        # needs Python 3.9+
```

## Run (one command)
```
python run.py
```
Progress is printed in plain sentences. When it ends you get:

| File | What it is |
|---|---|
| `REPORT.md` | The report, in the language you chose |
| `sources.md` | Every source, its URL and the date checked, plus sources that were unreachable |
| `data/` | Raw JSON/CSV (quotes, competitors, discovery themes); `data/cache` lets re-runs be fast |

## Change the idea, focus, market (edit `config.json`)
| Setting | Meaning |
|---|---|
| `BUSINESS_IDEA` | Plain-language idea to validate. **Empty = Discovery mode** (find 10 opportunities, fully validate the top 3) |
| `FOCUS_AREA` | Narrow discovery to a topic, e.g. `"pets"`. Empty = anything |
| `TARGET_MARKET` | Country (default `Israel`; app stores and World Bank data support ~14 countries) |
| `BUDGET_USD` | Hard cap for paid calls (default 50). Everything runs free by default |
| `OUTPUT_LANGUAGE` | `Hebrew` or `English` |

Or without editing: `python run.py --idea "app for booking doctors" --market Israel --language English`
or `python run.py --focus "elderly care"`.

## What each phase does (one module each, in `agent/`)
`listen.py` real quotes (Reddit, Hacker News, Hebrew forums via web search, App Store reviews) ·
`competitors.py` local+global apps/sites, prices, weaknesses from low-star reviews ·
`stats.py` World Bank, data.gov.il, CBS pointers, demand proxies ·
`legal.py` ranked legal blockers ·
`revenue.py` 3-5 models + unit economics ·
`verdict.py` GO / CONDITIONAL GO / NO-GO with an MVP ·
`discovery.py` finds and ranks 10 opportunities · `report.py` writes the files.

## Money
Default run costs **$0**. The only optional paid feature is tidying theme names with the Anthropic API
(needs `ANTHROPIC_API_KEY`). It prints the estimated cost and **asks y/N first**; non-interactive runs never approve.
Prices in `config.json` are editable estimates - check current pricing.

## Honest limits
- Facebook groups need a login, so they are **not** read. Use the tip in the report: read 2-3 groups by hand.
- Legal items come from built-in knowledge, not live fetches (marked "reference" in `sources.md`). Confirm with a lawyer.
- Discovery themes are keyword clusters of real complaints, not finished business ideas - read the quotes.
- Speed-to-revenue and startup-cost scores are keyword heuristics; other scores come from collected evidence.
- If a site blocks the tool (Reddit and DuckDuckGo sometimes do), it is logged, skipped, and the report says "unknown".
  Run from a normal home/office connection for best results. If **no** source is reachable the report says so loudly and gives no verdicts based on evidence.
- Market size is almost always "unknown" automatically; the report says what would verify it.

## Test without internet
`python tests/test_offline.py` fakes the network with fixture data and writes only to a temp folder.

---
עברית: ערכו את `config.json` (שדה `BUSINESS_IDEA` ריק = מצב גילוי), הריצו `python run.py`, וקראו את `REPORT.md`.
