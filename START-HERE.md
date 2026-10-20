# ערכת פתיחה — פסיבו (Passivo)

## מה יש כאן
- `CLAUDE.md` — המנכ"ל: הבריף המלא, סדר העבודה ורף העיצוב. Claude Code
  קורא אותו אוטומטית, והסשן הראשי הוא האחראי היחיד על הכל.
- `.claude/agents/` — שישה סוכנים: מעצב, מפתח, בודק, שיווק, מכירות, פיננסים.
- `.claude/skills/` — תשעה סקילים, כל סוכן טוען את שלו.

| סוכן | סקילים |
|---|---|
| CEO (הסשן הראשי) | ceo-orchestration |
| designer | game-art-direction, hebrew-rtl-mobile |
| developer | game-engine-balance, hebrew-rtl-mobile, pr-preview-pages |
| qa-tester | mobile-qa, hebrew-rtl-mobile, game-engine-balance |
| marketing | store-listing-aso |
| sales | monetization-playbook |
| finance | unit-economics, game-engine-balance |

## איך מתחילים
1. צור repo ריק ב-GitHub (למשל `passivo`).
2. העתק את כל התוכן של התיקייה הזו לשורש ה-repo (כולל `.claude` המוסתרת).
3. ב-`CLAUDE.md` החלף את `<OWNER/REPO>` בשם ה-repo.
4. פתח Claude Code בתיקייה והדבק:

```
You are the CEO defined in CLAUDE.md. Load the ceo-orchestration skill,
write /docs/plan.md, then run the team: designer first (and marketing,
sales, finance in parallel), then developer, then qa-tester until the
QA report is GREEN. Work on branch v1-core, open a PR, and give me the
preview link. Do not merge to main.
```

## מומלץ להתקין גם (אם זמין אצלך)
הסקילים הרשמיים של Anthropic: `frontend-design`, `webapp-testing`, `xlsx`.
הסוכנים ישתמשו בהם כתוספת.
