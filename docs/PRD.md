## Problem Statement

Na rota de dashboard do usuário agente, ordens com histórico mais recente em `Aguardando Pagamento` estão sendo apresentadas como um estado genérico de pendência/rejeição. Isso distorce a leitura do ciclo de pagamento pelo agente e diverge da referência já usada na rota mensal de ordem de pagamento, que preserva a descrição real do `statusRemessa`.

## Solution

Atualizar o fluxo do dashboard de agentes para preservar e expor corretamente o estado `Aguardando Pagamento` a partir do histórico mais recente da remessa, sem tratá-lo como rejeição. A agregação mensal, semanal e diária do dashboard deve refletir esse estado intermediário sem inflar contagens de rejeição e sem alterar o comportamento já existente para pagamentos efetivados, rejeitados ou estornados.

## User Stories

1. As an agent user, I want dashboard entries waiting for bank settlement to show `Aguardando Pagamento`, so that I do not confuse them with rejected payments.
2. As an agent user, I want the weekly and daily dashboard breakdowns to preserve the latest remittance status, so that I can inspect each payment cycle accurately.
3. As an operations user, I want the dashboard status behavior to match the monthly payment route semantics, so that different API surfaces do not disagree about the same payment state.
4. As a support analyst, I want pending-in-settlement entries to stop counting as rejected in dashboard summaries, so that dashboard totals remain trustworthy.
5. As a developer, I want regression coverage for the `Aguardando Pagamento` case, so that future changes do not collapse intermediate statuses back into generic pending or rejection states.

## Implementation Decisions

- The agent dashboard will continue reading the latest remittance history per grouped payment record and will use that status as the source of truth.
- The dashboard status mapping will stop collapsing every non-paid remittance state into `Rejeitado`.
- `Aguardando Pagamento` will be treated as its own dashboard-visible state instead of a rejection surrogate.
- Summary aggregation in the agent dashboard service will recognize `Aguardando Pagamento` as a non-final, non-rejected state.
- Existing behavior for `Efetivado`, rejection/error states, and mixed paid-plus-rejected cycles must remain intact unless required to support the new pending-in-settlement status.

## Testing Decisions

- Tests will verify observable dashboard behavior through repository and service public methods.
- Repository tests will cover how raw `statusRemessa` rows are transformed into dashboard-facing statuses and reasons.
- Service tests will cover how monthly/weekly summaries aggregate `Aguardando Pagamento` without misclassifying it as rejection.
- Expected values will be asserted as explicit literals derived from the bug report and current monthly-route semantics, not recomputed from implementation details.

## Out of Scope

- Changing the monthly `ordem-pagamento` route behavior.
- Refactoring unrelated dashboard response fields or authorization logic.
- Changing historical data persistence, CNAB return processing, or remittance generation flows.

## Further Notes

- No `PROJECT.md`, `CONTEXT.md`, or repository-local `WORKFLOW.md` file was present in this repository during this task. The task follows the workflow requirements supplied in the session instructions.
- The existing monthly payment flow in CNAB new remittance was used as the behavioral reference for preserving `statusRemessa` semantics.
