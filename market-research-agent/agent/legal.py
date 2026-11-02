"""Phase 4 - legality. A rule-based checklist from the agent's BUILT-IN knowledge (not fetched live).
Every item is therefore marked 'reference' in sources.md, confidence medium, and must be confirmed by a lawyer."""
import re

from . import common as C

GOV = "https://www.gov.il/en/departments/"
RULES = [
    dict(id="health", sev=5, rx=r"health|medic|doctor|clinic|therap|patient|pharma|diet|בריאות|רופא|מרפא|תרופ|טיפול|מטופל|קליני|פסיכו",
         en="Health services or health advice", he="שירותי בריאות או ייעוץ רפואי",
         why_en="Medical activity, medical devices and health data are regulated by the Ministry of Health; giving medical advice without qualification can be illegal.",
         why_he="פעילות רפואית, מכשור רפואי ומידע רפואי מוסדרים על ידי משרד הבריאות; מתן ייעוץ רפואי ללא הסמכה עלול להיות אסור.",
         url=GOV + "ministry_of_health"),
    dict(id="finance", sev=5, rx=r"loan|credit|invest|insur|pension|mortgage|crypto|payment|bank|lend|הלוואה|אשראי|השקע|ביטוח|פנסיה|משכנתא|קריפטו|תשלום|בנק",
         en="Financial products (credit, investing, insurance, payments)", he="מוצרים פיננסיים (אשראי, השקעות, ביטוח, תשלומים)",
         why_en="Credit, investment advice, insurance brokerage and payment services usually need a licence from the Securities Authority, the Capital Market Authority or the Bank of Israel.",
         why_he="אשראי, ייעוץ השקעות, סוכנות ביטוח ושירותי תשלום דורשים בדרך כלל רישיון מרשות ניירות ערך, רשות שוק ההון או בנק ישראל.",
         url=GOV + "the_capital_market_insurance_and_savings_authority"),
    dict(id="gambling", sev=5, rx=r"gambl|betting|casino|lotter|poker|הימור|קזינו|לוטו|פוקר",
         en="Gambling / betting", he="הימורים",
         why_en="Gambling is prohibited in Israel except for state-run games; running it privately is a criminal risk.",
         why_he="הימורים אסורים בישראל מלבד משחקים מוסדרים של המדינה; הפעלה פרטית היא סיכון פלילי.",
         url="https://www.nevo.co.il/"),
    dict(id="minors", sev=4, rx=r"child|kid|minor|teen|school|student|parent|baby|ילד|ילדים|נוער|תלמיד|בית ספר|הורים|תינוק|קטינ",
         en="Children / minors", he="ילדים וקטינים",
         why_en="Collecting data from minors, or contracting with them, needs parental consent and extra care; a minor's contract is generally not binding without it.",
         why_he="איסוף מידע על קטינים או התקשרות איתם דורשים הסכמת הורים וזהירות יתרה; חוזה של קטין בדרך כלל אינו מחייב ללא כך.",
         url=GOV + "the_privacy_protection_authority"),
    dict(id="food_alcohol", sev=4, rx=r"food|restaurant|catering|alcohol|wine|beer|tobacco|vape|cannabis|אוכל|מסעד|קייטרינג|אלכוהול|יין|בירה|טבק|סיגריות|קנאביס",
         en="Food, alcohol, tobacco or cannabis", he="מזון, אלכוהול, טבק או קנאביס",
         why_en="Food businesses need a business licence and Ministry of Health food-safety approval; alcohol, tobacco and cannabis have extra licensing and advertising limits.",
         why_he="עסקי מזון דורשים רישיון עסק ואישורי בטיחות מזון של משרד הבריאות; לאלכוהול, טבק וקנאביס יש רישוי והגבלות פרסום נוספות.",
         url=GOV + "ministry_of_health"),
    dict(id="professional", sev=4, rx=r"legal advice|lawyer|attorney|accountant|tax|architect|engineer|עורך דין|משפט|ייעוץ משפטי|רואה חשבון|מס|אדריכל|מהנדס",
         en="Regulated professions (law, accounting, engineering)", he="מקצועות מוסדרים (משפטים, חשבונאות, הנדסה)",
         why_en="Only licensed members may offer professional advice in these fields; a platform must not appear to give such advice itself.",
         why_he="רק בעלי רישיון רשאים להציע ייעוץ מקצועי בתחומים אלה; פלטפורמה לא יכולה להיראות כמי שנותנת ייעוץ כזה בעצמה.",
         url="https://www.israelbar.org.il/"),
    dict(id="transport", sev=4, rx=r"taxi|ride|driver|delivery|courier|transport|shuttle|מונית|נסיעה|נהג|משלוח|שליח|הסעה|הובלה",
         en="Passenger transport / delivery workforce", he="הסעת נוסעים / עובדי משלוחים",
         why_en="Paid passenger transport needs Ministry of Transport licences; using couriers as 'freelancers' risks employment-law claims.",
         why_he="הסעת נוסעים בתשלום דורשת רישיונות ממשרד התחבורה; העסקת שליחים כעצמאים מסכנת בתביעות דיני עבודה.",
         url=GOV + "ministry_of_transport_and_road_safety"),
    dict(id="employment", sev=3, rx=r"job|hiring|recruit|freelanc|worker|employ|salary|עבודה|גיוס|משרה|פרילנס|עובד|שכר",
         en="Employment / recruiting", he="תעסוקה וגיוס",
         why_en="Recruiting and worker-matching touch labour law (equal opportunity at hiring, minimum wage, employer-employee status).",
         why_he="גיוס והתאמת עובדים נוגעים בדיני עבודה (שוויון הזדמנויות בגיוס, שכר מינימום, יחסי עובד-מעביד).",
         url=GOV + "ministry_of_labor"),
    dict(id="realestate", sev=3, rx=r"real estate|rent|landlord|tenant|apartment|broker|דירה|שכירות|משכיר|שוכר|תיווך|נדל",
         en="Real estate / rentals / brokerage", he="נדל\"ן, שכירות ותיווך",
         why_en="Brokerage requires a broker's licence and a written agreement; rental platforms touch the Tenant and Landlord rules.",
         why_he="תיווך דורש רישיון מתווך והסכם בכתב; פלטפורמות שכירות נוגעות בחוקי השכירות והשוכר.",
         url=GOV + "ministry_of_justice"),
    dict(id="hardware", sev=3, rx=r"device|hardware|drone|battery|sensor|electronic|gadget|מכשיר|רחפן|סוללה|חיישן|אלקטרוניקה",
         en="Physical products / electronics", he="מוצרים פיזיים ואלקטרוניקה",
         why_en="Many products need a Standards Institute (SII) approval or import permit and carry product-liability exposure.",
         why_he="מוצרים רבים דורשים אישור מכון התקנים או רישיון יבוא וחשופים לאחריות מוצר.",
         url="https://www.sii.org.il/"),
    dict(id="copyright", sev=3, rx=r"content|music|video|image|photo|book|scrap|crawl|stream|template|תוכן|מוזיקה|סרטון|תמונה|ספר|סריקה|תבנית",
         en="Copyright and scraping", he="זכויות יוצרים וסריקת אתרים",
         why_en="Using other people's content, images, music or scraped data without a licence can breach the Copyright Law (2007) and sites' terms of use.",
         why_he="שימוש בתוכן, תמונות, מוזיקה או נתונים שנסרקו ללא רישיון עלול להפר את חוק זכות יוצרים (2007) ותנאי שימוש של אתרים.",
         url="https://www.nevo.co.il/"),
]
ALWAYS = [
    dict(id="privacy", sev=3, en="Privacy Protection Law, 1981 incl. Amendment 13",
         he="חוק הגנת הפרטיות, התשמ\"א-1981, כולל תיקון 13",
         why_en="Any product that stores personal data must register/declare databases where required, name responsibilities, secure data, and honour access/deletion rights. Amendment 13 (in force from August 2025, as I know it - verify) widened definitions, duties and fines.",
         why_he="כל מוצר ששומר מידע אישי חייב לעמוד בחובות רישום/דיווח על מאגרים (היכן שנדרש), אבטחת מידע וכיבוד זכויות עיון ומחיקה. תיקון 13 (בתוקף מאוגוסט 2025 לפי מיטב ידיעתי - יש לאמת) הרחיב הגדרות, חובות וקנסות.",
         url=GOV + "the_privacy_protection_authority"),
    dict(id="consumer", sev=2, en="Consumer Protection Law, 1981 (distance sales, cancellation, clear pricing)",
         he="חוק הגנת הצרכן, התשמ\"א-1981 (מכר מרחוק, ביטול עסקה, שקיפות מחירים)",
         why_en="Online sales to consumers need clear price and terms, a right to cancel within the legal period, and a no-misleading-claims policy.",
         why_he="מכירה מקוונת לצרכנים מחייבת מחיר ותנאים ברורים, זכות ביטול בתוך התקופה הקבועה בחוק, והימנעות מהטעיה.",
         url=GOV + "the_consumer_protection_and_fair_trade_authority"),
    dict(id="spam", sev=2, en="Anti-spam rule (Communications Law, section 30A)",
         he="איסור דואר זבל (חוק התקשורת, סעיף 30א)",
         why_en="Marketing messages by email/SMS/automated call need prior opt-in consent and an easy opt-out.",
         why_he="הודעות שיווק באימייל/SMS/חיוג אוטומטי דורשות הסכמה מראש ואפשרות הסרה פשוטה.",
         url="https://www.nevo.co.il/"),
]


def run(text, ctx):
    C.log("Legality: checking the idea against the built-in legal checklist")
    items = []
    for r in RULES:
        if re.search(r["rx"], text, re.I):
            items.append(r)
    items += ALWAYS
    # sensitive combinations raise privacy severity
    ids = {i["id"] for i in items}
    out = []
    for i in items:
        sev = i["sev"]
        if i["id"] == "privacy" and ids & {"health", "minors", "finance"}:
            sev = 5
        out.append({"id": i["id"], "severity": sev, "en": i["en"], "he": i["he"], "why_en": i["why_en"],
                    "why_he": i["why_he"], "url": i["url"], "confidence": "medium"})
        C.add_source(i["url"], i["en"] + " (reference - not fetched by the agent)", status="not fetched", kind="reference")
    out.sort(key=lambda x: -x["severity"])
    if ctx["country"][1] != "ISR":
        C.log("Target market is not Israel: legal items are Israeli-law references; please adapt.", "WARN")
    return out
