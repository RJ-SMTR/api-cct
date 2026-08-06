# Invite Access Status Bug Fix

## Source Context

- Project memory consulted: none found (`PROJECT.md`, `CONTEXT.md`, `docs/PRD.md` absent in `api-cct`)
- Relevant modules:
  - `src/auth-licensee/auth-licensee.service.ts`
  - `src/auth/auth.service.ts`
  - `src/mail/mail.service.ts`
  - `src/mail-history/pipes/mail-history-validation.pipe.ts`
- Relevant tests:
  - `src/auth-licensee/auth-licensee.service.spec.ts`
  - `src/auth/auth.service.spec.ts`
  - `src/mail/mail.service.spec.ts`

## Implementation Goal

Adjust the backend-only invite flow so clicking the first-access link marks the invite as `used`, the registration flow still works after that click, and resend flows never regress `used` back to `sent`.

## Non-Goals

- No database migration
- No new invite status
- No new columns such as `accessedAt`
- No frontend changes
- No cleanup of historical data beyond runtime self-healing where touched by the updated flow

## Acceptance Criteria Mapping

| Acceptance Criterion | Task(s) | Test(s) | Status |
| --- | --- | --- | --- |
| Clicking `POST /auth/licensee/invite/:hash` marks a pending invite as `used` | T1 | `AuthLicenseeService` regression test | planned |
| Registration still succeeds after the invite was marked `used` by link access, as long as the user is not active yet | T1 | `AuthLicenseeService` regression test | planned |
| Completed accounts must not reopen invite flow even if their invite was previously `sent` | T1 | `AuthLicenseeService` regression test | planned |
| Resend flows must not downgrade `used` back to `sent` | T2 | `AuthService` regression test | planned |
| Reminder email link must be chosen from user completion state, not only invite status | T3 | `MailService` regression test | planned |

## Task Breakdown

## T1 — Reframe `used` as accessed-invite in auth-licensee flow

Objective:
Make invite access mark the invite as `used`, while still allowing registration when the linked user is not active yet.

Affected files / areas:
- `src/auth-licensee/auth-licensee.service.ts`
- `src/mail-history/pipes/mail-history-validation.pipe.ts`
- `src/auth-licensee/auth-licensee.service.spec.ts`

Test-first plan:
- Add a failing test proving `getInviteProfile()` updates `sent -> used`.
- Add a failing test proving `concludeRegistration()` accepts `used` for a non-active user.
- Add a failing test proving an already active user is treated as already used even if the invite status was stale.

Implementation notes:
- Distinguish "invite already consumed by a completed account" from "invite already accessed but registration still pending" using `user.status.id`.
- Keep `used` as the persisted state after first click and after registration.

Dependencies:
- None.

Completion signal:
- Tests pass and the auth-licensee flow no longer depends on `sent` as the only valid pre-registration state.

## T2 — Prevent resend from regressing invite status

Objective:
Ensure resend operations preserve `used` instead of rewriting it to `sent`.

Affected files / areas:
- `src/auth/auth.service.ts`
- `src/auth/auth.service.spec.ts`

Test-first plan:
- Add a failing test proving `resendRegisterMail()` keeps `used` when resending a previously accessed invite.

Implementation notes:
- Only transition `queued -> sent`.
- Preserve `sent` and `used` on resend while still updating `sentAt`.

Dependencies:
- T1 not required.

Completion signal:
- Resend tests pass and no code path rewrites `used` back to `sent`.

## T3 — Make reminder link depend on account completion

Objective:
Ensure reminder email links send completed users to sign-in and incomplete users to conclude-registration, even when both share `used`.

Affected files / areas:
- `src/mail/mail.service.ts`
- `src/mail/mail.service.spec.ts`

Test-first plan:
- Add a failing test proving `reSendEmailBank()` uses conclude-registration for a `used` invite whose linked user is not active.

Implementation notes:
- Resolve the invite by `hash` inside the mail service and inspect `invite.user.status.id`.
- Fall back conservatively when the invite cannot be loaded.

Dependencies:
- None.

Completion signal:
- Reminder link generation is based on user completion state, not only on invite status id.

## Test Strategy

- Unit/service regression tests:
  - `npm test -- auth-licensee.service.spec.ts`
  - `npm test -- auth.service.spec.ts`
  - `npm test -- mail.service.spec.ts`
- Broader validation if targeted tests pass:
  - `npm test -- auth-licensee`
  - `npm test -- auth.service`

## Risk Plan

- Risk: active users may still receive conclude-registration links from untouched paths.
  - Mitigation: centralize resend link choice in `MailService` and preserve status in `AuthService`.
- Risk: changing pipe/service acceptance may reopen already-completed invites.
  - Mitigation: gate by `user.status.id === StatusEnum.active`.
- Risk: cron resend behavior could diverge from manual resend.
  - Mitigation: make the link decision inside `MailService.reSendEmailBank()` using the invite hash.

## Execution Order

1. T1 auth-licensee tests and implementation
2. T2 resend regression test and implementation
3. T3 mail reminder regression test and implementation
4. Run targeted test suite

## Open Questions

No blocking open questions.

## Handoff to tdd

Ready for tdd. Start with T1 and write the failing auth-licensee regression tests.
