# api-cct

NestJS API for CCT (Centro de Compensação Tarifária): payment orders, CNAB remessa/retorno, ticket revenues. Read [PROJECT.md](PROJECT.md) first for commands, structure and gotchas.

## Workflow

Features, refactors and non-trivial bug fixes go through these skills, in order. Tasks run one at a time. Each one has a written output; do not skip ahead.

| # | Skill | Output |
| --- | --- | --- |
| 1 | `grill-with-docs` | resolved decisions in `CONTEXT.md`, `docs/adr/` |
| 2 | `to-prd` | `docs/PRD.md` (no new interview) |
| 3 | `task-planner` | `docs/TASKS.md` index + `docs/tasks/T<n>.md` |
| 4 | `task-runner` | runs the next task through `tdd`, writes `docs/task-runs/T<n>-*.md`, commits code and tests |
| — | `tdd` | red-green-refactor; used by `task-runner`, or directly for small changes |

- Do not write code before `docs/PRD.md` and the task plan exist. Urgent, narrow bug fixes may skip steps 1–2 only if the user says so; they still need failing behavior, expected behavior, affected area and a regression test.
- `docs/PRD.md`, `docs/TASKS.md`, `docs/tasks/` and `docs/task-runs/` are git-ignored working files. Never commit them or use `git add -f`.
- Review-only requests do not need the workflow.
- Technical debt: when you notice a shortcut (skipped test, silenced check, relaxed baseline, "for now" fix), ask the user once whether to record it in `docs/TECH-DEBT.md` (skill `tech-debt`, loads automatically). Never record without a yes; mention any new `TD-n` in the final report.

## Memory files (no duplication)

- `PROJECT.md`: how to work on the project (commands, structure, conventions). Update only when those change.
- `CONTEXT.md`: domain glossary, rules, fragile areas, open questions. Update when understanding changes.
- `docs/adr/`: hard-to-reverse decisions only.
- `docs/README.md`: index of the business docs; read `CONTEXT.md` and `docs/fluxo-pagamento.md` before touching payment code (remessa, retorno, agrupamento).
- `docs/TECH-DEBT.md`: shortcuts we accepted, who registered them and how to pay them.

## Language

- Skills, this file, code, comments, commit messages: English.
- `CONTEXT.md`, PRDs, task plans, ADRs: Brazilian Portuguese, keeping domain terms (remessa, favorecido, ordem de pagamento) as the code spells them.

## Rules that cannot be inferred from the code

- Respect the import directions between layers (PROJECT.md, "Layer rules"); ESLint fails on violations. Do not silence them with `eslint-disable`.
- Validate before claiming done: format, types, then the focused test, then wider tests (see PROJECT.md, "Validation ladder").
- Never edit applied migrations in `src/database/migrations/`; add a new one.
- `npm run lint` runs with `--fix` and rewrites files. To check only, run `npx eslint <files>`.
- Never commit `.env`, `env-deploy` values, credentials or `key.json` contents.
- Money and payment code (`src/cnab/`, `src/cron-jobs/`: remessa, retorno, ordem de pagamento) changes real payouts: keep diffs small, test first, and say what you did not verify. Never add a `remessa*Exec()` call to `onModuleLoad` or re-enable the remessa jobs unless asked.
- New or changed business logic gets a spec (PROJECT.md, "Testing"). After adding a passing spec run `npm run validate:update-baseline` so the gate protects it. Never write tests for SFTP or cron jobs.
- Do not run migrations, seeds or anything that writes to a database that is not local without asking (`.claude/settings.json` enforces the prompt; see PROJECT.md, "Agent safety").
