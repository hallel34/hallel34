# 🎭 חברה – משחק מאפיה לנייד

משחק מאפיה בעברית שבו כל שחקן משחק מהטלפון שלו. הסנכרון בזמן אמת עובר דרך Firebase Firestore.

## התחלה עם Claude Code
```bash
cd chevra-mafia
claude
```
בתוך Claude Code:
- `/kickoff` – ה-CEO מפעיל את כל הצוות: בדיקה, ביקורת עיצוב, שיווק, מכירות וכספים, ואז תיקונים.
- `/team <משימה>` – שליחת משימה לצוות, למשל: `/team הוסף תפקיד ליצן`.
- אפשר גם לפנות לסוכן ספציפי: "תן ל-tester לבדוק את ההצבעה".

הצוות נמצא ב-`.claude/agents/`: developer, designer, tester, marketing, sales ו-finance. הסשן הראשי הוא ה-CEO (ראה `CLAUDE.md`).

## חיבור Firebase
1. ב-[Firebase Console](https://console.firebase.google.com): צור פרויקט, הוסף Web App והעתק את `firebaseConfig`.
2. הדבק אותו בראש הסקריפט ב-`public/index.html`.
3. צור Firestore Database.
4. הרץ:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use --add          # בחר את הפרויקט
   firebase deploy             # Hosting + Rules
   ```

## הרצה מקומית
```bash
npx serve public
```
