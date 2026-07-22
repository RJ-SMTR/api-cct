## Source Context

- PRD: `docs/tasks/reset-password-login-redirect.prd.md`
- Project memory consulted: repository-local `AGENTS.md` instructions provided in session context
- Relevant modules: `src/auth/auth.service.ts`, `src/auth/auth.controller.ts`, `src/forgot/forgot.service.ts`, `src/forgot/entities/forgot.entity.ts`, `src/roles/roles.enum.ts`
- Relevant tests: `src/auth/auth.service.spec.ts`

## Implementation Goal

Make the password reset endpoint return the correct post-reset login route based on the role of the user associated with the reset hash, while preserving the existing password update and forgot-record invalidation behavior.

## Non-Goals

- Do not change hash generation or forgot-password email behavior.
- Do not add new endpoints.
- Do not change frontend route naming.
- Do not introduce role-specific logic for roles other than `agentes`; all non-agent roles continue to use `/sign-in`.

## Acceptance Criteria Mapping

| Acceptance Criterion | Task(s) | Test(s) | Status |
| --- | --- | --- | --- |
| AC-1 Agent reset returns `/agentes/sign-in` | T1, T2 | `AuthService` unit | planned |
| AC-2 Non-agent reset returns `/sign-in` | T1, T2 | `AuthService` unit | planned |
| AC-3 Successful reset still updates password and invalidates forgot record | T1, T2 | `AuthService` unit | planned |
| AC-4 Invalid hash behavior remains unchanged | T2 | existing auth behavior | planned |
| AC-5 Public controller contract exposes the response body | T2 | manual/type-level validation | planned |

## Task Breakdown

## T1 — Add reset-password regression tests

Objective:

Add service-level tests that describe the role-based redirect behavior after a successful password reset.

Affected files / areas:

`src/auth/auth.service.spec.ts`

Test-first plan:

Add one failing test for an `agentes` user returning `/agentes/sign-in` and one failing test for a non-agent user returning `/sign-in`.

Implementation notes:

Reuse the existing `ForgotService` and `User` test seams. Assert the returned payload and the side effects on the forgot record.

Dependencies:

None.

Completion signal:

The new tests fail before production code changes and pass after the implementation.

## T2 — Return redirect metadata from reset-password

Objective:

Update the auth service and controller contract so successful password resets return `redirectTo` derived from the user role linked to the hash.

Affected files / areas:

`src/auth/auth.service.ts`, `src/auth/auth.controller.ts`, optional auth response type definition

Test-first plan:

Use the failing T1 tests to drive the change and keep invalid-hash behavior untouched.

Implementation notes:

Keep the role mapping local and explicit. Preserve the existing password save and forgot soft-delete behavior.

Dependencies:

T1.

Completion signal:

`resetPassword` returns the expected route for both agent and non-agent users and existing error behavior remains intact.

## Test Strategy

- Unit tests:
  - `AuthService` tests for agent and non-agent redirects after successful password reset.
- Integration tests:
  - Not required for this narrow change if the service-level contract is covered.
- Regression cases:
  - Successful reset for `agentes`
  - Successful reset for non-agent roles
  - Forgot record soft delete still happens
  - Invalid hash still throws unauthorized
- Expected commands:
  - `npm test -- auth.service.spec.ts`

## Risk Plan

- API contract regression:
  - Mitigation: update the controller return contract alongside the service.
- Frontend/backend mismatch on route shape:
  - Mitigation: return relative routes exactly as agreed: `/sign-in` and `/agentes/sign-in`.
- Behavior drift for invalid hashes:
  - Mitigation: avoid changing the unauthorized branch.

## Execution Order

1. T1: add the service regression tests.
2. T2: update service and controller contracts to satisfy the tests.
3. Run the targeted auth service tests.

## Open Questions

No blocking open questions.

## Handoff to tdd

Ready for tdd. Start with T1 and write the failing reset-password tests for agent and non-agent redirects.
