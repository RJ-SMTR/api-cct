## Problem Statement

O sincronismo semanal de agentes atualmente cria ou reutiliza o usuário da associação pelo CNPJ e o usuário agente pelo CPF, mas não garante o vínculo entre eles na tabela `user_relationships`. Além disso, a busca no BigQuery sempre lê todos os registros elegíveis, o que aumenta custo e tempo de processamento mesmo quando apenas uma parte dos agentes foi atualizada desde a última execução.

## Solution

O sincronismo de agentes deve garantir, ao final do processamento de cada linha, que exista um relacionamento `agente -> associação` em `user_relationships`, onde `user_id` representa o usuário agente identificado pelo CPF e `related_user_id` representa o usuário associação identificado pelo CNPJ. O processo também deve passar a ser incremental, consultando no BigQuery apenas os registros com `datetime_ultima_atualizacao` maior ou igual ao cursor salvo em `setting`, e avançando esse cursor para o maior timestamp efetivamente processado na execução.

## User Stories

1. As an operations team member, I want each synchronized agent to be linked to its association user, so that the system can represent the business relationship between the CPF and the CNPJ.
2. As an operations team member, I want the sync to create the relationship even when both users already exist, so that missing links can be repaired without recreating users.
3. As an operations team member, I want one agent to be linked to multiple associations, so that all valid CPF-to-CNPJ combinations are preserved.
4. As an operations team member, I want the sync to avoid duplicating existing relationship rows, so that reruns remain idempotent.
5. As an operations team member, I want the sync to reuse an existing association user found by CNPJ, so that the process does not create duplicate association accounts.
6. As an operations team member, I want the sync to ignore conflicting existing users outside the expected agent flow rather than mutating their role, so that the job remains safe.
7. As an operations team member, I want the sync to process only records updated since the last execution, so that the BigQuery read volume stays bounded.
8. As an operations team member, I want the incremental cursor to be persisted in `setting`, so that future executions continue from the last processed update time.
9. As an operations team member, I want records on the cursor boundary to be reprocessed safely, so that no updates are lost when multiple rows share the same update timestamp.
10. As a developer, I want automated tests around relationship creation and incremental cursor advancement, so that refactors do not break synchronization behavior.

## Implementation Decisions

- The agent sync service remains the orchestration boundary for weekly agent synchronization.
- The sync flow must resolve or create both business users first, then guarantee the `user_relationships` row for the pair `(agentUser.id, associationUser.id)`.
- The relationship direction is canonical: `user_id = agent user`, `related_user_id = association user`.
- Relationship persistence must be idempotent. Reprocessing the same BigQuery row must not duplicate users or relationship rows.
- The users repository will be extended with a small persistence seam for finding and creating user relationships so the sync service does not manipulate ORM details directly.
- The BigQuery repository for agents will accept an optional lower-bound timestamp and include `datetime_ultima_atualizacao` in the selected fields returned to the sync layer.
- The incremental cursor will be stored as a string setting following the existing `appSettings` pattern used elsewhere in the project.
- The BigQuery filter uses `datetime_ultima_atualizacao >= last_execution` and the sync updates the cursor to the maximum timestamp observed in the processed rows.
- If no newer rows are found, the sync must not advance the cursor arbitrarily.
- Existing user creation behavior for agent and association users remains in place; this change only adds relationship guarantees and incremental fetch behavior.

## Testing Decisions

- Good tests will verify observable sync behavior through the public service methods and repository seams, not private helper internals.
- `AgentesSyncService` tests will cover the behavior of creating the relationship when users are created in the same execution, creating only the relationship when both users already exist, and updating the incremental cursor based on the processed rows.
- `UsersRepository` tests will cover the ORM behavior for checking and creating `user_relationships` rows.
- `AgentesBigqueryRepository` tests are optional for this scope unless query construction becomes non-trivial enough to merit direct regression coverage.
- Prior art exists in the current `AgentesSyncService` unit tests and `UsersRepository` query-construction tests.

## Out of Scope

- Backfilling historical missing relationships outside the normal sync flow.
- Removing relationships that no longer appear in BigQuery.
- Changing role assignment rules for pre-existing users outside the expected sync path.
- Exposing user relationships through new API endpoints or UI surfaces.
- Changing other BigQuery synchronization jobs to use the same cursor strategy.

## Further Notes

- The repository currently has no `PROJECT.md` or `CONTEXT.md`; this PRD is the active source of scope for this feature.
- The existing untracked files in the workspace are unrelated to this feature and should remain untouched.
