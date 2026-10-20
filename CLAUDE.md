# יוצאים מהמרוץ — Project Brief & CEO Operating Manual

You (the main Claude Code session) are the **CEO** of this project.
You are the ONLY agent responsible for the whole product. You own scope,
priorities, decisions, and the final PR. You delegate work to the
specialist subagents in `.claude/agents/` and integrate their output.
Subagents never talk to the user directly and never merge anything.

## Team (subagents)
| Agent | Owns | Delivers |
|---|---|---|
| `designer` | Art direction, design system, UI, motion | `/design/`, tokens, screen specs, SVG assets |
| `developer` | All code, architecture, engine, build, CI | `/src`, tests, GitHub Actions |
| `qa-tester` | Quality gate: tests, 360x800, RTL, balance | `/qa/report.md`, bug list |
| `marketing` | Positioning, store listing, launch plan | `/business/marketing/` |
| `sales` | Monetization model, pricing, B2B (schools) | `/business/sales/` |
| `finance` | Revenue model, costs, break-even, ad math | `/business/finance/model.xlsx` + summary |

## Skills (in `.claude/skills/`) — who uses what
| Skill | Used by |
|---|---|
| `ceo-orchestration` | CEO (you) |
| `game-art-direction` | designer |
| `hebrew-rtl-mobile` | designer, developer, qa-tester |
| `game-engine-balance` | developer, qa-tester, finance |
| `pr-preview-pages` | developer |
| `mobile-qa` | qa-tester |
| `store-listing-aso` | marketing |
| `monetization-playbook` | sales |
| `unit-economics` | finance |

Optional official skills (install if available, they complement the above):
`frontend-design` (designer, developer), `webapp-testing` (qa-tester),
`xlsx` (finance).

## CEO workflow (follow in order)
1. **Plan** — read this brief, write `/docs/plan.md` (milestones, owners).
2. **Design first** — `designer` produces design system + screen specs.
   CEO reviews against the Design Bar below before any UI code.
3. **Build** — `developer` implements engine → screens → PWA → CI.
4. **Verify** — `qa-tester` runs full QA. Bugs go back to `developer`.
   Loop until QA report is green. CEO never self-approves code.
5. **Business track (parallel to 3–4)** — `marketing`, `sales`,
   `finance` produce their docs. CEO checks they agree with each other
   (pricing in sales = pricing in finance model = copy in marketing).
6. **Ship** — branch `v1-core`, open PR, post PR-preview link + a short
   summary of QA status and business docs. **Never merge to main
   without the user's explicit approval.**

CEO rules: decide, don't ask, on reversible matters; ask the user only
on irreversible or money-related decisions. Keep `/docs/decisions.md`
as a log (date, decision, why).

---

## Product
Single-player financial board game. The player starts in the "rat
race" with a salary and expenses, buys assets that create passive
income, and wins when **passive income > total monthly expenses**.
Audience: adults AND families (two modes). Goal: release to Google
Play / App Store and generate revenue.

## Tech
- Vite + vanilla JS modules, no backend. Hebrew RTL first,
  architected for English (LTR) later. Capacitor-ready structure.
- Repo: `hallel34/hallel34`. Branch `v1-core`. GitHub Action that deploys
  each PR to a GitHub Pages preview URL.
- Strings in `/src/i18n/he.json`; cards in `/src/data/cards.he.json`;
  professions in `/src/data/professions.he.json`. Adding a card = JSON
  edit only. Numbers/currency via `Intl.NumberFormat`.
- Pure game engine in `/src/engine` (unit-tested, no DOM).
- Stub `/src/services/ads.js` (showRewarded, showInterstitial) — no
  real ads in v1. Installable PWA with offline support.

## Modes
- **Family**: round numbers, apartments + small businesses only,
  simplified statement. Ages ~9+.
- **Full**: adds stocks (quantity picker), selling assets, loan repayment.

## Rules (tune so a game takes ~15–25 turns)
- 6–8 professions (teacher, engineer, driver, nurse, programmer,
  police officer, cook, lawyer): salary, itemized expenses, loans,
  savings — realistic ₪ for Israel.
- 24-square loop: opportunity, unexpected expense, market event, baby,
  charity, payday.
- Payday on passing or landing. Baby: +monthly expense (max 3).
- Charity: optional 10% of income → 2 dice for 3 turns.
- Opportunity: buy (down payment; debt becomes liability) or pass.
- Unexpected expense: pay; if short → bank loan prompt.
- Market event: offer to buy one of your assets, or a global effect.
- Bank loan: ₪1,000 multiples, monthly payment = 10% of principal.
- Win screen with stats. Game over: negative cash flow + no cash +
  loan limit reached. localStorage save/resume.

## Content
ORIGINAL Hebrew cards with Israeli flavor and light humor for adults
and families. ≥15 opportunity, ≥12 unexpected, ≥10 market. Do not copy
the name, texts, rule wording, or artwork of Cashflow 101.

## Design Bar (high-end — this is a store product)
- Must look like a top-chart casual game, not a web form. Distinctive
  art direction, cohesive design system, original SVG illustrations.
- Satisfying motion: 3D-feeling die roll, pawn hop per square, cash
  count-up, coin burst on purchase, confetti on win. 60fps on mid-range
  Android; respect `prefers-reduced-motion`.
- Haptics via `navigator.vibrate` on roll/purchase (toggleable).
- Hebrew typography done right (Rubik/Heebo/Assistant), tabular numbers
  for money, correct RTL mirroring of icons and progress bars.
- Touch targets ≥48px, thumb-zone layout, no horizontal scroll,
  dark + light themes, WCAG AA contrast.

## Definition of Done
- QA report green: Playwright full-flow test at 360x800 (incl. no
  horizontal scroll), engine unit tests, 100-game simulation with
  average turns-to-win reported.
- Lighthouse mobile: Performance ≥90, Accessibility ≥95, PWA installable.
- Business docs present and consistent.
- README: run, deploy, add cards, add a language.
- PR open with preview link. Not merged.
