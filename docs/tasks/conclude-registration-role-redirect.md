## Source Context

- PRD: `docs/tasks/conclude-registration-role-redirect.prd.md`
- Project memory consulted: repository-local `AGENTS.md` instructions provided in session context
- Relevant modules: `src/auth-licensee/auth-licensee.service.ts`, `src/auth-licensee/auth-licensee.controller.ts`, `src/auth-licensee/interfaces/al-invite-profile.interface.ts`, `src/auth-licensee/interfaces/al-conclude-registration.interface.ts`
- Relevant tests: `src/auth-licensee/auth-licensee.service.spec.ts`

## Implementation Goal

Return role-aware metadata from the conclude-registration hash flow so the frontend can route users correctly using backend-provided information instead of local inference.

## Non-Goals

- Do not change hash generation or invite lookup rules.
- Do not add new endpoints.
- Do not change existing route names.
- Do not create special redirect logic for non-agent roles; all non-agent roles share `/sign-in`.

## Acceptance Criteria Mapping

| Acceptance Criterion | Task(s) | Test(s) | Status |
| --- | --- | --- | --- |
| AC-1 Invite profile returns role metadata for agent users | T1, T2 | `AuthLicenseeService` unit | planned |
| AC-2 Invite profile returns default login redirect for non-agent users | T1, T2 | `AuthLicenseeService` unit | planned |
| AC-3 Conclude registration returns role metadata after success | T1, T2 | `AuthLicenseeService` unit | planned |
| AC-4 Existing invite status validation remains unchanged | T2 | existing auth-licensee behavior | planned |

## Task Breakdown

## T1 — Add auth-licensee regression tests

Objective:

Describe the expected role-aware metadata returned by the hash-based invite flow.

Affected files / areas:

`src/auth-licensee/auth-licensee.service.spec.ts`

Test-first plan:

Add one test for `getInviteProfile` returning `roleId` and `redirectTo`, and one test for `concludeRegistration` returning the same metadata after success.

Implementation notes:

Reuse the existing mocked `MailHistoryService`, `UsersService`, and JWT seams.

Dependencies:

None.

Completion signal:

The new tests fail before production code changes and pass after implementation.

## T2 — Return role-aware routing metadata from auth-licensee

Objective:

Update the auth-licensee service and response contracts so hash resolution and conclude-registration both expose role-aware routing metadata.

Affected files / areas:

`src/auth-licensee/auth-licensee.service.ts`, `src/auth-licensee/interfaces/al-invite-profile.interface.ts`, `src/auth-licensee/interfaces/al-conclude-registration.interface.ts`, optional controller typing

Test-first plan:

Use the failing T1 tests to drive the change while preserving current error behavior.

Implementation notes:

Keep the redirect mapping centralized in the service and reuse it for both responses.

Dependencies:

T1.

Completion signal:

Both public methods return `roleId` and `redirectTo` with the agreed mapping.

## Test Strategy

- Unit tests:
  - `AuthLicenseeService` role-aware invite profile response
  - `AuthLicenseeService` role-aware conclude-registration response
- Integration tests:
  - Not required for this narrow change if service-level behavior is covered.
- Expected commands:
  - `npx jest auth-licensee.service.spec.ts --runInBand <local-config>`

## Risk Plan

- API contract regression:
  - Mitigation: keep additions backward-compatible and additive.
- Frontend/backend routing mismatch:
  - Mitigation: return redirect strings directly from the backend.

## Execution Order

1. T1: add the new service tests.
2. T2: update interfaces and service.
3. Run the targeted auth-licensee service tests.

## Open Questions

No blocking open questions.

## Handoff to tdd

Ready for tdd. Start with T1 and write the failing auth-licensee tests for role-aware hash responses.
