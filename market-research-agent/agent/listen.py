"""Phase 1 - listen to real people. Collects real quotes (with links) about a problem."""
import re
from datetime import datetime, timezone

from . import common as C

COMPLAINT = re.compile(
    r"i wish|why is there no|why isn'?t there|frustrat|annoying|can'?t find|cannot find|looking for|need a |anyone know|"
    r"too expensive|overpriced|waste of|scam|terrible|worst|doesn'?t work|no way to|hard to|impossible to|"
    r"אין שירות|מישהו מכיר|מחפש|מחפשת|מתסכל|יקר מדי|יקר מידי|אי אפשר|למה אין|בעיה עם|מעצבן|שירות גרוע|גרוע|נוראי|מבאס|"
    r"לא מצליח|לא מצאתי|מישהו יודע|אין פתרון", re.I)

SEEDS_EN = ['"I wish there was"', '"why is there no"', '"looking for a service"', '"so frustrating"', '"too expensive"']
SEEDS_HE = ['"מישהו מכיר שירות"', '"למה אין"', '"אין פתרון"', '"שירות גרוע"', '"מתסכל"']


def is_complaint(text):
    return bool(COMPLAINT.search(text or ""))


def _q(text, url, source, date, scope, **extra):
    return {"text": C.clean(text), "url": url, "source": source, "date": date, "scope": scope, **extra}


def reddit(query, scope_label, limit=25):
    d = C.fetch("https://www.reddit.com/search.json", params={"q": query, "limit": limit, "sort": "relevance", "t": "year"},
                as_json=True, label="Reddit search")
    out = []
    for ch in ((d or {}).get("data") or {}).get("children", []):
        p = ch.get("data", {})
        body = p.get("selftext") or p.get("title", "")
        text = (p.get("title", "") + ". " + body) if body != p.get("title") else body
        out.append(_q(text, "https://www.reddit.com" + p.get("permalink", ""), f"Reddit r/{p.get('subreddit', '?')}",
                      datetime.fromtimestamp(p.get("created_utc", 0), timezone.utc).date().isoformat(), scope_label))
    return out


def hackernews(query, limit=20):
    d = C.fetch("https://hn.algolia.com/api/v1/search", params={"query": query, "tags": "comment", "hitsPerPage": limit},
                as_json=True, label="Hacker News (Algolia)")
    return [_q(h.get("comment_text", ""), f"https://news.ycombinator.com/item?id={h.get('objectID')}", "Hacker News",
               (h.get("created_at") or "")[:10], "global") for h in (d or {}).get("hits", [])]


def forums(query, region):
    """Hebrew forums and Q&A sites through free web search (snippets only - we cannot log in to Facebook groups)."""
    out = []
    for site in ("tapuz.co.il", "fxp.co.il", "reddit.com/r/israel", "facebook.com/groups"):
        for r in C.web_search(f"site:{site} {query}", region, 4, label="Web search (forums)"):
            out.append(_q(r["title"] + ". " + r["snippet"], r["url"], f"Web: {site}", "", "market"))
    return out


def appstore_reviews(app_id, app_name, app_url, store, max_stars=2, limit=25):
    d = C.fetch(f"https://itunes.apple.com/{store}/rss/customerreviews/page=1/id={app_id}/sortby=mostrecent/json",
                as_json=True, label="Apple App Store reviews")
    out = []
    for e in ((d or {}).get("feed") or {}).get("entry", [])[:limit]:
        try:
            stars = int(e["im:rating"]["label"])
        except (KeyError, ValueError):
            continue
        if stars <= max_stars:
            out.append(_q(e["title"]["label"] + ". " + e["content"]["label"], app_url, f"App Store review of {app_name}",
                          (e.get("updated", {}).get("label") or "")[:10], "market", rating=stars))
    return out


def collect(queries, ctx, deep=True):
    """queries: list of search strings. Returns de-duplicated complaint-like quotes."""
    store, _, region = ctx["country"]
    scope = ctx["market"]
    found = []
    for q in queries:
        C.log(f"Listening: '{q[:70]}'")
        found += reddit(q, scope)
        found += hackernews(q)
        if deep:
            found += forums(q, region)
    seen, out = set(), []
    for x in found:
        key = x["url"] + x["text"][:40]
        if key in seen or len(x["text"]) < 25:
            continue
        seen.add(key)
        x["complaint"] = is_complaint(x["text"])
        out.append(x)
    return out


def relevant(quotes, keywords, limit):
    """Keep quotes that mention the topic; prefer ones that sound like complaints/needs."""
    kw = set(keywords)
    scored = []
    for x in quotes:
        hit = len(kw & set(C.tokens(x["text"])))
        if kw and not hit:
            continue
        scored.append((x["complaint"], hit, x))
    scored.sort(key=lambda s: (s[0], s[1]), reverse=True)
    return [s[2] for s in scored[:limit]]
