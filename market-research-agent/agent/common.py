"""Shared helpers: logging, polite cached web access, source registry, budget."""
import hashlib
import json
import re
import sys
import time
from datetime import date, datetime
from pathlib import Path
from urllib.parse import parse_qs, quote_plus, urlparse

import requests

ROOT = Path(__file__).resolve().parent.parent
UA = "Mozilla/5.0 (compatible; MarketResearchAgent/1.0; +local-research-tool)"

COUNTRIES = {  # name -> (iTunes storefront, World Bank ISO3, DuckDuckGo region)
    "israel": ("il", "ISR", "il-he"), "united states": ("us", "USA", "us-en"),
    "usa": ("us", "USA", "us-en"), "united kingdom": ("gb", "GBR", "uk-en"),
    "uk": ("gb", "GBR", "uk-en"), "germany": ("de", "DEU", "de-de"),
    "france": ("fr", "FRA", "fr-fr"), "canada": ("ca", "CAN", "ca-en"),
    "australia": ("au", "AUS", "au-en"), "india": ("in", "IND", "in-en"),
    "brazil": ("br", "BRA", "br-pt"), "spain": ("es", "ESP", "es-es"),
    "italy": ("it", "ITA", "it-it"), "netherlands": ("nl", "NLD", "nl-nl"),
}

state = {"out": ROOT, "delay": 1.0, "spent": 0.0, "budget": 50.0}
SOURCES = {}   # url -> dict(label, checked, status, kind)
FAILURES = []


def init(out_dir=None, delay=1.0, budget=50.0):
    state.update(out=Path(out_dir) if out_dir else ROOT, delay=delay, budget=float(budget), spent=0.0)
    SOURCES.clear()
    FAILURES.clear()
    (state["out"] / "data" / "cache").mkdir(parents=True, exist_ok=True)


def out_dir():
    return state["out"]


def log(msg, level="INFO"):
    print(f"[{datetime.now():%H:%M:%S}] {level:<5} {msg}", flush=True)


def today():
    return date.today().isoformat()


def country(name):
    key = (name or "israel").split(",")[0].strip().lower()
    for k, v in COUNTRIES.items():
        if k in key:
            return v
    log(f"Country '{name}' is not in my list; using US app store and no national statistics.", "WARN")
    return ("us", None, "us-en")


# ---------- sources ----------
def add_source(url, label, status="ok", kind="live"):
    """kind: live (fetched now) | reference (from built-in knowledge, NOT fetched) | failed."""
    SOURCES.setdefault(url, {"label": label, "checked": today(), "status": status, "kind": kind})


# ---------- web ----------
def fetch(url, params=None, as_json=False, label="", headers=None, method="GET", data=None, ttl_hours=24):
    """Return text/JSON or None. Never raises: failures are logged and recorded."""
    key = hashlib.sha1(json.dumps([url, params, data, method], sort_keys=True, default=str).encode()).hexdigest()
    cache = state["out"] / "data" / "cache" / f"{key}.txt"
    if cache.exists() and time.time() - cache.stat().st_mtime < ttl_hours * 3600:
        body = cache.read_text(encoding="utf-8")
        return json.loads(body) if as_json else body
    h = {"User-Agent": UA, "Accept-Language": "he,en;q=0.8"}
    h.update(headers or {})
    last = ""
    for attempt in range(2):
        try:
            time.sleep(state["delay"])
            r = requests.request(method, url, params=params, data=data, headers=h, timeout=25)
            if r.status_code == 429:
                time.sleep(5)
                last = "rate limited (429)"
                continue
            if r.status_code >= 400:
                last = f"HTTP {r.status_code}"
                break
            body = r.text
            payload = json.loads(body) if as_json else body
            cache.write_text(body, encoding="utf-8")
            full = r.url
            add_source(full, label or urlparse(url).netloc)
            return payload
        except Exception as e:  # noqa: BLE001 - we must never crash on a source
            last = type(e).__name__ + ": " + str(e)[:80]
    host = urlparse(url).netloc
    FAILURES.append({"url": url, "reason": last, "label": label})
    log(f"Could not reach {host} ({last}). Skipping this source.", "WARN")
    return None


def web_search(query, region="us-en", max_results=8, label="DuckDuckGo search"):
    """Free web search via DuckDuckGo's HTML page. Returns [{title,url,snippet}]."""
    from bs4 import BeautifulSoup
    html = fetch("https://html.duckduckgo.com/html/", params={"q": query, "kl": region}, label=label)
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml") if _has_lxml() else BeautifulSoup(html, "html.parser")
    out = []
    for res in soup.select("div.result"):
        a = res.select_one("a.result__a")
        if not a:
            continue
        href = a.get("href", "")
        if "uddg=" in href:
            href = parse_qs(urlparse(href).query).get("uddg", [href])[0]
        sn = res.select_one(".result__snippet")
        out.append({"title": a.get_text(" ", strip=True), "url": href,
                    "snippet": sn.get_text(" ", strip=True) if sn else ""})
        if len(out) >= max_results:
            break
    if not out:
        log(f"Web search returned nothing for: {query[:60]}", "WARN")
    return out


def _has_lxml():
    try:
        import lxml  # noqa: F401
        return True
    except ImportError:
        return False


# ---------- text ----------
STOP = set("""the and for that with this have from your you are was were not but can all any has had its our out who
what when where why how about would there their them they then than into over just like get got one two very really
also more some much many only even still should could will been being does did dont cant isnt its im ive
של על את לא זה זו הוא היא הם הן אני אנחנו אתה את יש אין כל גם או אבל כי אם מה מי איך למה מתי איפה עוד רק כמו
היה היו להיות לי לך לו לה לנו להם עם בין אל מן מאוד כמה אחד אחת זאת אלה אלו שלי שלך שלו שלה ממש פשוט צריך
app apps אפליקציה אפליקציות""".split())


def tokens(text):
    return [t.lower() for t in re.findall(r"[A-Za-z֐-׿]{3,}", text or "") if t.lower() not in STOP]


def clean(text, n=300):
    t = re.sub(r"<[^>]+>", " ", text or "")
    t = re.sub(r"\s+", " ", t).strip()
    return t if len(t) <= n else t[:n].rsplit(" ", 1)[0] + "…"


def save_json(name, obj):
    p = state["out"] / "data" / name
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


# ---------- budget ----------
def ask_paid(description, cost_usd):
    """Print the cost and ask permission. Non-interactive runs never approve."""
    remaining = state["budget"] - state["spent"]
    print(f"\n  PAID CALL: {description}\n  Estimated cost: ${cost_usd:.4f}  (budget left: ${remaining:.2f})")
    if cost_usd > remaining:
        log("Over budget - not doing it.", "WARN")
        return False
    if not sys.stdin.isatty():
        log("Not interactive, so I cannot ask you - skipping the paid call.", "WARN")
        return False
    ok = input("  Approve? [y/N] ").strip().lower() == "y"
    if ok:
        state["spent"] += cost_usd
    return ok
