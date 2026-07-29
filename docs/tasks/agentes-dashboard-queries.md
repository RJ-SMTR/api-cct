## Source Context

- PRD: `docs/tasks/agentes-dashboard-queries.prd.md`
- Project memory consulted: repository-local `AGENTS.md` instructions provided in session context
- Relevant modules: `src/agentes/agentes.repository.ts`, `src/agentes/agentes.service.ts`, `src/agentes/dtos/agentes-dashboard-query.dto.ts`
- Relevant schema sources: `src/cnab/novo-remessa/entity/ordem-pagamento-guardador.entity.ts`, `src/cnab/novo-remessa/entity/ordem-pagamento-agrupado.entity.ts`, `src/cnab/novo-remessa/entity/ordem-pagamento-agrupado-historico.entity.ts`, `src/cnab/enums/novo-remessa/status-remessa.enum.ts`, `src/cnab/enums/ocorrencia.enum.ts`
- Existing SQL prior art: `src/cnab/novo-remessa/repository/ordem-pagamento.repository.ts`

## Implementation Goal

Substituir o mock de dashboard de agentes por queries SQL reais, mantendo o contrato atual do endpoint e usando `queries.sql` como referência explícita das visões mensal, semanal e diária.

## Non-Goals

- Não reestruturar o endpoint ou o DTO público do dashboard.
- Não alterar regras de autenticação/autorização do dashboard.
- Não criar novas migrations.
- Não mudar o fluxo de remessa fora da leitura usada pelo dashboard.

## Acceptance Criteria Mapping

| Acceptance Criterion | Task(s) | Test(s) | Status |
| --- | --- | --- | --- |
| AC-1 Monthly dashboard data comes from SQL instead of mocks | T1, T2 | `AgentesRepository` unit | planned |
| AC-2 Weekly work days are nested under the correct payment date | T1, T2 | `AgentesRepository` unit | planned |
| AC-3 Daily detailed entries populate `selectedWorkDayPhotos` through the existing response contract | T1, T2, T3 | `AgentesRepository` unit + service-level smoke by contract | planned |
| AC-4 Available months come from persisted data instead of mock keys | T2, T3 | repository assertion | planned |
| AC-5 The dashboard continues to return `Pago` / `Rejeitado` semantics and rejection reasons | T1, T2 | `AgentesRepository` unit | planned |
| AC-6 `queries.sql` documents the final SQL used for the three views | T4 | manual review | planned |

## Task Breakdown

## T1 — Add dashboard repository tests for SQL row mapping

Objective:

Replace the mock-based dashboard repository assertion with tests that describe how monthly, weekly, and daily SQL rows must map into the existing dashboard data structure.

Affected files / areas:

`src/agentes/agentes.repository.spec.ts`

Test-first plan:

Mock the SQL query seam and add a failing test that expects one payment cycle, one work day, and one daily entry to be assembled into `DashboardMonthData`.

Dependencies:

None.

Completion signal:

The new repository test fails before implementation and passes after the SQL-backed mapping is added.

## T2 — Replace dashboard mock data with SQL-backed repository logic

Objective:

Inject a raw SQL execution seam, add monthly/weekly/daily queries, and map their results into the existing dashboard structure.

Affected files / areas:

`src/agentes/agentes.repository.ts`

Implementation notes:

Reuse the latest-history pattern already present in the remessa repository to avoid duplicate rows from `ordem_pagamento_agrupado_historico`.

Dependencies:

T1.

Completion signal:

`findDashboardData` returns real nested data from SQL and `getAvailableMonths` uses persisted rows.

## T3 — Adjust service integration to pass full dashboard filters

Objective:

Pass `userId`, `month`, `paymentDate`, and `workDate` from `AgentesService` into the repository so the three dashboard views can be filtered correctly.

Affected files / areas:

`src/agentes/agentes.service.ts`

Dependencies:

T2.

Completion signal:

The service still returns the same dashboard contract while sourcing data through the new repository method signature.

## T4 — Update `queries.sql` with the final SQL definitions

Objective:

Capture the cleaned monthly, weekly, and daily SQL in `queries.sql` for review and manual validation.

Affected files / areas:

`queries.sql`

Dependencies:

T2.

Completion signal:

`queries.sql` contains executable, parameterized queries aligned with the repository implementation.

## Test Strategy

- Unit tests:
  - `AgentesRepository` should verify transformation from raw SQL rows into dashboard payment cycles, work days, and daily entries.
- Integration tests:
  - Not required for this narrow repository change if the SQL seam and service contract are covered.
- Regression cases:
  - paid remittance row maps to `Pago`
  - non-paid remittance row maps to `Rejeitado`
  - rejection reason comes from `motivoStatusRemessa` when present
  - available months are returned in descending order
- Expected commands:
  - `npx jest src/agentes/agentes.repository.spec.ts --runInBand`

## Risk Plan

- History join duplication:
  - Mitigation: resolve only the latest history row per grouped payment.
- Contract drift in the dashboard response:
  - Mitigation: keep the repository output shaped as `DashboardMonthData` and let the existing service build the final response.
- Sparse daily data:
  - Mitigation: map aggregate rows into the existing `photos` array contract without changing the public API.

## Execution Order

1. T1: add the repository mapping test.
2. T2: implement SQL-backed dashboard assembly.
3. T3: adjust the service call signature and available months lookup.
4. T4: update `queries.sql`.
5. Run the targeted repository test if the local Jest setup supports it.

## Open Questions

No blocking questions remain for the first implementation pass. The current schema supports status and rejection-reason mapping from remittance history.

## Handoff to tdd

Ready for tdd. Start with the repository mapping test, then replace the mock dashboard data with SQL-backed assembly.
