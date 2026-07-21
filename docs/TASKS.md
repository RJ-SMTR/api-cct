## Source Context

- PRD: `docs/PRD.md`
- Project memory consulted: repository-local `AGENTS.md` instructions provided in session context
- Relevant modules: `src/agentes/agentes-sync.service.ts`, `src/agentes/agentes-bigquery.repository.ts`, `src/agentes/agentes.module.ts`, `src/users/users.repository.ts`, `src/users/users.module.ts`, `src/settings/app.settings.ts`
- Relevant entities: `src/users/entities/user.entity.ts`, `src/users/entities/user-relationship.entity.ts`, `src/settings/entities/setting.entity.ts`
- Relevant tests: `src/agentes/agentes-sync.service.spec.ts`, `src/users/users.repository.spec.ts`

## Implementation Goal

Garantir que o sincronismo de agentes crie ou reutilize o usuário agente e o usuário associação, assegure o vínculo `agente -> associação` em `user_relationships` sem duplicação, e passe a buscar do BigQuery apenas registros atualizados a partir do cursor salvo em `setting`.

## Non-Goals

- Não remover vínculos existentes.
- Não alterar regras de criação de outros tipos de usuário.
- Não criar endpoints, telas ou consultas novas para expor relacionamentos.
- Não reescrever outros cron jobs ou outros repositórios BigQuery.

## Acceptance Criteria Mapping

| Acceptance Criterion | Task(s) | Test(s) | Status |
| --- | --- | --- | --- |
| AC-1 Sync garante relacionamento `agente -> associação` ao processar uma linha nova | T1, T2 | `AgentesSyncService` unit | planned |
| AC-2 Sync cria apenas o relacionamento quando ambos os usuários já existem | T1, T2 | `AgentesSyncService` unit | planned |
| AC-3 Sync não duplica relacionamento existente | T1, T2 | `AgentesSyncService` unit, `UsersRepository` unit | planned |
| AC-4 Um agente pode ter múltiplas associações por múltiplas linhas | T1, T2 | `AgentesSyncService` unit | planned |
| AC-5 Sync lê do BigQuery apenas registros com `datetime_ultima_atualizacao >= cursor` | T1, T3 | `AgentesSyncService` unit and optional repository regression | planned |
| AC-6 Sync atualiza o cursor para o maior timestamp processado | T1, T3 | `AgentesSyncService` unit | planned |
| AC-7 Sync não avança cursor quando não houver linhas processadas | T1, T3 | `AgentesSyncService` unit | planned |

## Task Breakdown

## T1 — Expandir a especificação executável do sync

Objective:

Cobrir em testes o novo comportamento de relacionamento entre usuários e o cursor incremental do sincronismo.

Affected files / areas:

`src/agentes/agentes-sync.service.spec.ts`, possivelmente `src/users/users.repository.spec.ts`

Test-first plan:

Adicionar um teste que falhe quando o sync não criar `user_relationships` após criar ou localizar agente e associação; adicionar um teste que falhe quando o cursor incremental não for lido/salvo corretamente.

Implementation notes:

Mockar os seams públicos já usados pelo serviço (`UsersRepository`, `MailHistoryService`, `SettingsService`, `AgentesBigqueryRepository`) e descrever o comportamento esperado de ponta a ponta do serviço.

Dependencies:

Nenhuma.

Completion signal:

Os testes novos falham apenas pelos comportamentos ainda não implementados.

## T2 — Implementar persistência idempotente do relacionamento agente-associação

Objective:

Adicionar no repositório de usuários a capacidade de localizar e criar linhas em `user_relationships`, e usar esse seam no sync para garantir o vínculo após resolver os dois usuários.

Affected files / areas:

`src/users/users.repository.ts`, `src/users/users.repository.spec.ts`, `src/users/users.module.ts`, `src/agentes/agentes-sync.service.ts`

Test-first plan:

Usar o teste de T1 para dirigir a implementação; se necessário, adicionar teste unitário no repositório cobrindo a consulta/criação idempotente do relacionamento.

Implementation notes:

Registrar `UserRelationship` no módulo de usuários para acesso via TypeORM. Manter o serviço de sync como orquestrador e o repositório como boundary de persistência.

Dependencies:

T1.

Completion signal:

O sync cria o relacionamento quando ausente e não duplica quando já existe.

## T3 — Implementar cursor incremental baseado em setting

Objective:

Fazer o sync usar o cursor salvo em `setting` para filtrar o BigQuery por `datetime_ultima_atualizacao` e atualizar esse cursor ao final da execução.

Affected files / areas:

`src/agentes/agentes-bigquery.repository.ts`, `src/agentes/interfaces/agente-bigquery-user.interface.ts`, `src/agentes/agentes-sync.service.ts`, `src/agentes/agentes.module.ts`, `src/settings/app.settings.ts`

Test-first plan:

Usar o teste de T1 para verificar leitura do cursor existente, busca incremental e avanço para o maior timestamp processado; adicionar caso sem linhas para validar que o cursor não muda.

Implementation notes:

Seguir o padrão de `appSettings` e `SettingsService.upsertBySettingData(...)`. Usar `>=` no filtro. Selecionar `datetime_ultima_atualizacao` como string no BigQuery e comparar no serviço por `Date`.

Dependencies:

T1.

Completion signal:

O serviço lê o cursor, chama o repositório com o filtro incremental e salva o maior timestamp processado quando aplicável.

## Test Strategy

- Unit tests:
  - `AgentesSyncService` para criação de usuários, criação de relacionamento, idempotência do relacionamento e avanço do cursor.
  - `UsersRepository` para a query/persistência de `user_relationships`, se a lógica tiver branching suficiente para justificar teste direto.
- Integration tests:
  - Não são obrigatórios nesta mudança se os seams unitários cobrirem o comportamento com segurança; manter o escopo no nível de serviço e repositório.
- Regression cases:
  - Reprocessamento da mesma linha na borda do cursor.
  - Relação ausente com usuários já existentes.
  - Execução sem linhas retornadas.
- Expected commands:
  - `npm test -- agentes-sync.service.spec.ts`
  - `npm test -- users.repository.spec.ts`

## Risk Plan

- Duplicação de relacionamento:
  - Mitigação: consultar por par composto antes de inserir.
- Perda de registros na borda do cursor:
  - Mitigação: usar `>=` e garantir idempotência.
- Cursor avançado incorretamente sem processamento:
  - Mitigação: só atualizar quando houver timestamp válido processado.
- Wiring incompleto de TypeORM para `UserRelationship`:
  - Mitigação: registrar a entidade nos módulos relevantes e cobrir com teste.
- Regressão no fluxo atual de convite de agentes:
  - Mitigação: preservar os asserts existentes no teste do serviço.

## Execution Order

1. T1: escrever os testes novos no serviço.
2. T2: implementar o seam de relacionamento e fazer os testes de vínculo passarem.
3. T3: implementar o cursor incremental e fazer os testes de cursor passarem.
4. Rodar os testes relevantes e ajustar refactors pequenos sem ampliar escopo.

## Open Questions

No blocking open questions.

## Handoff to tdd

Ready for tdd. Start with T1 and write the failing service tests for relationship creation and incremental cursor advancement.
