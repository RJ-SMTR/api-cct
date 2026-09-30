---
name: task-runner
description: Execute the next planned task from the docs/TASKS.md index, one task per run. Use after task-planner when the user wants to continue implementation or says "run the next task".
---

# task-runner

Write `T<n>-CONTEXT.md` and `T<n>-summary.md` in Brazilian Portuguese; keep headings as shown.

Run one planned task through a tight loop: select, claim, build a context pack, hand off to `tdd`, record, commit, stop.

This skill orchestrates; it does not replace `tdd`, and never continues into a second task. Tasks run sequentially; there is no parallel mode.

## Plan layout

- `docs/TASKS.md` — the index. Its **Tasks** table is the only place status and run links live (edited by this skill).
- `docs/tasks/T<n>.md` — the task spec. Read-only for this skill.
- `docs/task-runs/T<n>-CONTEXT.md` and `docs/task-runs/T<n>-summary.md` — written by this skill.

## Redirect

- No `docs/TASKS.md`, or no `docs/tasks/T*.md` behind it → `task-planner`.
- Feature or refactor work without `docs/PRD.md`, or requirements still unclear → `grill-with-docs` / `to-prd`.
- Broad implementation with no task boundaries → not this skill.

## Inputs

Read only what selecting and executing the task needs: `docs/TASKS.md`, the selected `docs/tasks/T<n>.md`, the PRD acceptance criteria it serves, the `T*-summary.md` of its dependencies, and `PROJECT.md` / `CONTEXT.md` / ADRs sections that bear on it.

## Steps

### 1. Select one task

Take from the Tasks table, in order: the first `ready` task; else the first `planned` task whose dependencies are all `done`; else a `blocked` task only if its blocker is resolved. Skip `done`, `cancelled`, `in_progress`, and unresolved `blocked` tasks unless the user names one. If none qualifies, stop and report there is no runnable task.

Completion criterion: you can name the selected task id, its task file, and the acceptance criteria it serves.

### 2. Claim it

Set its **Status** to `in_progress` in the index.

Completion criterion: exactly one row is `in_progress`, and it is this task.

### 3. Build the context pack

Write `docs/task-runs/T<n>-CONTEXT.md`:

```md
# T<n> Context

## Task

## Related PRD Acceptance Criteria

## Relevant Prior Summaries

## Files Likely Affected

## Test-First Plan

## Constraints

## Risks

## Definition of Done
```

Summarize from the task file, not the whole plan; do not paste the PRD. Link the file in the row's **Context** cell.

Completion criterion: `tdd` can execute the task from this file without loading unrelated history, and the index row links it.

### 4. Hand off to `tdd`

Run `tdd` for this task only: failing test first when feasible, minimum code, relevant validation from the `PROJECT.md` validation ladder, refactor only when green, no unrelated edits.

Completion criterion: implementation and validation attempted within the task boundary.

### 5. Record the outcome

Write `docs/task-runs/T<n>-summary.md`:

```md
# T<n> Summary

## Status

## What Changed

## Files Changed

## Tests Added or Updated

## Commands Run

## Validation Result

## Decisions Made

## Follow-up Needed

## Context for Next Task
```

Every item in **Follow-up Needed** that is an accepted shortcut follows the `tech-debt` flow: ask the user once, and record only on a yes. Then update the task's index row: **Status** `done`, or `blocked` when it cannot continue (a failing validation you cannot fix in scope counts), with the reason in the summary's Status section; link the file in the **Summary** cell. Never mark `done` without validation evidence or an explicit stated limitation.

Completion criterion: the summary, the row's status, and both links match what actually happened.

### 6. Commit

Skip only when the task is `blocked` or validation is red: never commit broken code unless the user asks. Otherwise make one atomic commit for the task containing its code and its tests only. Working docs (`docs/PRD.md`, `docs/TASKS.md`, `docs/tasks/`, `docs/task-runs/`) are git-ignored and never committed. Stage paths explicitly, never `git add -A` or `git add -f`, so unrelated user changes stay out. If you changed `CONTEXT.md` or `docs/adr/` (durable docs, not ignored), leave them out of the task commit and tell the user. Write the message in English and describe the change, not the task ("Add project health check endpoint", not "Done T2"). Do not push and do not open a PR unless the user asks.

Completion criterion: `git status` shows none of this task's code or test files uncommitted, and the commit contains nothing from outside the task.

### 7. Stop

Final response: which task ran, whether it completed or blocked, and the next runnable task. Start nothing further.

## Memory updates

Update `CONTEXT.md` only for durable decisions, risks, domain rules, or discoveries; `PROJECT.md` only when stable operational knowledge changed (scripts, setup, commands, services). Never copy run summaries into either.

## Rules

- One task at a time; no unrelated task work.
- Never bypass `tdd`.
- Never edit the PRD or the task files to fit the implementation; if the spec is wrong, mark the task `blocked` and say why.
- Do not overwrite unrelated user changes or run destructive commands.
- Do not continue when scope is ambiguous.
