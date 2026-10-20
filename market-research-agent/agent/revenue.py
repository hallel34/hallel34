"""Phase 5 - revenue models ranked by revenue vs effort and risk, plus simple unit economics."""
import math
import re

from . import common as C
from . import competitors

# (id, revenue 1-5, effort 1-5 (low=easy), risk 1-5 (low=safe), names)
MODELS = [
    ("subscription", 4, 3, 3, "Monthly subscription", "מנוי חודשי"),
    ("one_time", 2, 2, 2, "One-time paid product / info product", "מוצר חד-פעמי בתשלום / מוצר מידע"),
    ("service_first", 2, 1, 1, "Done-for-you service first, software later", "שירות בעבודת יד קודם, תוכנה אחר כך"),
    ("b2b", 5, 4, 3, "B2B licence / per-seat pricing", "רישיון עסקי / תמחור לפי משתמש"),
    ("commission", 4, 4, 4, "Marketplace commission", "עמלה על עסקאות בפלטפורמה"),
    ("leadgen", 3, 3, 3, "Lead generation / referral fees", "דמי הפניה / מכירת לידים"),
    ("ads", 2, 3, 4, "Advertising", "פרסום"),
]


def rank(text):
    rows = []
    for mid, rev, eff, risk, en, he in MODELS:
        adj = 0
        if mid == "commission" and not re.search(r"marketplace|platform|match|connect|פלטפורמ|שוק|חיבור", text, re.I):
            adj -= 1
        if mid == "b2b" and re.search(r"business|company|b2b|clinic|store|עסק|חברה|מרפאה|חנות|עסקים", text, re.I):
            adj += 1
        if mid == "ads":
            risk += 1  # needs big audience first
        score = rev * 2 - eff - risk + adj
        rows.append({"id": mid, "revenue": rev, "effort": eff, "risk": risk, "score": score, "en": en, "he": he})
    rows.sort(key=lambda r: -r["score"])
    return rows[:5]


def unit_economics(top, comps, adv):
    a = adv["ASSUMPTIONS"]
    med = competitors.median_price_usd(comps)
    if a.get("price_per_month_usd"):
        price, price_src = a["price_per_month_usd"], "config.json (your number)"
    elif med:
        price, price_src = med, "median of competitor prices quoted in USD (live data)"
    else:
        price, price_src = 10.0, "PLACEHOLDER assumption - no competitor price found; replace it in config.json"
    var, cac, fixed = a["variable_cost_per_customer_usd"], a["acquisition_cost_per_customer_usd"], a["fixed_costs_per_month_usd"]
    contrib = price - var
    be = math.ceil(fixed / contrib) if contrib > 0 else None
    payback = round(cac / contrib, 1) if contrib > 0 else None
    return {"model": top["id"], "price_usd": round(price, 2), "price_source": price_src, "variable_cost_usd": var,
            "acquisition_cost_usd": cac, "fixed_costs_month_usd": fixed, "contribution_per_customer": round(contrib, 2),
            "break_even_customers": be, "cac_payback_months": payback,
            "note": "Cost figures are ASSUMPTIONS to be replaced with real quotes; they are not research findings."}


def run(text, comps, adv):
    C.log("Revenue: ranking models and computing unit economics")
    ranked = rank(text)
    return {"ranked": ranked, "unit": unit_economics(ranked[0], comps, adv)}
