## Source Context

- PRD: `docs/PRD.md`
- Project memory consulted: repository-local documentation was not present for `PROJECT.md` and `CONTEXT.md`
- Relevant modules:
  - `src/agentes/agentes.repository.ts`
  - `src/agentes/agentes.service.ts`
  - `src/agentes/agentes.repository.spec.ts`
  - `src/agentes/agentes.service.spec.ts`
  - `src/cnab/novo-remessa/repository/ordem-pagamento.repository.ts`
  - `src/cnab/enums/novo-remessa/status-remessa.enum.ts`
- Relevant scripts:
  - `npm test -- src/agentes/agentes.repository.spec.ts src/agentes/agentes.service.spec.ts`

## Implementation Goal

Corrigir o dashboard de agentes para que o status `Aguardando Pagamento` seja preservado a partir do histórico de remessa e agregado corretamente nas visões mensal, semanal e diária, seguindo a semântica já usada pela rota mensal de ordem de pagamento.

## Non-Goals

- Alterar a rota mensal de ordem de pagamento.
- Reescrever a estrutura da query do dashboard além do necessário para corrigir o mapeamento de status.
- Introduzir novos campos de resposta além dos já existentes.

## Acceptance Criteria Mapping

| Acceptance Criterion | Task(s) | Test(s) | Status |
| --- | --- | --- | --- |
| AC-1 Dashboard entries with `statusRemessa = Aguardando Pagamento` expose that status instead of collapsing into rejection/pending | T1, T2 | `agentes.repository.spec.ts`, `agentes.service.spec.ts` | planned |
| AC-2 Dashboard summaries do not count `Aguardando Pagamento` entries as rejected | T1, T2 | `agentes.service.spec.ts` | planned |
| AC-3 Existing paid behavior remains unchanged | T1, T2 | existing repository paid regression + targeted service assertions | planned |

## Task Breakdown

## T1 — Add regression coverage for pending-in-settlement dashboard behavior

Objective:
Capture the failing `Aguardando Pagamento` case at the repository and service seams before changing production code.

Affected files / areas:
- `src/agentes/agentes.repository.spec.ts`
- `src/agentes/agentes.service.spec.ts`

Test-first plan:
- Add a repository test where `statusRemessa = 2` yields dashboard photo/workday/cycle status semantics for `Aguardando Pagamento`.
- Add a service test where a payment cycle with `Aguardando Pagamento` remains pending-in-settlement in summaries and does not increment rejected counters.

Implementation notes:
- Use literals aligned with `StatusRemessaEnum.AguardandoPagamento`.
- Keep tests focused on returned dashboard behavior, not private helper internals.

Dependencies:
- None.

Completion signal:
- New tests fail against the current implementation for the reported bug.

## T2 — Correct dashboard status mapping and aggregation

Objective:
Update dashboard mapping so intermediate remittance states are preserved and aggregated correctly.

Affected files / areas:
- `src/agentes/agentes.repository.ts`
- `src/agentes/agentes.service.ts`

Test-first plan:
- Make only the minimal production changes required to satisfy T1.
- Re-run the targeted agent specs after each logical adjustment.

Implementation notes:
- Preserve `Efetivado` as paid.
- Preserve `Aguardando Pagamento` as a distinct dashboard-visible status.
- Continue treating true remittance errors/rejections as rejected.
- Ensure summary counting and pending-reason resolution remain coherent with the expanded status set.

Dependencies:
- T1.

Completion signal:
- All targeted agent specs pass and the bug scenario no longer collapses into rejected/pending output.

## Test Strategy

- Unit/integration-style specs:
  - `src/agentes/agentes.repository.spec.ts`
  - `src/agentes/agentes.service.spec.ts`
- Regression cases:
  - `Aguardando Pagamento` from remittance history
  - Existing `Efetivado` happy path
- Command:
  - `npm test -- src/agentes/agentes.repository.spec.ts src/agentes/agentes.service.spec.ts`

## Risk Plan

- API contract risk: introducing a new dashboard status string may affect consumers.
  Mitigation: align the new string with the existing `statusRemessa` vocabulary already used by the monthly route.
- Aggregation risk: rejected counts may drop for states previously misclassified.
  Mitigation: cover summary totals explicitly in service tests.
- Regression risk: paid flows could accidentally change.
  Mitigation: keep the existing paid repository regression and verify it still passes.

## Execution Order

1. Write the failing repository regression for `Aguardando Pagamento`.
2. Write the failing service regression for summary aggregation.
3. Adjust repository status mapping.
4. Adjust service normalization/merge logic.
5. Run the targeted agent specs.

## Open Questions

No blocking open questions.

## Handoff to tdd

Ready for tdd. Start with T1 and write the failing tests for `Aguardando Pagamento` before changing the dashboard mapping.
