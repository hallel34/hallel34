"""Offline smoke test: fakes the network with FIXTURE data (never written to the real REPORT.md).
Run:  python tests/test_offline.py"""
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import run  # noqa: E402
from agent import common as C  # noqa: E402


def fake_fetch(url, params=None, as_json=False, label="", **kw):
    p = params or {}
    C.add_source(url, label or "fixture")
    if "reddit.com/search" in url:
        return {"data": {"children": [{"data": {"title": f"אין שירות טוב לתורים אצל רופא {i}", "selftext": "מישהו מכיר שירות לתורים? מתסכל מאוד",
                "permalink": f"/r/israel/comments/{i}/x/", "created_utc": 1760000000, "subreddit": "israel"}} for i in range(4)]}}
    if "algolia" in url:
        return {"hits": [{"comment_text": "I wish there was an app for booking doctor appointments in Israel, so frustrating", "objectID": "11", "created_at": "2026-01-01T00:00:00Z"}]}
    if "itunes.apple.com/search" in url:
        return {"results": [{"trackName": "DocBook", "price": 0, "currency": "ILS", "trackViewUrl": "https://apps.apple.com/il/app/x/id1",
                "trackId": 1, "averageUserRating": 3.1, "userRatingCount": 5000, "description": "Book doctors fast. More text."}]}
    if "customerreviews" in url:
        return {"feed": {"entry": [{"im:rating": {"label": "1"}, "title": {"label": "גרוע"}, "content": {"label": "האפליקציה קורסת כל הזמן ואין תמיכה"},
                "updated": {"label": "2026-02-02T00:00:00-07:00"}}]}}
    if "worldbank" in url:
        return [{}, [{"value": 9900000.0, "date": "2024"}]]
    if "data.gov.il" in url:
        return {"result": {"results": [{"title": "Clinics", "name": "clinics", "organization": {"title": "MoH"}, "metadata_modified": "2026-01-01"}]}}
    if "trends.google" in url:
        return "<rss><channel><item><title>תור רופא</title></item></channel></rss>"
    return None


def fake_search(query, region="us-en", max_results=8, label=""):
    return [{"title": "Clinic booking מחיר", "url": "https://example.test/clinic", "snippet": "שירות תורים ₪50 לחודש"}]


C.fetch = fake_fetch
C.web_search = fake_search
for m in ("listen", "competitors", "stats", "discovery"):
    pass

for args, name in ((["--idea", "אפליקציה לקביעת תורים לרופאים"], "validation"), ([], "discovery"), (["--idea", "online tutoring", "--language", "English"], "english")):
    out = tempfile.mkdtemp()
    run.main(["--out", out] + args)
    rep = (Path(out) / "REPORT.md").read_text(encoding="utf-8")
    assert "## 6." in rep and "Claude" not in rep, name
    assert (Path(out) / "sources.md").exists() and (Path(out) / "data" / "idea_1.json").exists()
    print(f"OK {name}: {len(rep)} chars -> {out}")
