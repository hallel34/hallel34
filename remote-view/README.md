# Remote View – שיתוף מסך חינמי (מחשב ← נייד)

שלושה חלקים:
- `server.py` – שרת ממסר (מריצים על שרת/מחשב עם כתובת נגישה; עובד מאחורי NAT כי כולם מתחברים החוצה).
- `host.py` – רץ על המחשב שרוצים לראות. מציג קוד + סיסמה חד-פעמיים.
- `web/index.html` – הצופה: נפתח בדפדפן של הנייד, בלי התקנה.

## הרצה
```
pip install -r requirements.txt
python server.py --port 8080                       # בשרת
python host.py --server ws://SERVER:8080            # במחשב (צפייה בלבד)
python host.py --server ws://SERVER:8080 --allow-control   # + שליטה בעכבר/מקלדת
```
בנייד: פותחים `http://SERVER:8080`, מכניסים קוד וסיסמה.
בנייד: נגיעה = קליק, גרירה = תזוזת עכבר, שתי אצבעות = גלילה.

## אבטחה
- ברירת מחדל: צפייה בלבד; שליטה רק עם `--allow-control`.
- לשימוש דרך האינטרנט שימו את השרת מאחורי HTTPS (Caddy / nginx / Cloudflare Tunnel) ועברו ל-`wss://`.
