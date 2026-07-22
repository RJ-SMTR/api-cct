## Problem Statement

After a user resets a password through a hash-based reset link, the frontend always redirects to the generic permissionario login screen. This breaks the agent flow because agent users must be sent to the dedicated agent login route.

## Solution

The password reset endpoint must resolve the user associated with the reset hash and return the correct post-reset login route. Agent users must receive `/agentes/sign-in`. All other users must receive `/sign-in`.

## User Stories

1. As an agent user, I want to be redirected to the agent login screen after resetting my password, so that I can continue authentication through the correct flow.
2. As a permissionario user, I want to be redirected to the default login screen after resetting my password, so that I return to the standard authentication flow.
3. As a frontend application, I want the reset-password API response to include the correct redirect route, so that I do not need to infer user type from the URL or hash.
4. As a backend maintainer, I want the redirect route to be derived from the user attached to the reset hash, so that the decision uses persisted server-side data instead of frontend assumptions.
5. As a backend maintainer, I want every non-agent role to fall back to `/sign-in`, so that the contract stays simple and stable.

## Implementation Decisions

- The existing reset-password hash remains the source of truth for identifying the user completing the flow.
- The password reset service will keep validating the hash, updating the password, and invalidating the forgot record after success.
- The password reset service will additionally return a small response payload with `redirectTo`.
- The redirect decision is role-based:
  - `agentes` -> `/agentes/sign-in`
  - any other role -> `/sign-in`
- The public API contract for the reset-password endpoint changes from empty response to success response with redirect metadata.
- No schema changes are needed.

## Testing Decisions

- Good tests must verify observable behavior through the `AuthService` public method, not private helpers.
- The auth service test should verify that an agent reset returns `/agentes/sign-in` and a non-agent reset returns `/sign-in`.
- The same tests should also verify that the password is updated and the forgot record is invalidated after success.
- Existing `AuthService` unit tests are the prior art for this change.

## Out of Scope

- Changing how reset hashes are generated.
- Changing the email template or reset link format.
- Introducing separate reset endpoints for agents and permissionarios.
- Returning full frontend URLs instead of relative routes.

## Further Notes

- The repository currently has an unrelated active `docs/PRD.md`; this PRD is isolated to avoid overwriting that work.
