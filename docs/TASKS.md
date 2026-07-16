# Tasks: Agent-Specific Invite Email Template

## Planned Steps

1. Add a new Handlebars template for agent invite emails based on `new-template-email.md`.
2. Extend invite mail input to accept the user role needed for template selection.
3. Update invite send call sites to pass role information when available.
4. Select the correct template in `MailService.sendConcludeRegistration()`.
5. Add unit tests for agent and non-agent template selection.
6. Run the relevant test file and verify no regressions in the changed path.
