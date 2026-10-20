"""Builds REPORT.md and sources.md in plain language (Hebrew or English)."""
from urllib.parse import urlparse

from . import common as C

VERDICT_HE = {"GO": "GO (כדאי להתקדם)", "CONDITIONAL GO": "CONDITIONAL GO (להתקדם בתנאים)", "NO-GO": "NO-GO (לא להתקדם כרגע)"}
CONF_HE = {"high": "גבוהה", "medium": "בינונית", "low": "נמוכה"}


def md(s):
    return str(s if s is not None else "").replace("|", "\\|").replace("\n", " ")


def build(res):
    he = res["ctx"]["lang"] == "he"
    t = lambda en, h: h if he else en  # noqa: E731
    cf = lambda c: CONF_HE.get(c, c) if he else c  # noqa: E731
    L = []
    w = L.append
    ctx = res["ctx"]
    live = sum(1 for s in C.SOURCES.values() if s["kind"] == "live")
    bad_hosts = len({urlparse(f["url"]).netloc for f in res["failures"]})
    discovery = res["mode"] == "discovery"

    w(t("# Market research report", "# דוח מחקר שוק") + f" - {ctx['market']}")
    w(f"\n{t('Date', 'תאריך')}: {C.today()} | {t('Mode', 'מצב')}: "
      f"{t('Discovery (find opportunities)', 'גילוי (חיפוש הזדמנויות)') if discovery else t('Validation of one idea', 'בדיקת רעיון אחד')}"
      f" | {t('Focus', 'תחום')}: {ctx['focus'] or t('anything', 'כל תחום')} | {t('Paid spend', 'הוצאה בתשלום')}: ${res['spent']:.2f}")
    w("\n## " + t("How much to trust this report", "עד כמה לסמוך על הדוח"))
    w(t(f"- Live sources that answered: **{live}**. Unreachable sources (skipped): **{bad_hosts}** sites (list in sources.md).",
        f"- מקורות חיים שענו: **{live}**. מקורות שלא היו זמינים (דולגו): **{bad_hosts}** אתרים (הרשימה ב-sources.md)."))
    if live == 0:
        w(t("\n> **WARNING: no live data source could be reached in this run, so there is NO market evidence below.** "
            "Everything marked 'unknown' means exactly that. Run the tool again from a computer with normal internet access.",
            "\n> **אזהרה: בהרצה זו לא ניתן היה להגיע לאף מקור מידע חי, ולכן אין בדוח שום ראיה משוק.** "
            "כל מה שמסומן 'לא ידוע' הוא באמת לא ידוע. יש להריץ שוב ממחשב עם גישה רגילה לאינטרנט."))
    elif live < 5:
        w(t("\n> Warning: very few sources answered; treat the conclusions as weak.",
            "\n> אזהרה: מעט מאוד מקורות ענו; יש להתייחס למסקנות כחלשות."))
    w(t("- Quotes are real text from the linked page. Scores marked 'heuristic' are rules of thumb, not facts. "
        "Legal items come from the agent's built-in knowledge and are NOT a substitute for a lawyer.",
        "- הציטוטים הם טקסט אמיתי מהעמוד המקושר. ציונים המסומנים 'היוריסטי' הם כללי אצבע ולא עובדות. "
        "הסעיפים המשפטיים מבוססים על ידע מובנה של הכלי ואינם תחליף לעורך דין."))

    for n, r in enumerate(res["ideas"], 1):
        _idea(L, r, n, t, cf, he, discovery)

    if discovery:
        w("\n---\n## " + t("Final summary: ranked opportunities and verdicts for the top 3", "סיכום: דירוג ההזדמנויות ופסקי דין ל-3 המובילות"))
        th = res["discovery"]["themes"]
        d = res["discovery"]
        w(t(f"From {d['all_quotes']} posts/reviews, {d['complaints']} sounded like complaints or unmet needs; "
            f"{len(d['trends'])} trending searches and {len(d['regulations'])} regulation snippets were checked.",
            f"מתוך {d['all_quotes']} פוסטים/ביקורות, {d['complaints']} נשמעו כתלונות או צרכים לא מסופקים; "
            f"נבדקו {len(d['trends'])} חיפושים טרנדיים ו-{len(d['regulations'])} קטעי רגולציה."))
        if not th:
            w(t("\n**No opportunities could be built: not enough data was reachable.**", "\n**לא ניתן היה לבנות הזדמנויות: לא נאסף מספיק מידע.**"))
        else:
            w("\n| # | " + t("Opportunity (theme)", "הזדמנות (נושא)") + " | " + t("Score /100", "ציון /100") + " | "
              + t("Demand", "ביקוש") + " | " + t("Low competition", "תחרות נמוכה") + " | " + t("Legal ease", "קלות משפטית") + " | "
              + t("Speed*", "מהירות*") + " | " + t("Low cost*", "עלות נמוכה*") + " | " + t("Quotes", "ציטוטים") + " |")
            w("|---|---|---|---|---|---|---|---|---|")
            for i, x in enumerate(th, 1):
                s = x["scores"]
                name = x.get("idea_name") or x["title"]
                w(f"| {i} | {md(name)} | **{s['total']}** | {s['demand']}/5 | {s['competition']}/5 | {s['legality']}/5 | {s['speed']}/5 | {s['cost']}/5 | {len(x['quotes'])} |")
            w(t("\n\\* heuristic (keyword rules of thumb). Other scores are computed from collected evidence. Themes are keyword clusters of real complaints - "
                "read the quotes before believing a theme is a real business.",
                "\n\\* היוריסטי (כללי אצבע לפי מילות מפתח). שאר הציונים מחושבים מהראיות שנאספו. הנושאים הם אשכולות מילים של תלונות אמיתיות - "
                "יש לקרוא את הציטוטים לפני שמאמינים שנושא הוא עסק אמיתי."))
        w("\n### " + t("Verdicts for the top ideas", "פסקי דין לרעיונות המובילים"))
        w("| # | " + t("Idea", "רעיון") + " | " + t("Verdict", "פסק דין") + " |\n|---|---|---|")
        for i, r in enumerate(res["ideas"], 1):
            v = r["verdict"]["verdict"]
            w(f"| {i} | {md(r['idea'])} | **{VERDICT_HE[v] if he else v}** |")
    return "\n".join(L) + "\n"


def _idea(L, r, n, t, cf, he, discovery):
    w = L.append
    v = r["verdict"]
    w(f"\n---\n# {t('Idea', 'רעיון')} {n}: {r['idea']}" if discovery else f"\n---\n# {t('Idea', 'רעיון')}: {r['idea']}")

    w("\n## 1. " + t("What real people say", "מה אנשים אומרים"))
    if r["quotes"]:
        w("| " + t("Quote", "ציטוט") + " | " + t("Source", "מקור") + " | " + t("Date", "תאריך") + " | " + t("Confidence", "ביטחון") + " |\n|---|---|---|---|")
        for q in r["quotes"]:
            conf = "medium" if q.get("complaint") and q["scope"] != "global" else "low"
            w(f"| \"{md(q['text'])}\" | [{md(q['source'])}]({q['url']}) | {q['date'] or '?'} | {cf(conf)} |")
    else:
        w(t("No quotes could be collected (sources unreachable or nothing found). **Unknown.** To verify: read the Facebook groups and forums of the audience by hand and save 10 quotes.",
            "לא נאספו ציטוטים (מקורות לא זמינים או שלא נמצא דבר). **לא ידוע.** לאימות: לקרוא ידנית קבוצות פייסבוק ופורומים של קהל היעד ולשמור 10 ציטוטים."))
    w(t("\nFacebook groups need a login, so they are not read automatically.", "\nקבוצות פייסבוק דורשות התחברות ולכן אינן נקראות אוטומטית."))

    w("\n## 2. " + t("Competitors (local and global)", "מתחרים (מקומיים וגלובליים)"))
    if r["competitors"]:
        w("| " + t("Name", "שם") + " | " + t("Where", "היכן") + " | " + t("Price", "מחיר") + " | " + t("Positioning (their words)", "מיצוב (במילים שלהם)")
          + " | " + t("Main weakness (from users)", "חולשה עיקרית (לפי משתמשים)") + " | " + t("Confidence", "ביטחון") + " |\n|---|---|---|---|---|---|")
        for c in r["competitors"]:
            wk = "; ".join(f"\"{md(q['text'][:140])}\" ([{q.get('rating', '?')}★]({q['url']}))" for q in c["weakness_quotes"]) \
                or t("unknown - no low-rated reviews found", "לא ידוע - לא נמצאו ביקורות נמוכות")
            nm = f"[{md(c['name'])}]({c['url']})" if c["url"] else md(c["name"])
            rt = f" ({c['rating']:.1f}★, {c['rating_count']:,})" if c["rating"] else ""
            w(f"| {nm}{rt} | {md(c['market'])} / {c['type']} | {md(c['price'])} | {md(c['positioning'])} | {wk} | {cf(c['confidence'])} |")
    else:
        w(t("No competitors could be retrieved. **Unknown.** To verify: search the app stores and Google by hand for 5 minutes.",
            "לא ניתן היה לאתר מתחרים. **לא ידוע.** לאימות: חיפוש ידני בחנויות האפליקציות ובגוגל למשך 5 דקות."))

    w("\n## 3. " + t("Hard numbers", "מספרים קשים"))
    if r["stats"]["rows"]:
        w("| " + t("Metric", "מדד") + " | " + t("Value", "ערך") + " | " + t("Period", "תקופה") + " | " + t("Source", "מקור") + " | " + t("Checked", "נבדק") + " | " + t("Confidence", "ביטחון") + " |\n|---|---|---|---|---|---|")
        for s in r["stats"]["rows"]:
            w(f"| {md(s['metric'])} | {md(s['value'])} | {s['period']} | <{s['url']}> | {s['checked']} | {cf(s['confidence'])} |")
    for u in r["stats"]["unknown"]:
        w(f"- **{u['metric']}: {t('unknown', 'לא ידוע')}.** {t('What would verify it', 'מה יאמת')}: {u['verify']}")

    w("\n## 4. " + t("Legality (most to least serious)", "חוקיות (מהחמור לקל)"))
    w("| " + t("Severity", "חומרה") + " | " + t("Issue", "נושא") + " | " + t("Why it matters", "למה זה חשוב") + " | " + t("Reference", "מקור") + " |\n|---|---|---|---|")
    for l in r["legal"]:
        w(f"| {l['severity']}/5 | {l['he'] if he else l['en']} | {l['why_he'] if he else l['why_en']} | <{l['url']}> |")
    w(t("\nConfidence: medium. Built-in knowledge, not fetched live; confirm with an Israeli lawyer before launch.",
        "\nביטחון: בינוני. ידע מובנה ולא נשלף בזמן אמת; יש לאשר עם עורך דין ישראלי לפני ההשקה."))

    w("\n## 5. " + t("Revenue models", "מודלי הכנסה"))
    w("| # | " + t("Model", "מודל") + " | " + t("Revenue", "הכנסה") + " | " + t("Effort", "מאמץ") + " | " + t("Risk", "סיכון") + " |\n|---|---|---|---|---|")
    for i, m in enumerate(r["revenue"]["ranked"], 1):
        w(f"| {i} | {m['he'] if he else m['en']} | {m['revenue']}/5 | {m['effort']}/5 | {m['risk']}/5 |")
    u = r["revenue"]["unit"]
    w(t("\n(1-5 scores are the agent's rules of thumb - heuristic.)\n\n**Unit economics of the top model** (assumptions - change them in config.json):",
        "\n(ציוני 1-5 הם כללי אצבע של הכלי - היוריסטי.)\n\n**כלכלת יחידה של המודל המוביל** (הנחות - ניתן לשנות ב-config.json):"))
    be = u["break_even_customers"]
    w(f"- {t('Price per customer per month', 'מחיר ללקוח לחודש')}: ${u['price_usd']} ({u['price_source']})")
    w(f"- {t('Cost to serve one customer', 'עלות שירות ללקוח')}: ${u['variable_cost_usd']} | {t('Cost to win a customer', 'עלות רכישת לקוח')}: ${u['acquisition_cost_usd']} | {t('Fixed costs per month', 'עלויות קבועות לחודש')}: ${u['fixed_costs_month_usd']}")
    w(f"- {t('Break-even', 'נקודת איזון')}: **{be if be else t('not reachable', 'לא ניתנת להשגה')}** {t('paying customers', 'לקוחות משלמים')}; "
      f"{t('payback of acquisition cost', 'החזר עלות רכישה')}: {u['cac_payback_months']} {t('months', 'חודשים')}")

    w("\n## 6. " + t("Verdict", "פסק דין"))
    vv = VERDICT_HE[v["verdict"]] if he else v["verdict"]
    w(f"### **{vv}**")
    if v["thin"]:
        w(t("_Default because no evidence was gathered: without evidence, the safe answer is not to build yet._",
            "_ברירת מחדל כי לא נאספו ראיות: ללא ראיות, התשובה הבטוחה היא לא לבנות עדיין._"))
    w("\n**" + t("Three strongest reasons", "שלוש הסיבות החזקות") + "**")
    reasons = [
        t(f"{v['quotes']} distinct source(s) with real complaints/needs were found.", f"נמצאו {v['quotes']} מקורות שונים עם תלונות/צרכים אמיתיים."),
        t(f"{v['competitors']} competitor(s) found; {v['weakness_quotes']} low-rating user quote(s) point to weaknesses; {v['total_ratings']:,} app ratings show existing demand.",
          f"נמצאו {v['competitors']} מתחרים; {v['weakness_quotes']} ציטוטי משתמשים בדירוג נמוך מצביעים על חולשות; {v['total_ratings']:,} דירוגי אפליקציות מעידים על ביקוש קיים."),
        t(f"Most serious legal item: {v['worst_legal']['en'] if v['worst_legal'] else 'none'} (severity {v['worst_severity']}/5).",
          f"הסעיף המשפטי החמור ביותר: {v['worst_legal']['he'] if v['worst_legal'] else 'אין'} (חומרה {v['worst_severity']}/5)."),
    ]
    for i, x in enumerate(reasons, 1):
        w(f"{i}. {x}")
    risk = (t("Biggest open risk: ", "הסיכון הפתוח הגדול ביותר: ") +
            ((v["worst_legal"]["he"] if he else v["worst_legal"]["en"]) + t(" (licensing/compliance)", " (רישוי/ציות)")
             if v["worst_severity"] >= 4 else t("that the evidence is thin and nobody has yet paid for this - only a real test settles that.",
                                               "שהראיות דלות ועדיין אף אחד לא שילם על זה - רק ניסוי אמיתי יכריע.")))
    w(f"\n**{risk}**")
    w("\n**" + t("Smallest real-world test (MVP)", "הניסוי הקטן ביותר בשטח (MVP)") + f":** {v['mvp'][1] if he else v['mvp'][0]}")
    w(t("\nThe verdict is produced by transparent rules (evidence counts minus legal severity); it supports a decision but does not replace one.",
        "\nפסק הדין נקבע לפי כללים שקופים (כמות ראיות פחות חומרה משפטית); הוא תומך בהחלטה אך אינו מחליף אותה."))


def sources_md():
    L = ["# Sources", "", f"Generated {C.today()}. 'Date checked' is the day the agent fetched the page.", ""]
    for kind, title in (("live", "Fetched live in this run"), ("reference", "Built-in references (NOT fetched - verify before relying)")):
        L += [f"## {title}", "", "| Source | URL | Date checked | Status |", "|---|---|---|---|"]
        for url, s in sorted(C.SOURCES.items()):
            if s["kind"] == kind:
                L.append(f"| {md(s['label'])} | <{url}> | {s['checked']} | {s['status']} |")
        L.append("")
    L += ["## Unreachable (logged and skipped)", "", "| Source | URL | Reason |", "|---|---|---|"]
    seen = set()
    for f in C.FAILURES:
        if f["url"] in seen:
            continue
        seen.add(f["url"])
        L.append(f"| {md(f['label'] or '-')} | <{f['url']}> | {md(f['reason'])} |")
    return "\n".join(L) + "\n"
