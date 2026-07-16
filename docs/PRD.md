# PRD: Agent-Specific Invite Email Template

## Summary

When the daily invite cron sends first-access emails, users with `role = agents` must receive a different email body from the default invite. The activation link format must remain unchanged.

## Scope

- Add a dedicated invite email template for agent users.
- Keep the existing invite link format: `conclude-registration/{{hash}}`.
- Keep the current default invite template for all non-agent users.

## Out of Scope

- Changing cron schedule or invite queue logic.
- Changing user creation or sync rules.
- Adding attachments or changing support endpoints.
- Changing invite status handling.

## User Story

As an `agents` user created by the sync flow, I want to receive an invite email with agent-specific copy so the onboarding message matches my role.

## Acceptance Criteria

1. When `bulkSendInvites` sends an invite for a user whose role is `agents`, the email uses a dedicated agent template.
2. When `bulkSendInvites` sends an invite for any other role, the current default template remains in use.
3. The invite link used in the agent template matches the current activation link behavior.
4. Existing invite success and failure handling remains unchanged.
5. Automated tests cover template selection.

## Validation

- Unit test the mail service template selection for agent and non-agent roles.
- Run the relevant Jest test file locally.
