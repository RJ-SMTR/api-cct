# PROJECT

NestJS REST API behind the CCT app ([app-cct](https://github.com/RJ-SMTR/app-cct)). Based on [nestjs-boilerplate](https://github.com/brocoders/nestjs-boilerplate/). Business docs are in Portuguese.

## Stack

- NestJS 9, TypeScript 5.1, TypeORM 0.3, PostgreSQL 15
- Jest 29 (`ts-jest`, `diagnostics: false`), supertest for e2e
- Node 18.16.0, pinned in `.nvmrc`, `engines` (`>=18.16.0`), the Dockerfiles and the workflows. Use `nvm use`.
- External services: SFTP (bank CNAB files), BigQuery (`src/bigquery`), SMTP mail, S3 (optional file driver), Google/Apple/Facebook/Twitter auth
- Branches and deploy: `main` is the main branch and deploys prod on push (`cd.yaml`); `homol` is the secondary branch; `hmg`, `release/*` and `devops` deploy staging (`cd_stag.yaml`).

## Setup

```bash
cp env-example .env          # env-example is the .env template; set DATABASE_HOST=localhost and MAIL_HOST=localhost for local dev
docker compose up -d postgres adminer maildev sftp
npm install
```

Then load the seed data in `local_dev_example/sql/` (`carga_settings.sql`, `carga_users.sql`, `carga_pagador.sql`) and run `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` once. Full walkthrough in [README.md](README.md).

## Commands

| Goal | Command |
| --- | --- |
| Dev server (Swagger at `/docs`) | `npm run start:dev` |
| Build | `npm run build` |
| Unit tests | `npm test` (specs are `src/**/*.spec.ts`) |
| One spec | `npx jest src/users/users.repository.spec.ts` |
| E2E tests | `npm run test:e2e` (needs Postgres and maildev; CI runs `docker-compose.ci.yaml`) |
| Format | `npx prettier --write <files>` |
| Lint, check only | `npx eslint <files>` |
| Type check (production build) | `npx tsc --noEmit -p tsconfig.build.json` |
| Gate: build + jest + eslint vs. baseline | `npm run validate` (~40 s) |
| Update the baseline (explicit) | `npm run validate:update-baseline` |

Commands above were executed while writing this file, except `npm run test:e2e` (needs Postgres and maildev), the dev server and the migration scripts.

## Validation ladder

Run the cheapest check first and stop at the first failure.

1. `npx prettier --check <changed files>` (informational: many files already diverge, see TD-3)
2. `npx eslint <changed files>`
3. `npx tsc --noEmit -p tsconfig.build.json`
4. `npx jest <spec for the changed file>`
5. `npm run validate` (same gate as CI)
6. `npm run test:e2e` when an endpoint, auth or DB behavior changed

## Ratchet gate and baseline

The test suite and lint are not clean yet (see [docs/TECH-DEBT.md](docs/TECH-DEBT.md), TD-1 and TD-2), so the gate only blocks things that get **worse**. `scripts/validate/baseline.json` records which jest suites pass and how many eslint errors each file has. `npm run validate` fails if the production build breaks, a baseline-passing suite fails or disappears, or a file gains eslint errors. It never rewrites the baseline.

- CI: `.github/workflows/validate.yaml` runs it on PRs to `main`, `homol` and `hmg` (Node 18.16.0, docs-only PRs skipped).
- Local: the husky `pre-commit` hook runs the build check and `jest --findRelatedTests` on staged `.ts` files. Emergency bypass: `git commit --no-verify`, then record why in `docs/TECH-DEBT.md`.
- After fixing suites or lint, or adding a passing spec, run `npm run validate:update-baseline` and commit the new baseline. Relaxing it is technical debt: record it.
- The gate is per suite: skipping a single test inside a passing suite is not detected (see TD-7).

## Testing

Policy (decided by Matthew, 2026-09-30): **new or changed business logic gets a spec next to it**, written test-first with the `tdd` skill, pure logic first. It never applies to SFTP or cron jobs (TD-6, discarded).

- Put the spec next to the file (`*.spec.ts`). In Nest, mock only the boundaries (database, SFTP, BigQuery, mail, clock); follow an existing spec of the same area, for example `src/users/users.repository.spec.ts` or `src/cnab/novo-remessa/service/retorno.service.spec.ts`.
- **Lock it in:** a new passing spec is *not* protected until it is in the baseline. The gate only checks suites listed there, so a new spec can break later without `validate` failing (verified 2026-09-30). After adding a passing spec, run `npm run validate:update-baseline` and commit the baseline.
- For payment code, aim at the `src/cnab/novo-remessa/` services; see `src/cron-jobs/CLAUDE.md` and `src/cnab/CLAUDE.md` for what never to call from a test.
- Current state (2026-09-30): 42 app spec files, of which 25 pass, 13 fail (TD-1) and 4 are skipped; plus 4 specs of the gate itself. Passing coverage includes agentes, antifraud, mail, the novo-remessa reports and `retorno.service`; there is no working test for `cron-jobs.service`, the SFTP client, bank statements or ticket revenues. `validate` green does not mean a change is safe.
- E2E (`npm run test:e2e`) needs Postgres and maildev and runs in CI (`docker-e2e.yml`) on pushes and PRs to `main`; it was not exercised while preparing this repo.

## Layer rules

Imports go one way: controller → service → repository. The repo is organized by feature, so the rules follow the **file role suffix**, not folders. ESLint enforces them (`no-restricted-imports` overrides in `.eslintrc.js`, specs are exempt):

| File | Must not import |
| --- | --- |
| `*.controller.ts` | `*.repository` |
| `*.service.ts` | `*.controller` |
| `*.repository.ts` | `*.controller`, `*.service` |
| `src/utils/**` | `*.controller`, `*.service`, `*.repository` |

- See violations with `npx eslint <files>`. They are eslint errors, so `npm run validate` fails on any new one.
- `repository → service` still has 12 imports in 9 files (measured 2026-09-30); they are in the baseline and can only go down. Cleaning them up is tracked as TD-8 (open, low priority); do not add new ones.
- Not enforced: direct database access outside repositories and feature-to-feature imports.
- Tests for the rules: `scripts/validate/boundaries.spec.ts`. Reasoning: `CONTEXT.md`.

## Structure

`src/` is organized by feature; each feature folder usually has its own `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.repository.ts` and specs.

| Path | Holds |
| --- | --- |
| `cnab/` | CNAB 240 layouts and helpers, and `novo-remessa/` (orders, grouping, remessa, retorno) — the payment pipeline |
| `cron-jobs/` | Job schedules and the manual remessa triggers |
| `bigquery/` | BigQuery access and order sync |
| `sftp/` | SFTP client for remessa/retorno/extrato files |
| `users/`, `roles/`, `statuses/`, `auth*`, `social/`, `forgot/` | Users, roles, authentication |
| `mail/`, `mail-history/`, `mail-history-statuses/`, `mail-count/` | Email and invites |
| `lancamento/`, `bank-statements/`, `ticket-revenues/`, `transacao-view/`, `pagamento_indevido/`, `pendentes/` | Financial features |
| `agentes/`, `antifraud/` | Agent sync and fraud alerts |
| `relatorio/` | Reports |
| `settings/`, `setting-types/`, `config/`, `database/` | Typed config, settings stored in the database, data source, migrations, seeds |
| `utils/`, `i18n/`, `files/`, `home/`, `info/`, `banks/`, `test/` | Shared helpers, translations, misc |
| `test/` (root) | e2e specs (`*.e2e-spec.ts`) and `jest-e2e.json` |
| `scripts/validate/` | The validation gate, its baseline and their specs |
| `.hygen/` | Generators (`npm run seed:create`) |
| `docs/` | Business docs (bilhetagem, lancamento, cronjobs, NovoRemessa) and NestJS notes; index in `docs/README.md` |

## Conventions

- Code names follow the existing Portuguese domain vocabulary (`ordem-pagamento`, `remessa`, `favorecido`, `lancamento`). Do not translate them.
- Files: `kebab-case`, suffix by role (`.service.ts`, `.repository.ts`, `.controller.ts`, `.module.ts`).
- Prettier: single quotes, trailing commas. ESLint: `no-floating-promises` and `require-await` are errors.
- Tests are named `*.spec.ts` and live next to the source. `test/global-setup.ts` forces `TZ=UTC`.

## Gotchas

- `npm run lint` uses `--fix` and rewrites files. To only check, use `npx eslint <files>`.
- `tsconfig.json` includes specs, so `tsc -p tsconfig.json` shows errors that the build does not (TD-5). The gate uses `tsconfig.build.json`, which also excludes `scripts/`.
- Jest runs with `diagnostics: false`: type errors in specs do not fail a suite.
- `DATABASE_SYNCHRONIZE` must stay `false` outside throwaway local databases.
- **Payment is triggered by hand** (TD-9): on payday someone temporarily adds a `remessa*Exec()` call to `onModuleLoad` in `src/cron-jobs/cron-jobs.service.ts` and deploys. By default `onModuleLoad` calls none (the `remessaModalExec(true)` line that ran on every boot was removed on 2026-09-30), but a branch or deploy that still has it will generate a remessa when the app boots.
- `npm install` runs `husky install`, which sets `core.hooksPath=.husky` in the shared git config, so the hook applies to every worktree of the repo. `npm ci` may also rewrite `yarn.lock`; do not commit that.

## Agent safety

`.claude/settings.json` (shared) limits what an AI agent can do here:

- **Denied:** reading `.env*` and `env-deploy*` with the file tool, `git push --force`/`-f`, `git reset --hard`, `rm -rf`, `git commit --no-verify`.
- **Asks first:** `git push`, `npm run migration:*`, `npm run seed:run`, `npm run schema:drop`, `psql`, `docker compose down`.
- **Runs freely:** `npm run validate`, `npx jest`, `npx eslint`, `npx tsc`.
- Personal changes go in `.claude/settings.local.json` (git-ignored).
- Limit: the file-read deny does not stop shell commands such as `cat` or `grep` on those files, so it is a guardrail and not a sandbox. Do not keep real secrets in the working tree.

## Docs

- Decisions: `docs/adr/` (created on the first ADR)
- Technical debt register: [docs/TECH-DEBT.md](docs/TECH-DEBT.md)
- Working artifacts per task (git-ignored, never committed): `docs/PRD.md`, `docs/TASKS.md`, `docs/tasks/T<n>.md`, `docs/task-runs/`, `docs/archive/`
- Domain memory: `CONTEXT.md` (glossary and business rules, in Portuguese)
- Team guide to working with AI here: [docs/COMO-TRABALHAR-COM-IA.md](docs/COMO-TRABALHAR-COM-IA.md); index of everything in `docs/` and what to read per task: [docs/README.md](docs/README.md); payment flow with files and methods: [docs/fluxo-pagamento.md](docs/fluxo-pagamento.md)
