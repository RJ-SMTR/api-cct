## Source Context

- PRD: `docs/PRD.md`
- Project memory consulted: none found (`PROJECT.md` and `CONTEXT.md` do not exist in this repository)
- Relevant modules:
  - `src/agentes/agentes.controller.ts`
  - `src/agentes/agentes.service.ts`
  - `src/agentes/agentes.repository.ts`
  - `src/agentes/dtos/agentes-dashboard-query.dto.ts`
  - `src/cnab/novo-remessa/repository/ordem-pagamento.repository.ts`
- Relevant tests:
  - `src/agentes/agentes.service.spec.ts`
  - `src/agentes/agentes.repository.spec.ts`

## Implementation Goal

Adicionar ao dashboard de agentes a capacidade de alternar a visão mensal entre `data tentativa` e `data efetiva`, preservando o comportamento atual como padrão e mantendo fora do escopo o tratamento de `pendência paga`.

## Non-Goals

- Implementar ou corrigir `pendência paga` para agentes.
- Alterar regras de autorização do dashboard.
- Reestruturar o fluxo de status de remessa.
- Fazer refactors amplos no módulo CNAB.

## Acceptance Criteria Mapping

| Acceptance Criterion | Task(s) | Test(s) | Status |
| --- | --- | --- | --- |
| AC-1 O dashboard aceita alternância entre data tentativa e data efetiva | T1, T2 | service unit, repository unit | planned |
| AC-2 O modo padrão continua sendo data tentativa | T1, T2 | service unit | planned |
| AC-3 O agrupamento mensal/semanal/diário respeita a data efetiva quando selecionada | T2 | repository unit | planned |
| AC-4 A lista de meses disponíveis respeita a referência temporal selecionada | T2 | repository unit | planned |
| AC-5 A resposta informa explicitamente a referência temporal ativa | T1 | service unit | planned |
| AC-6 Pendência paga permanece fora do escopo | T1, T2 | regression assertions on status flow | planned |

## Task Breakdown

## T1 — Estender o contrato do dashboard de agentes

Objective:

Adicionar ao query DTO e à resposta do dashboard a noção explícita de referência temporal ativa, mantendo `data tentativa` como padrão.

Affected files / areas:

- `src/agentes/dtos/agentes-dashboard-query.dto.ts`
- `src/agentes/agentes.service.ts`
- `src/agentes/agentes.service.spec.ts`

Test-first plan:

- Adicionar teste de serviço cobrindo o modo padrão e o modo `data efetiva`.
- Garantir que a resposta continue contendo os resumos atuais e passe a informar a referência ativa.

Implementation notes:

- Usar um seletor opcional compatível com o contrato atual.
- Evitar renomear campos existentes já consumidos pelo frontend.

Dependencies:

- Nenhuma.

Completion signal:

- Serviço aceita o novo parâmetro, aplica o default correto e retorna a referência temporal ativa sem quebrar a resposta atual.

## T2 — Ajustar consultas e montagem do dashboard para referência temporal configurável

Objective:

Fazer o repositório montar os ciclos mensais com base em `data tentativa` ou `data efetiva`, incluindo a busca de meses disponíveis.

Affected files / areas:

- `src/agentes/agentes.repository.ts`
- `src/agentes/agentes.repository.spec.ts`

Test-first plan:

- Adicionar teste de repositório para o modo `data efetiva`.
- Adicionar teste cobrindo `getAvailableMonths` por referência temporal.
- Corrigir ou estabilizar specs existentes do módulo de agentes se estiverem impedindo a validação do comportamento público.

Implementation notes:

- Reaproveitar o join com histórico mais recente e `detalhe_a.dataEfetivacao`.
- Em modo efetivo, filtrar linhas sem data efetiva.
- Manter o drill-down semanal/diário coerente com a data âncora escolhida.

Dependencies:

- T1.

Completion signal:

- Repositório retorna dados coerentes para os dois modos e os testes de montagem do dashboard cobrem o novo comportamento.

## Test Strategy

- Unit/service:
  - `AgentesService` deve validar o default de referência temporal.
  - `AgentesService` deve incluir a referência ativa na resposta.
- Unit/repository:
  - `findDashboardData` em modo tentativa continua montando os ciclos atuais.
  - `findDashboardData` em modo efetiva monta ciclos por `dataEfetivacao`.
  - `getAvailableMonths` respeita a referência temporal.
- Validation commands:
  - `npx tsc --noEmit`
  - `npx jest ...` com configuração explícita, se viável no ambiente

Se o Jest padrão continuar bloqueado por configuração ausente do repositório, a validação mínima segura será compilação TypeScript e revisão das specs alteradas.

## Risk Plan

- Risk: quebrar o frontend atual ao mudar o contrato.
  - Mitigation: manter o modo padrão e os campos existentes; adicionar apenas informações novas.
- Risk: usar a data errada para a visão efetiva.
  - Mitigation: ancorar a query em `detalhe_a.dataEfetivacao`, alinhada ao painel mensal de permissionários.
- Risk: excluir pagamentos pendentes do modo atual.
  - Mitigation: restringir o filtro de efetivação apenas ao novo modo, preservando o comportamento atual em modo tentativa.
- Risk: testes do módulo já estão inconsistentes.
  - Mitigation: tratar os specs quebrados como parte da estabilização necessária para validar o comportamento público.

## Execution Order

1. T1: escrever teste de serviço para a nova referência temporal.
2. T1: implementar DTO e resposta do serviço.
3. T2: escrever testes de repositório para data efetiva e meses disponíveis por modo.
4. T2: implementar seleção de queries e joins por referência temporal.
5. Rodar validação disponível no ambiente e ajustar regressões.

## Open Questions

No blocking open questions.

## Handoff to tdd

Ready for tdd. Start with T1 and write the failing service test for the explicit date reference mode.
