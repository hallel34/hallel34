"""Shared helpers: logging, polite cached web access, source registry, budget."""
import hashlib
import html as htmlmod
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
HOST_FAILS = {}  # host -> consecutive connection failures
MAX_HOST_FAILS = 2
HOST_DELAY = {"itunes.apple.com": 4.0}  # Apple answers 403 to bursts (~20 calls/minute allowed)
BLOCK_MARKERS = ("anomaly-modal", "challenge-form", "captcha")  # a bot-check page is not data


def init(out_dir=None, delay=1.0, budget=50.0):
    state.update(out=Path(out_dir) if out_dir else ROOT, delay=delay, budget=float(budget), spent=0.0)
    SOURCES.clear()
    FAILURES.clear()
    HOST_FAILS.clear()
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
def fetch(url, params=None, as_json=False, label="", headers=None, method="GET", data=None, ttl_hours=24, check_block=False):
    """Return text/JSON or None. Never raises: failures are logged and recorded.
    check_block: treat a bot-check/captcha page as a failure instead of caching it as data."""
    key = hashlib.sha1(json.dumps([url, params, data, method], sort_keys=True, default=str).encode()).hexdigest()
    cache = state["out"] / "data" / "cache" / f"{key}.txt"
    if cache.exists() and time.time() - cache.stat().st_mtime < ttl_hours * 3600:
        body = cache.read_text(encoding="utf-8")
        return json.loads(body) if as_json else body
    host = urlparse(url).netloc
    if HOST_FAILS.get(host, 0) >= MAX_HOST_FAILS:
        return None  # this site kept failing - do not waste time on it again
    h = {"User-Agent": UA, "Accept-Language": "he,en;q=0.8"}
    h.update(headers or {})
    last = ""
    for attempt in range(2):
        try:
            time.sleep(max(state["delay"], HOST_DELAY.get(host, 0)) * (1 + 4 * attempt))
            r = requests.request(method, url, params=params, data=data, headers=h, timeout=25)
            if r.status_code in (403, 429):  # often a rate limit: back off and try once more
                last = f"HTTP {r.status_code}"
                continue
            if r.status_code >= 400:
                last = f"HTTP {r.status_code}"
                break
            body = r.text
            if check_block and any(m in body for m in BLOCK_MARKERS):
                last = "blocked by the site's bot check (captcha page)"
                continue
            payload = json.loads(body) if as_json else body
            cache.write_text(body, encoding="utf-8")
            HOST_FAILS[host] = 0
            full = r.url
            add_source(full, label or urlparse(url).netloc)
            return payload
        except Exception as e:  # noqa: BLE001 - we must never crash on a source
            last = type(e).__name__ + ": " + str(e)[:80]
    HOST_FAILS[host] = HOST_FAILS.get(host, 0) + 1
    FAILURES.append({"url": url, "reason": last, "label": label})
    note = " Giving up on this site for the rest of the run." if HOST_FAILS[host] >= MAX_HOST_FAILS else ""
    log(f"Could not reach {host} ({last}). Skipping this source.{note}", "WARN")
    return None


def web_search(query, region="us-en", max_results=8, label="DuckDuckGo search"):
    """Free web search via DuckDuckGo's HTML page. Returns [{title,url,snippet}]."""
    from bs4 import BeautifulSoup
    html = fetch("https://html.duckduckgo.com/html/", params={"q": query, "kl": region}, label=label, check_block=True)
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
    text = re.sub(r"['’]", "", htmlmod.unescape(text or ""))  # don't -> dont (a stop word), not "don"
    return [t.lower() for t in re.findall(r"[A-Za-z֐-׿]{3,}", text) if t.lower() not in STOP]


def clean(text, n=300):
    t = htmlmod.unescape(re.sub(r"<[^>]+>", " ", text or ""))
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
