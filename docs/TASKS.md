## Source Context

- PRD: `docs/PRD.md`
- Project memory consulted: repository-local `AGENTS.md` instructions supplied in the task context
- Relevant modules: `src/agentes/agentes-sync.service.ts`, `src/users/users.repository.ts`
- Relevant tests: `src/agentes/agentes-sync.service.spec.ts`
- Relevant scripts: `npm test -- src/agentes/agentes-sync.service.spec.ts`

## Implementation Goal

Allow the weekly guardador sync to enrich missing basic profile data for existing agent users found by document, without changing duplicate detection or creation behavior.

## Non-Goals

- Do not create duplicate users.
- Do not overwrite non-empty profile fields already stored for an existing user.
- Do not change association-user sync behavior.
- Do not add invite resend logic for pre-existing users.

## Acceptance Criteria Mapping

| Acceptance Criterion | Task(s) | Test(s) | Status |
| --- | --- | --- | --- |
| Existing agent users with missing basic profile fields are enriched from BigQuery data | T1, T2 | service spec regression for existing user backfill | planned |
| Existing non-empty profile fields are preserved | T1, T2 | service spec regression asserting partial update payload | planned |
| Duplicate detection by document remains unchanged | T2 | existing duplicate-agent spec | planned |
| Invite behavior remains unchanged for this fix | T2 | regression spec asserting no invite creation for existing user backfill | planned |

## Task Breakdown

## T1 — Add regression coverage for existing-user backfill

Objective:
Capture the expected behavior for an existing guardador user with missing profile fields.

Affected files / areas:
`src/agentes/agentes-sync.service.spec.ts`

Test-first plan:
Add a failing spec that runs `syncWeeklyAgentUsers` with an existing agent user and asserts a partial repository update using only missing fields plus no new invite.

Implementation notes:
Reuse the existing service seam and repository mocks already used by the spec file.

Dependencies:
None.

Completion signal:
The new spec fails before production changes and clearly describes the intended backfill behavior.

## T2 — Backfill missing fields for existing agent users

Objective:
Update the sync service so existing agent users can receive missing basic profile data from BigQuery.

Affected files / areas:
`src/agentes/agentes-sync.service.ts`

Test-first plan:
Make the new regression pass without breaking the existing creation and duplicate specs.

Implementation notes:
Build a minimal partial update payload for missing fields only and persist it through the existing `UsersRepository.update` path.

Dependencies:
T1.

Completion signal:
Targeted agent sync specs pass and the service updates only missing fields for existing users.

## Test Strategy

- Unit/integration-style service specs in `src/agentes/agentes-sync.service.spec.ts`
- Regression scenario for existing user backfill with partial missing data
- Existing duplicate and creation scenarios must keep passing
- Command to run:
`npm test -- src/agentes/agentes-sync.service.spec.ts`

## Risk Plan

- Risk: overwriting valid existing profile data
Mitigation: only include null/blank fields in the update payload and assert this in tests.
- Risk: adding fake email data to existing users
Mitigation: use only normalized real BigQuery email for backfill; keep synthetic email generation restricted to creation flow.
- Risk: persisting malformed phone values
Mitigation: reuse the existing phone normalization before adding `phone` to the backfill payload and cover it in the regression scenario.
- Risk: unintended invite side effects
Mitigation: do not add invite creation logic to the existing-user branch and cover that expectation in the regression test.

## Execution Order

1. Add the failing regression spec for existing-user backfill.
2. Implement minimal service changes to compute and persist missing-field updates.
3. Run the targeted spec file and confirm existing scenarios still pass.

## Open Questions

No blocking open questions.

## Handoff to tdd

Ready for tdd. Start with T1 and write the failing test described in the test-first plan.
