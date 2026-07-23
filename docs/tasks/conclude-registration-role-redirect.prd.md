## Problem Statement

The conclude-registration flow receives a hash from an email link, but the frontend cannot reliably determine whether the invited user is an agent, permissionario, or another role based only on that hash. This prevents correct post-flow routing.

## Solution

The backend must resolve the user associated with the conclude-registration hash and return role-aware routing metadata. The invite profile endpoint and the conclude-registration endpoint should both expose the user role and a backend-defined redirect target.

## User Stories

1. As a frontend application, I want to resolve a conclude-registration hash into role-aware routing metadata, so that I can route the user correctly without inferring from the URL.
2. As an agent user, I want the conclude-registration flow to identify me as an agent, so that I can be routed to the agent login experience.
3. As a permissionario user, I want the conclude-registration flow to identify me as a non-agent user, so that I can be routed to the default login experience.
4. As an admin or any other non-agent role, I want the conclude-registration flow to use the default login redirect, so that the frontend behavior remains stable.
5. As a backend maintainer, I want role resolution to come from the persisted user linked to the hash, so that the frontend does not duplicate role logic.

## Implementation Decisions

- The conclude-registration hash remains the lookup key for the invited user.
- The backend will expose `roleId` and `redirectTo` in the invite profile response.
- The backend will also expose `roleId` and `redirectTo` in the conclude-registration success response.
- Redirect rules remain simple:
  - `agentes` -> `/agentes/sign-in`
  - any other role -> `/sign-in`
- No schema changes are needed.

## Testing Decisions

- Good tests must verify observable behavior through `AuthLicenseeService` public methods.
- Tests will cover role-aware metadata returned by `getInviteProfile` and `concludeRegistration`.
- Existing `AuthLicenseeService` unit tests are the prior art for this change.

## Out of Scope

- Changing conclude-registration email templates or URL format.
- Changing password reset behavior.
- Introducing new frontend routes.
- Introducing role-specific redirects beyond the agreed two-route mapping.

## Further Notes

- This PRD is isolated under `docs/tasks/` to avoid overwriting unrelated active planning documents.
