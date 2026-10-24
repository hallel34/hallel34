# תוכנית — MaxiFox (v1-core)

| # | אבן דרך | בעלים | תוצר | תלות |
|---|---|---|---|---|
| M1 | כיוון אמנותי + design system + מפרטי מסכים + SVG | designer | /design, tokens.css, /src/assets | – |
| M1b | שיווק / מכירות / פיננסים (במקביל) | marketing, sales, finance | /business/* | מחירים: sales קובע, האחרים משתמשים |
| M2 | מנוע + תוכן (קלפים, מקצועות) + בדיקות יחידה + סימולציה | developer | /src/engine, /src/data | M1 לא חוסם את המנוע |
| M3 | מסכים, אנימציות, PWA, CI ל-Pages preview | developer | /src, .github | M1 |
| M4 | QA מלא (Playwright 360x800, סימולציית 100 משחקים, Lighthouse) | qa-tester | /qa/report.md | M3 |
| M5 | לולאת תיקונים עד ירוק (מקס' 3) | developer + qa-tester | – | M4 |
| M6 | סקירה ויזואלית של designer, README, PR | CEO | PR (ללא merge) | M5 |

שערים: ראו ceo-orchestration. ענף העבודה: `ccr-6e0ec1cd-enmcaj` (הוגדר ע"י הסביבה במקום `v1-core`).
