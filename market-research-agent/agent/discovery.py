"""Discovery mode - find and rank underserved opportunities from real signals."""
import re
import xml.etree.ElementTree as ET
from collections import Counter

from . import common as C
from . import competitors, legal, listen, llm

DEFAULT_TERMS = ["appointments booking", "rent apartment", "delivery", "parents children", "freelancers invoices",
                 "small business accounting", "tutoring lessons", "car maintenance", "pets", "elderly care"]
GENERIC = set("""looking need anyone know wish service find found people thing things work works working want use using
used time year years day days israel israeli ישראל ישראלי מחפש מחפשת מישהו מכיר יודע שירות לעבוד עובד רוצה זמן שנה יום
אנשים דבר דברים בעיה פתרון please thanks thank help question אפשר צריכה יכול יכולה would get make made going
come now always never back good great bad best better well right still something anything everything nothing think
say said know new old lot way best ever every other another here same sure because problem issue
בבקשה תודה טוב רע הכי עכשיו תמיד אף פעם משהו כבר ככה אחרי לפני""".split())
DIGITAL = re.compile(r"online|app|website|platform|software|digital|saas|אונליין|אתר|דיגיטל|פלטפורמה|תוכנה", re.I)


def queries(ctx):
    focus = ctx["focus"]
    base = [f"{s} {focus} Israel".strip() for s in listen.SEEDS_EN[:3]]
    if ctx["country"][1] == "ISR":
        base += [f"{s} {focus}".strip() for s in listen.SEEDS_HE[:3]]
    return base


def trends(ctx):
    """Free Google Trends 'trending now' RSS for the target country."""
    geo = (ctx["country"][0] or "us").upper()
    xml = C.fetch("https://trends.google.com/trending/rss", params={"geo": geo}, label="Google Trends trending-now RSS", ttl_hours=6)
    out = []
    if xml:
        try:
            for it in ET.fromstring(xml).iter("item"):
                out.append({"title": (it.findtext("title") or "").strip(),
                            "traffic": it.findtext("{https://trends.google.com/trending/rss}approx_traffic") or ""})
        except ET.ParseError:
            C.log("Trends feed was not readable XML.", "WARN")
    return out


def regulations(ctx):
    q = "חוק חדש נכנס לתוקף עסקים חובה" if ctx["country"][1] == "ISR" else "new regulation takes effect businesses must comply"
    return C.web_search(f"{q} {ctx['focus']}".strip(), ctx["country"][2], 8, label="Web search (new regulations)")


def appstore_signals(ctx):
    out = []
    terms = [ctx["focus"]] if ctx["focus"] else DEFAULT_TERMS
    for t in terms:
        found = [a for a in competitors.itunes(t, ctx["country"][0], ctx["market"], limit=5) if a.get("genre") != "Games"]
        apps = sorted(found, key=lambda a: -a["rating_count"])[:2]
        for a in apps:
            out += [dict(q, complaint=True) for q in listen.appstore_reviews(a["id"], a["name"], a["url"], a["store"])]
    return out


def cluster(quotes, n=10, min_support=3):
    pool = [(q, set(C.tokens(q["text"])) - GENERIC) for q in quotes]
    themes = []
    while len(themes) < n:
        df = Counter(t for _, ts in pool for t in ts)
        if not df:
            break
        seed, cnt = df.most_common(1)[0]
        if cnt < min_support:
            break
        members = [(q, ts) for q, ts in pool if seed in ts]
        co = Counter(t for _, ts in members for t in ts if t != seed)
        kws = [seed] + [t for t, c in co.most_common(2) if c >= 2]
        themes.append({"keywords": kws, "quotes": [q for q, _ in members]})
        pool = [(q, ts) for q, ts in pool if seed not in ts]
    return themes


def score(theme, ctx, trend_titles, reg_text):
    kws = theme["keywords"]
    text = " ".join(kws)
    urls = len({q["url"] for q in theme["quotes"]})
    complaints = sum(1 for q in theme["quotes"] if q.get("complaint"))
    trend_hit = any(set(kws) & set(C.tokens(t)) for t in trend_titles)
    reg_hit = bool(set(kws) & set(C.tokens(reg_text)))
    demand = min(5, urls * 0.6 + complaints * 0.4 + (1 if trend_hit else 0) + (1 if reg_hit else 0))
    comps = competitors.itunes(" ".join(kws[:3]), ctx["country"][0], ctx["market"], limit=8)
    big = sum(1 for c in comps if c["rating_count"] >= 1000)
    competition = 5 if big == 0 else 4 if big <= 2 else 3 if big <= 4 else 2
    items = [l for l in legal.RULES if re.search(l["rx"], text, re.I)]
    worst = max([l["sev"] for l in items], default=0)
    legality = 5 - max(0, worst - 1)
    speed = (4 if DIGITAL.search(text) else 3) - (1 if worst >= 4 else 0) - (1 if any(l["id"] == "hardware" for l in items) else 0)
    cost = (4 if DIGITAL.search(text) else 3) - (1 if worst >= 4 else 0) - (1 if any(l["id"] == "hardware" for l in items) else 0)
    speed, cost = max(1, speed), max(1, cost)
    total = round((0.35 * demand + 0.15 * competition + 0.20 * legality + 0.15 * speed + 0.15 * cost) * 20)
    return {"demand": round(demand, 1), "competition": competition, "legality": legality, "speed": speed, "cost": cost,
            "total": total, "trend_hit": trend_hit, "reg_hit": reg_hit, "competing_big_apps": big,
            "worst_legal": worst, "scores_note": "demand/competition/legality are evidence-based; speed and cost are keyword heuristics"}


def run(ctx, adv):
    C.log("DISCOVERY MODE: looking for underserved needs. This can take several minutes.")
    quotes = listen.collect(queries(ctx), ctx, deep=True)
    quotes += appstore_signals(ctx)
    complaints = [q for q in quotes if q.get("complaint")]
    C.log(f"Collected {len(quotes)} posts/reviews, {len(complaints)} sound like complaints or unmet needs.")
    tr = trends(ctx)
    regs = regulations(ctx)
    C.log(f"Trends found: {len(tr)}; regulation snippets found: {len(regs)}")
    themes = cluster(complaints, adv["TOP_N_DISCOVERY"])
    reg_text = " ".join(r["title"] + " " + r["snippet"] for r in regs)
    for th in themes:
        C.log(f"Scoring theme: {', '.join(th['keywords'])} ({len(th['quotes'])} quotes)")
        th["scores"] = score(th, ctx, [t["title"] for t in tr], reg_text)
        th["title"] = " / ".join(th["keywords"])
    themes.sort(key=lambda t: -t["scores"]["total"])
    names = llm.ask_json(
        "Give each numbered theme a short business-idea name in %s. Use ONLY the keywords and quotes given; do not add facts. "
        "Reply with JSON like [{\"i\":0,\"idea\":\"...\"}].\n" % ctx["language"] +
        "\n".join(f"{i}: {t['keywords']} | {[q['text'][:120] for q in t['quotes'][:2]]}" for i, t in enumerate(themes)), adv) or []
    for n in names if isinstance(names, list) else []:
        try:
            themes[n["i"]]["idea_name"] = n["idea"]
        except (KeyError, IndexError, TypeError):
            pass
    return {"themes": themes, "trends": tr, "regulations": regs, "all_quotes": len(quotes), "complaints": len(complaints)}
