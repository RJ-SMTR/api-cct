# Tasks: Weekly Agent User Sync From BigQuery

## Task 1: Document feature decisions

- Write PRD for weekly sync, dedup rules, creation defaults, and email behavior.
- Record the reusable project memory for agent sync assumptions.

Completion signal:
- `docs/PRD.md` exists and reflects the accepted scope.

## Task 2: Add agent sync domain types and data-fetch abstraction

- Create a typed interface for BigQuery agent rows.
- Add an agent sync repository/service path that fetches rows from BigQuery.
- Keep the initial query implementation safe for local development while preserving the final data shape contract.

Completion signal:
- Sync logic can consume typed source rows without depending on controller input.

## Task 3: Implement sync orchestration

- Add a service that:
  - normalizes person and association documents;
  - creates missing association users for new CNPJs;
  - creates missing person users for new documents;
  - queues invite records for newly created person users with email;
  - skips updates for existing users.
- Use `role = agents` and `status = register`.

Completion signal:
- One method performs the full weekly synchronization safely and idempotently.

## Task 4: Wire cron scheduling

- Register the new weekly cron job in `CronJobsService`.
- Schedule it for Friday 13:00 UTC, equivalent to Friday 10:00 BRT.
- Add focused logging around job start and result counts.

Completion signal:
- Cron config includes the new weekly job and calls the sync service.

## Task 5: Validate current invite flow for agents

- Confirm that newly queued invite rows continue to be processed by the existing mail cron.
- Avoid template branching unless code inspection reveals a real divergence.

Completion signal:
- Agent sync uses the existing invite queue flow without duplicating mail logic.

## Task 6: Add focused tests and build validation

- Add unit coverage for:
  - creating new agent person users;
  - creating new association users;
  - skipping duplicates;
  - queueing invites only for newly created person users with email.
- Run build validation.

Completion signal:
- Tests for the new sync service pass and project build succeeds.
