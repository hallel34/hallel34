"""Phase 2 - competitors (local + global): offer, price, weakness from user reviews, positioning."""
import re
from statistics import median

from . import common as C
from . import listen

PRICE = re.compile(r"(₪\s?\d[\d,.]*|\d[\d,.]*\s?₪|\$\s?\d[\d,.]*|\d[\d,.]*\s?(?:ש\"ח|שקל|ILS|NIS|USD|EUR|€))")


def _first_sentence(text, n=160):
    t = C.clean(text, 400)
    m = re.split(r"(?<=[.!?])\s", t, maxsplit=1)
    return C.clean(m[0], n)


def itunes(term, store, scope, limit=6):
    d = C.fetch("https://itunes.apple.com/search", params={"term": term, "country": store, "entity": "software", "limit": limit},
                as_json=True, label=f"Apple App Store search ({store})")
    out = []
    for r in (d or {}).get("results", []):
        price = r.get("price")
        out.append({"name": r.get("trackName"), "type": "app", "market": scope, "url": r.get("trackViewUrl"),
                    "id": r.get("trackId"), "store": store, "genre": r.get("primaryGenreName"),
                    "price": "free to download" if not price else f"{price} {r.get('currency', '')}",
                    "price_num_usd": None,
                    "rating": r.get("averageUserRating"), "rating_count": r.get("userRatingCount") or 0,
                    "positioning": _first_sentence(r.get("description", "")), "weakness_quotes": [], "confidence": "medium"})
    return out


def web(term, region, scope):
    out = []
    for r in C.web_search(f"{term} מחיר OR price", region, 6, label="Web search (competitors)"):
        m = PRICE.search(r["title"] + " " + r["snippet"])
        out.append({"name": r["title"][:70], "type": "website/service", "market": scope, "url": r["url"], "id": None,
                    "price": m.group(1) if m else "unknown (check their pricing page)", "rating": None, "rating_count": 0,
                    "positioning": C.clean(r["snippet"], 160), "weakness_quotes": [], "confidence": "low"})
    return out


def run(idea_terms, ctx):
    store, _, region = ctx["country"]
    term = idea_terms[0]
    C.log(f"Competitors: looking in {ctx['market']} and globally for '{term[:50]}'")
    comps = itunes(term, store, ctx["market"])
    if store != "us":
        comps += [c for c in itunes(term, "us", "global") if c["name"] not in {x["name"] for x in comps}][:4]
    comps += web(term, region, ctx["market"])
    for c in [c for c in comps if c["type"] == "app" and c["id"]][:6]:
        c["weakness_quotes"] = listen.appstore_reviews(c["id"], c["name"], c["url"], c["store"])[:2]
    return comps


def stats(comps):
    apps = [c for c in comps if c["type"] == "app"]
    return {"count": len(comps), "apps": len(apps),
            "total_ratings": sum(c["rating_count"] for c in apps),
            "weakness_quotes": sum(len(c["weakness_quotes"]) for c in comps)}


def median_price_usd(comps):
    """Only numbers explicitly in USD are used; everything else stays 'unknown'."""
    vals = []
    for c in comps:
        m = re.match(r"([\d.]+) USD", c["price"] or "")
        if m:
            vals.append(float(m.group(1)))
    return median(vals) if vals else None
