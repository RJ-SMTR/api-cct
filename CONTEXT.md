# Context

## Agent weekly sync

- Agent onboarding will be fed by a weekly BigQuery import job.
- Source rows represent:
  - one person user identified by `documento`;
  - one association identified by `cnpj`.
- Both the person and the association should exist as rows in the `user` table.
- Deduplication is by normalized numeric document only:
  - person by `documento`;
  - association by `cnpj`.
- Existing users should not be updated by the sync when source fields change.
- New person users should be created with:
  - `role = agents`
  - `status = register`
  - `permitCode = id_cliente`
- New association users should be created with:
  - `role = admin`
  - `status = null`
  - generated placeholder email in the format `user+<random>@example.com`
  - `phone = 5551999999999`
  - `permitCode = null`
- Invite email delivery should continue using the current shared queued-invite flow unless a future requirement introduces a true agent-specific template or cadence.
