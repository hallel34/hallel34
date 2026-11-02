"""Phase 3 - hard numbers. Only live-fetched, sourced numbers; everything else is 'unknown' + how to verify."""
from . import common as C

WB = {"SP.POP.TOTL": "Population", "IT.NET.USER.ZS": "Internet users (% of population)",
      "NY.GDP.PCAP.CD": "GDP per person (current US$)"}


def world_bank(iso3):
    rows = []
    for code, label in WB.items():
        url = f"https://api.worldbank.org/v2/country/{iso3}/indicator/{code}"
        d = C.fetch(url, params={"format": "json", "mrnev": 1}, as_json=True, label="World Bank open data")
        try:
            rec = d[1][0]
            rows.append({"metric": label, "value": f"{rec['value']:,.1f}".rstrip("0").rstrip("."), "period": rec["date"],
                         "url": f"{url}?format=json&mrnev=1", "checked": C.today(), "confidence": "high"})
        except (TypeError, IndexError, KeyError):
            pass
    return rows


def data_gov_il(keywords):
    rows = []
    for kw in keywords[:3]:
        d = C.fetch("https://data.gov.il/api/3/action/package_search", params={"q": kw, "rows": 4}, as_json=True,
                    label="data.gov.il (CKAN)")
        for r in ((d or {}).get("result") or {}).get("results", []):
            rows.append({"metric": f"Official dataset: {r.get('title')}",
                         "value": f"published by {(r.get('organization') or {}).get('title', '?')}; modified {str(r.get('metadata_modified'))[:10]}",
                         "period": "", "url": f"https://data.gov.il/dataset/{r.get('name')}", "checked": C.today(),
                         "confidence": "medium"})
    return rows


def cbs_pointers(keywords, region):
    rows = []
    for r in C.web_search(f"site:cbs.gov.il {' '.join(keywords[:3])}", region, 3, label="Web search (CBS)"):
        rows.append({"metric": f"CBS page that may hold figures: {r['title'][:80]}", "value": "not read automatically - open the link",
                     "period": "", "url": r["url"], "checked": C.today(), "confidence": "low"})
    return rows


def run(keywords, comp_stats, ctx):
    C.log("Numbers: official statistics")
    _, iso3, region = ctx["country"]
    rows = world_bank(iso3) if iso3 else []
    if iso3 == "ISR":
        rows += data_gov_il(keywords) + cbs_pointers(keywords, region)
    if comp_stats["apps"]:
        rows.append({"metric": "Demand proxy: total App Store ratings across the top competing apps found",
                     "value": f"{comp_stats['total_ratings']:,} ratings over {comp_stats['apps']} apps",
                     "period": "now", "url": "https://itunes.apple.com/search", "checked": C.today(), "confidence": "medium"})
    unknown = [{"metric": "Market size (revenue per year) for this exact niche", "value": "unknown",
                "verify": "CBS household expenditure survey for the matching category, or an industry report; "
                          "alternative: bottom-up = number of potential customers x price x realistic share."},
               {"metric": "Number of potential customers in the target market", "value": "unknown",
                "verify": "CBS population tables filtered to the audience (age, region, business type), cross-checked with data.gov.il registries."}]
    return {"rows": rows, "unknown": unknown}
