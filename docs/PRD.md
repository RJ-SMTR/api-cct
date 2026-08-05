## Problem Statement

O dashboard de `src/agentes` hoje só oferece a visão mensal baseada na data de pagamento agrupada (`data tentativa`). Isso impede alternar a leitura do mês para a `data efetiva` de pagamento, como já acontece conceitualmente no painel mensal dos permissionários. Para agentes, também existe a necessidade futura de considerar `pendência paga`, mas esse fluxo ainda não está consistente no domínio de agentes e não deve ser incluído nesta entrega.

## Solution

Estender o endpoint de dashboard dos agentes para suportar dois modos de referência mensal:

- `data tentativa`: mantém o comportamento atual, agrupando pelo calendário de tentativa de pagamento.
- `data efetiva`: agrupa apenas pagamentos efetivados pelo calendário real de efetivação.

O contrato deve continuar compatível com o dashboard atual, expondo de forma explícita qual referência temporal está ativa para que a tela consiga alternar entre as duas visualizações.

## User Stories

1. As an admin, I want to open the agents monthly dashboard using tentative payment dates, so that I preserve the current operational view.
2. As an admin, I want to switch the agents monthly dashboard to effective payment dates, so that I can analyze when payments were actually settled.
3. As an agent, I want my own dashboard to support the same date reference toggle, so that I can reconcile scheduled versus settled payments.
4. As a dashboard consumer, I want the selected monthly, weekly, and daily drill-down data to stay consistent with the chosen date reference, so that navigation remains coherent.
5. As a dashboard consumer, I want the list of available months to reflect the chosen date reference, so that I only see months with data in that mode.
6. As a product owner, I want pendência paga explicitly out of scope for agents in this change, so that the feature ships without relying on an unfinished status flow.

## Implementation Decisions

- The agents dashboard endpoint will accept an optional date reference selector and default to the existing tentative behavior.
- The response will expose the active date reference so the client can label the current visualization correctly.
- Tentative mode will keep using the grouped payment date as the monthly and weekly anchor.
- Effective mode will use the effective settlement date from the latest grouped-payment history joined to `detalhe_a`.
- Effective mode will only return entries that have an effective payment date available; unresolved or awaiting payments stay visible in tentative mode only.
- Weekly and daily drill-downs will remain available in both modes, but they will be scoped by the selected reference date anchor of the current mode.
- No schema change or migration is required; the feature relies on existing `ordem_pagamento_guardador`, grouped payment history, and `detalhe_a` relations.

## Testing Decisions

- Tests should verify dashboard behavior through `AgentesService` and `AgentesRepository` public methods, not internal SQL string fragments beyond the minimum needed to prove the chosen query path.
- Repository tests should cover monthly data assembly and available-month lookup for tentative and effective references.
- Service tests should cover the response shape and the explicit active reference mode while preserving current summary calculations.
- Existing agent dashboard tests are the prior art for the response shape and status summarization rules.

## Out of Scope

- Support for `pendência paga` in the agents dashboard.
- Any frontend rendering changes outside the API contract exposed by `src/agentes`.
- Refactors unrelated to the dashboard date grouping behavior.
- New status semantics beyond the existing tentative and effective views.

## Further Notes

- Assumption: in the agents domain, `data tentativa` maps to `ordem_pagamento_agrupado.dataPagamento` and `data efetiva` maps to `detalhe_a.dataEfetivacao`.
- Assumption: the current dashboard endpoint is the backend contract used by the agents screen, so extending it is sufficient for this repository.
