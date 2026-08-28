## Source Context

- PRD: `docs/tasks/users-update-duplicate-email.prd.md`
- Project memory consulted: repository-local `AGENTS.md` instructions provided in session context
- Relevant modules: `src/users/users.repository.ts`, `src/utils/validation-utils.ts`, `src/users/dto/update-user-repository.dto.ts`
- Relevant tests: `test/admin/users.e2e-spec.ts`

## Implementation Goal

Make `PATCH /users/:id` return a clear duplicate-email validation message when the submitted email already belongs to another user, without changing the existing HTTP status code or broadening the change to other endpoints.

## Non-Goals

- Do not change user creation validation behavior.
- Do not return the conflicting user's data.
- Do not redesign the global validation envelope for unrelated DTO errors.

## Acceptance Criteria Mapping

| Acceptance Criterion | Task(s) | Test(s) | Status |
| --- | --- | --- | --- |
| AC-1 `PATCH /users/:id` returns `422` when the email belongs to another user | T1, T2 | admin users e2e | planned |
| AC-2 The duplicate-email response message is explicit instead of the generic DTO-validation message | T1, T2 | admin users e2e | planned |
| AC-3 Other update validation behavior remains unchanged | T2 | existing admin users e2e | planned |

## Task Breakdown

## T1 — Add duplicate-email regression coverage

Objective:

Add a regression test on the admin users HTTP flow proving that updating a user with another user's email returns the explicit duplicate-email validation message.

Affected files / areas:

`test/admin/users.e2e-spec.ts`

Test-first plan:

Add one failing test that updates a user with an already-used email and asserts `422` plus the expected validation message.

Implementation notes:

Reuse existing authenticated admin setup and existing seeded users from the test environment.

Dependencies:

None.

Completion signal:

The new test fails before the production change and passes after it.

## T2 — Standardize duplicate-email response in user update flow

Objective:

Adjust the user update validation path so duplicate-email failures return the explicit message while preserving the existing `422` envelope.

Affected files / areas:

`src/users/users.repository.ts`, optionally `src/utils/validation-utils.ts` if a minimal helper extension is needed

Test-first plan:

Use the T1 e2e test to drive the implementation and confirm existing user update validations still pass.

Implementation notes:

Keep the change localized to the update flow. Prefer intercepting and reshaping only the duplicate-email case rather than changing unrelated validators globally.

Dependencies:

T1.

Completion signal:

The update route returns the explicit duplicate-email message and the relevant users e2e tests pass.

## Test Strategy

- Regression coverage:
  - `test/admin/users.e2e-spec.ts` should verify the duplicate-email response for `PATCH /users/:id`.
- Existing coverage to keep green:
  - Current admin users patch validation tests should continue passing.
- Expected command:
  - `npm test -- test/admin/users.e2e-spec.ts`

## Risk Plan

- Over-broad validation changes:
  - Mitigation: scope the response rewrite to the user update flow only.
- Contract mismatch with current clients:
  - Mitigation: preserve status code and `emailAlreadyExists` key, only replace the generic message.
- Flaky e2e setup:
  - Mitigation: reuse existing seeded users and auth flow already exercised by the file.

## Execution Order

1. T1: add the failing e2e regression.
2. T2: implement the localized response standardization.
3. Run the targeted admin users e2e test file.

## Open Questions

No blocking open questions.

## Handoff to tdd

Ready for tdd. Start with T1 and write the failing duplicate-email e2e test for `PATCH /users/:id`.
