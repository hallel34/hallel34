---
name: ceo-orchestration
description: How the CEO session runs the פסיבו (Passivo) team — delegating to subagents, review gates, decision log and shipping the PR. Use at the start of every session and before delegating.
---
# CEO orchestration

## Start of every session
1. Read `CLAUDE.md`, `/docs/plan.md`, `/docs/decisions.md`, latest
   `/qa/report.md`. Know where the project stands before acting.
2. Update the task list with the next milestone's tasks and owners.

## Delegating
- One clear task per subagent call, with: goal, inputs (file paths),
  expected output files, acceptance criteria. Subagents start cold —
  give them everything they need in the prompt.
- Run independent work in parallel (e.g. designer + marketing + finance
  early; developer after design specs exist).
- Read every deliverable yourself before accepting it.

## Gates (never skip)
| Gate | Pass condition |
|---|---|
| Design | Directions chosen, tokens + screen specs meet the Design Bar |
| Build | Unit tests pass, build passes |
| QA | `/qa/report.md` GREEN (0 P0, 0 P1) from `qa-tester`, not you |
| Business | Prices identical across sales / finance / marketing docs |
| Ship | PR open, preview link works on a phone-sized viewport |

## Fix loop
QA RED → send the bug list to `developer` → QA again. Max 3 loops,
then tell the user what's blocking.

## Decisions
Reversible (layout, copy, colors, card content) → decide, log in
`/docs/decisions.md`. Irreversible or money (merging, paid services,
publishing to stores, pricing final) → ask the user.

## Reporting to the user
Short Hebrew summary: what's done, preview link, QA status, open
questions. No step-by-step recap.
