"""Phase 6 - verdict. Transparent rules, so you can see exactly why."""
MVP = {
    "subscription": ("Landing page + payment link for a 'founding member' price; ads or 3 community posts; goal: 10 paying members.",
                     "דף נחיתה + קישור תשלום במחיר 'חברים מייסדים'; מודעה או 3 פוסטים בקהילות; יעד: 10 משלמים."),
    "one_time": ("Sell a PDF/template to 20 people by direct message; goal: 5 sales.", "מכירת מדריך/תבנית ל-20 אנשים בהודעה ישירה; יעד: 5 מכירות."),
    "service_first": ("Do the service by hand for 5 real customers (WhatsApp + spreadsheet); goal: 3 paying and 1 repeat.",
                      "לבצע את השירות ידנית ל-5 לקוחות אמיתיים (וואטסאפ + גיליון); יעד: 3 משלמים ואחד חוזר."),
    "b2b": ("Interview 15 business owners, then offer a paid 30-day pilot to 3; goal: 1 signed pilot.",
            "ראיון עם 15 בעלי עסקים, ואז הצעת פיילוט בתשלום ל-3; יעד: פיילוט חתום אחד."),
    "commission": ("Match 10 buyers with 10 sellers by hand and take a fee; goal: 5 completed paid matches.",
                   "חיבור ידני של 10 קונים ל-10 מוכרים ולקיחת עמלה; יעד: 5 התאמות בתשלום."),
    "leadgen": ("Collect 30 leads with a simple form and sell 10 to a partner business; goal: 1 paying partner.",
                "איסוף 30 לידים בטופס ומכירת 10 לעסק שותף; יעד: שותף משלם אחד."),
    "ads": ("Build a small content page, reach 1,000 visitors, test 1 sponsor; goal: first sponsor payment.",
            "דף תוכן קטן, 1,000 מבקרים ובדיקת נותן חסות; יעד: תשלום ראשון מנותן חסות."),
}


def run(quotes, comp_stats, legal, stats_rows, revenue):
    q = len({x["url"] for x in quotes})
    cq, comps, apps = comp_stats["weakness_quotes"], comp_stats["count"], comp_stats["apps"]
    worst = max([l["severity"] for l in legal], default=0)
    score = (2 if q >= 5 else 1 if q >= 2 else 0) + (1 if comps >= 1 else 0) + (1 if cq >= 2 else 0) \
        + (1 if comp_stats["total_ratings"] >= 1000 else 0) - (2 if worst >= 5 else 1 if worst >= 4 else 0)
    thin = (q + comps) == 0
    if thin:
        v = "NO-GO"
    elif score >= 4 and worst < 5:
        v = "GO"
    elif score >= 2:
        v = "CONDITIONAL GO"
    else:
        v = "NO-GO"
    top_legal = next((l for l in legal if l["severity"] == worst), None)
    return {"verdict": v, "score": score, "thin": thin, "quotes": q, "competitors": comps, "weakness_quotes": cq,
            "worst_legal": top_legal, "worst_severity": worst, "total_ratings": comp_stats["total_ratings"],
            "mvp": MVP[revenue["ranked"][0]["id"]], "top_model": revenue["ranked"][0]["id"]}
