---
name: task-planner
description: Turn docs/PRD.md into an implementation plan — an index at docs/TASKS.md plus one file per task in docs/tasks/. Use after to-prd and before tdd when a feature, refactor, or substantial bug fix needs task breakdown.
---

# task-planner

Transform the PRD into a plan that is specific to this repository, split into small tasks, and traceable to acceptance criteria. Every task is a contract: current behavior, desired behavior, constraints, and a command that proves it is done.

The plan is an **index plus task files**:

- `docs/TASKS.md` — the index. Routes to every task and is the only place that tracks progress.
- `docs/tasks/T<n>.md` — one spec per task, written once by this skill.
- `docs/task-runs/T<n>-CONTEXT.md` and `docs/task-runs/T<n>-summary.md` — written later by `task-runner`, never by this skill. The index links to them once they exist.

Do not implement code, rewrite the PRD (unless a blocking gap exists), or invent requirements absent from the PRD or `CONTEXT.md`. Write the plan in Brazilian Portuguese; keep headings and code identifiers as shown here.

## Inputs

Read in order, when they exist: `PROJECT.md`, `CONTEXT.md`, `docs/PRD.md`, `docs/adr/`, then the specs and scripts relevant to the change.

`docs/PRD.md` is mandatory for feature and refactor work. If it is missing or insufficient, stop and send the user back to `to-prd` or `grill-with-docs`. An urgent narrow bug fix may skip it only with the user's explicit approval; the plan must then still name the failing behavior, expected behavior, affected area, and regression test.

Inspect the code before naming files. Layers live in `src/controller`, `src/service`, `src/repository`, `src/domain`; do not guess paths.

## Steps

### 1. Write the task files

Break the work into small, reversible tasks, each implementable and validatable on its own. Never merge unrelated acceptance criteria into one task. Plan no broad rewrites unless the PRD requires them. Keep each task small enough for one reviewable diff.

Create one `docs/tasks/T<n>.md` per task (ids sequential: `T1`, `T2`, …):

```md
# T<n> — <task title>

## Objective

## Acceptance Criteria Served

## Current Behavior
What the code does today in the affected area. Cite the file or function you read.

## Desired Behavior

## Constraints
Things that must not change: public API shape, migrations already applied, payment/CNAB formats, performance.

## Affected Files / Areas

## Test-First Plan
Behaviors to test, at which seam, and which existing spec is the prior art.

## Edge Cases

## Dependencies

## Validation Command
The exact commands from the PROJECT.md validation ladder that prove this task is done, e.g. `npx jest src/service/x.service.spec.ts`.

## Completion Signal
Checkable statement, e.g. "the new spec passes and `npx tsc --noEmit` is clean".
```

Task files carry no status. They must be self-contained: `task-runner` builds a context pack from one task file plus `PROJECT.md`, not from the whole plan.

Test-first plans prefer integration-style tests where behavior crosses API, database, SFTP, BigQuery, mail or queue boundaries, and unit tests for pure logic. Where tests are infeasible, state why and name the safest validation alternative.

Completion criterion: every PRD acceptance criterion is served by at least one task file, or is explicitly marked documentation-only, already satisfied, or blocked; every task file has a test-first plan, a validation command and a checkable completion signal.

### 2. Write the index

Create or update `docs/TASKS.md`:

```md
# Tasks

## Source Context
PRD path, ADRs, CONTEXT.md sections, relevant modules/tests/scripts.

## Implementation Goal
One short paragraph derived from the PRD. No new scope.

## Non-Goals
What must not be implemented.

## Tasks

| Task | Title | Depends on | Status | Context | Summary |
| --- | --- | --- | --- | --- | --- |
| [T1](tasks/T1.md) | … | — | planned | — | — |

## Acceptance Criteria Mapping

| Acceptance Criterion | Task(s) | Test(s) | Status |
| --- | --- | --- | --- |
| AC-1 | T1, T2 | unit/integration/e2e | planned |

## Test Strategy
Unit, integration, e2e/manual, regression, PRD edge cases, commands to run.

## Risk Plan
Risks and mitigations: data loss, payment amounts, CNAB formats, public API, security, concurrency (cron jobs), migrations, flaky tests.

## Execution Order
Recommended `task-runner` order that keeps the project working after each step.

## Open Questions
Only blocking or materially relevant ones, otherwise: `Nenhuma pergunta bloqueante.`

## Handoff
Ready for `task-runner`. Start with T1.
```

The **Tasks** table is the routing surface and the progress ledger:

- Statuses: `planned`, `ready`, `in_progress`, `blocked`, `done`, `cancelled`. A new task starts `planned`, or `ready` when it has no dependencies.
- The **Context** and **Summary** cells hold `—` until `task-runner` links `task-runs/T<n>-CONTEXT.md` and `task-runs/T<n>-summary.md` there.
- `task-runner` updates status in this table. Task files are never edited to record progress.

Completion criterion: every file in `docs/tasks/` appears in the table, every table row links to an existing task file, and every section above is present.

## Rules

- No production-code edits, no silent scope expansion.
- One task = one file; never re-inline task bodies into `TASKS.md`.
- Re-planning an existing plan: update task files and rows in place, and leave `done` tasks untouched.
- Do not proceed to implementation while the plan has blocking open questions.
