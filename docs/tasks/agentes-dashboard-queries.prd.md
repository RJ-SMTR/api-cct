## Problem Statement

O dashboard de agentes ainda depende de dados mockados em `src/agentes/agentes.repository.ts`. Isso impede validar o frontend contra dados reais de remessa e torna impossível evoluir as queries mensais, semanais e diárias a partir das tabelas já persistidas no banco.

## Solution

O repositório de agentes deve substituir o mock do dashboard por queries SQL reais, baseadas em `ordem_pagamento_guardador`, `ordem_pagamento_agrupado` e no último `ordem_pagamento_agrupado_historico` de cada agrupamento. O backend deve continuar expondo o mesmo contrato de dashboard já consumido pelo frontend, mas agora preenchido a partir de:

- visão mensal para os ciclos de pagamento do mês;
- visão semanal para os dias de trabalho de cada ciclo;
- visão diária para as entradas detalhadas de cada dia.

## User Stories

1. As a frontend developer, I want the agentes dashboard to return real monthly payment cycles, so that I can build the monthly visualization against persisted data.
2. As a frontend developer, I want the agentes dashboard to return real weekly work days for a selected payment date, so that I can drill into the selected cycle without relying on mocks.
3. As a frontend developer, I want the agentes dashboard to return real daily entries for a selected work date, so that I can build the detailed view and related queries.
4. As a backend maintainer, I want the SQL used by the agentes dashboard to be captured in `queries.sql`, so that the intended monthly, weekly, and daily data sources remain explicit and reviewable.
5. As a backend maintainer, I want the response shape of `/agentes/dashboard` to stay stable, so that replacing mocks with SQL does not force an unrelated frontend contract rewrite.

## Implementation Decisions

- The dashboard keeps the existing `/agentes/dashboard` endpoint and response contract.
- `AgentesService` will keep orchestrating the response and authorization rules.
- `AgentesRepository` becomes the source of truth for dashboard SQL and will accept `month`, `userId`, `paymentDate`, and `workDate`.
- Three SQL queries will be maintained in `queries.sql` and mirrored in the repository implementation:
  - monthly query for payment-cycle rows;
  - weekly query for work-day rows;
  - daily query for detailed entries.
- The latest remittance status per `ordemPagamentoAgrupadoId` will be resolved from `ordem_pagamento_agrupado_historico` using the most recent history row.
- Dashboard `status` values will be normalized to the semantics already expected by the service (`Pago` or `Rejeitado`), while rejection reasons will come from `motivoStatusRemessa` when available.
- When a remittance history row has no explicit rejection reason, the dashboard may fall back to the remittance status name as the pending reason.

## Testing Decisions

- Repository-level unit tests should verify that SQL results are transformed into the existing dashboard structure.
- Tests should verify monthly cycle creation, weekly work-day nesting, and daily photo-entry mapping from raw SQL rows.
- Existing agent-user tests remain in place; the dashboard coverage will be added alongside them.

## Out of Scope

- Redesigning the frontend response contract for `/agentes/dashboard`.
- Adding new dashboard endpoints.
- Changing remittance business rules or remittance status generation.
- Modeling true photo-level entities if the current source data is aggregate-only.

## Further Notes

- The repository already uses a task-scoped PRD convention under `docs/tasks/*.prd.md`; this change follows that pattern instead of overwriting the unrelated root `docs/PRD.md`.
