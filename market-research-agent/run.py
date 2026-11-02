#!/usr/bin/env python3
"""Market research agent - one command:  python run.py   (reads config.json)"""
import argparse
import csv
import json
from pathlib import Path

from agent import common as C
from agent import competitors, discovery, legal, listen, report, revenue, stats, verdict

HERE = Path(__file__).resolve().parent


def keywords_of(text, n=6):
    seen = []
    for t in C.tokens(text):
        if t not in seen:
            seen.append(t)
    return seen[:n]


def validate(idea, keywords, ctx, adv, seed_quotes=()):
    """The six validation phases for one idea."""
    C.log(f"=== VALIDATING: {idea[:80]} ===")
    kws = keywords or keywords_of(idea)
    term = " ".join(kws[:3])
    m = ctx["market"]
    qs = [f"{term} problem {m}", f"{term} frustrating OR expensive OR \"I wish\"", f"{term} בעיה OR יקר OR מתסכל"]
    found = listen.relevant(listen.collect(qs, ctx), kws, 40)
    quotes = list(seed_quotes) + [q for q in found if q["url"] not in {s["url"] for s in seed_quotes}]
    quotes.sort(key=lambda q: q.get("complaint", False), reverse=True)
    quotes = quotes[:ctx["max_quotes"]]
    C.log(f"Phase 1 done: {len(quotes)} real quotes kept")
    comps = competitors.run([term], ctx)
    cst = competitors.stats(comps)
    C.log(f"Phase 2 done: {cst['count']} competitors, {cst['weakness_quotes']} weakness quotes")
    st = stats.run(kws, cst, ctx)
    C.log(f"Phase 3 done: {len(st['rows'])} sourced numbers")
    lg = legal.run(" ".join(kws) + " " + idea, ctx)
    rv = revenue.run(" ".join(kws) + " " + idea, comps, ctx["adv"])
    vd = verdict.run(quotes, cst, lg, st["rows"], rv)
    C.log(f"Verdict: {vd['verdict']}")
    return {"idea": idea, "keywords": kws, "quotes": quotes, "competitors": comps, "competitor_stats": cst,
            "stats": st, "legal": lg, "revenue": rv, "verdict": vd}


def write_csv(name, rows, fields):
    with open(C.out_dir() / "data" / name, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def main(argv=None):
    ap = argparse.ArgumentParser(description="General market research agent")
    ap.add_argument("--config", default=str(HERE / "config.json"))
    ap.add_argument("--idea"); ap.add_argument("--focus"); ap.add_argument("--market")
    ap.add_argument("--budget", type=float); ap.add_argument("--language")
    ap.add_argument("--out", help="output folder (default: this folder)")
    a = ap.parse_args(argv)
    cfg = json.loads(Path(a.config).read_text(encoding="utf-8"))
    for k, v in (("BUSINESS_IDEA", a.idea), ("FOCUS_AREA", a.focus), ("TARGET_MARKET", a.market),
                 ("BUDGET_USD", a.budget), ("OUTPUT_LANGUAGE", a.language)):
        if v is not None:
            cfg[k] = v
    adv = cfg.get("ADVANCED", {})
    C.init(a.out or HERE, adv.get("REQUEST_DELAY_SECONDS", 1.0), cfg.get("BUDGET_USD", 50))
    market = cfg.get("TARGET_MARKET") or "Israel"
    lang = "he" if (cfg.get("OUTPUT_LANGUAGE") or "Hebrew").lower().startswith(("he", "עב")) else "en"
    ctx = {"market": market, "country": C.country(market), "focus": (cfg.get("FOCUS_AREA") or "").strip(),
           "lang": lang, "language": cfg.get("OUTPUT_LANGUAGE"), "max_quotes": adv.get("MAX_QUOTES_PER_IDEA", 12), "adv": adv}
    idea = (cfg.get("BUSINESS_IDEA") or "").strip()
    C.log(f"Market: {market} | focus: {ctx['focus'] or 'anything'} | budget: ${cfg['BUDGET_USD']} (spent so far $0) | language: {lang}")

    result = {"mode": "validation" if idea else "discovery", "ctx": {k: v for k, v in ctx.items() if k != "adv"}}
    if idea:
        result["ideas"] = [validate(idea, None, ctx, adv)]
    else:
        disc = discovery.run(ctx, adv)
        result["discovery"] = disc
        C.save_json("discovery.json", disc)
        top = disc["themes"][:adv.get("VALIDATE_TOP", 3)]
        if not top:
            C.log("No opportunity themes could be built from the data I could reach.", "WARN")
        result["ideas"] = [validate(t.get("idea_name") or t["title"], t["keywords"], ctx, adv, t["quotes"][:6]) for t in top]

    for i, r in enumerate(result["ideas"], 1):
        C.save_json(f"idea_{i}.json", r)
        write_csv(f"idea_{i}_quotes.csv", r["quotes"], ["text", "source", "url", "date", "scope"])
        write_csv(f"idea_{i}_competitors.csv", r["competitors"], ["name", "type", "market", "price", "rating", "rating_count", "url", "positioning"])
    result["failures"] = C.FAILURES
    result["spent"] = C.state["spent"]
    C.save_json("run_summary.json", {"failures": C.FAILURES, "sources": C.SOURCES, "spent_usd": C.state["spent"]})
    out = C.out_dir()
    (out / "REPORT.md").write_text(report.build(result), encoding="utf-8")
    (out / "sources.md").write_text(report.sources_md(), encoding="utf-8")
    live = sum(1 for s in C.SOURCES.values() if s["kind"] == "live")
    C.log(f"DONE. {live} live sources, {len(C.FAILURES)} unreachable. Report: {out / 'REPORT.md'}")


if __name__ == "__main__":
    main()
