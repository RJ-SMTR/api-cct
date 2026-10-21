# ADR 0008: Estorno/Rejeitado sem agrupamento pai somem no filtro de dia único

Data: 2026-10-21
Status: aceito

## Contexto

No relatório de Movimentação Financeira (perfil Permissionário), uma
consulta de **dia único** (`dataInicio === dataFim`) com o status "Estorno"
ou "Rejeitado" selecionado é roteada para
`buildPendenciaPagamentoSingleDateQuery` em vez de `buildBaseQuery`
(`relatorio-novo-remessa-financial-movement.service.ts`,
`parentErrorStatusesSingleDate`). Essa consulta foi desenhada para a
família pai/filha: quando uma ordem de pagamento é uma retentativa
(`opa."ordemPagamentoAgrupadoId"` aponta para um agrupamento pai), o status
e a data exibidos vêm do histórico mais recente do pai
(`CONTEXT.md`, linha 116), não do próprio registro.

O `INNER JOIN ordem_pagamento_agrupado op_pai ON op_pai.id =
opa."ordemPagamentoAgrupadoId"` dessa consulta exige que esse pai exista.
Uma ordem de Estorno/Rejeitado de **primeiro nível** — que nunca teve uma
tentativa anterior, nunca é filha de nada — tem
`opa."ordemPagamentoAgrupadoId" IS NULL` e por isso nunca casava com esse
JOIN. Ela continuava aparecendo no filtro de **intervalo** (mais de um dia,
via `buildBaseQuery`, que classifica pelo `STATUS_CASE` sem exigir pai),
mas sumia silenciosamente ao filtrar um dia só.

Confirmado em produção (túnel somente leitura, sem rodar a aplicação): em
2026-10-20, 3 ordens de pagamento (`op.id` 1014318/1016026/1016972, mesmo
`opa.id` 600239, `opaParentId` NULL) com `motivoStatusRemessa = '02'`
(Estorno) e `da."valorLancamento" = 1520,00` cada (R$ 4.560,00 no total)
não apareciam ao filtrar Estorno no dia único 20/10/2026, mas apareciam
corretamente no mesmo dia filtrando um intervalo (ex.: 19/10 a 21/10).

## Decisão

Em `buildPendenciaPagamentoTemplate`
(`src/relatorio/novo-remessa/queries/novo-remessa-query-builder.ts`),
adicionar um segundo `SELECT` via `UNION ALL` para o caso sem pai: mesmas
colunas, usando a própria `opa."dataPagamento"`/`STATUS_CASE`/`oph` do
registro (em vez do pai), filtrado por
`opa."ordemPagamentoAgrupadoId" IS NULL`. Nenhuma mudança na branch
existente (família pai/filha).

O `buildPendenciaPagaTemplate` (status "Pendência Paga") já tinha essa
cobertura — seu `WHERE` já ramifica com `OR` entre
`(tem pai E dataPagamento do pai no intervalo)` e
`(não tem pai E dataPagamento próprio no intervalo)`. O gap era específico
de `buildPendenciaPagamentoTemplate` (Estorno/Rejeitado).

### Cuidado replicado do ADR 0007

O branch novo usa `SELECT` simples (sem `DISTINCT`) pelo mesmo motivo do
ADR 0007: a lista de colunas não inclui `op.id`, só `opa.id`, e as 3 ordens
do exemplo acima são idênticas em todas as outras colunas — um
`SELECT DISTINCT` aqui colapsaria as 3 em 1 e subcontaria R$ 3.040,00 dos
R$ 4.560,00 reais. Verificado com e sem `DISTINCT` contra produção antes de
decidir.

## Consequências

- Estorno/Rejeitado em filtro de dia único agora inclui ordens sem
  agrupamento pai, com valor batendo com a soma direta no banco.
- A branch de família (pai/filha, `SELECT DISTINCT` sem `op.id`) não foi
  tocada — o mesmo risco de subcontagem por coincidência de valor
  registrado em **TD-14** (`docs/TECH-DEBT.md`) continua aberto para ela.
- Teste de regressão em `novo-remessa-query-builder.spec.ts` (branch
  `UNION ALL` presente, filtro por `opa."ordemPagamentoAgrupadoId" IS
  NULL`).
- `RelatorioNovoRemessaFinancialMovementRepository` (citado no ADR 0001
  como código morto) foi removido nesta mesma mudança — não era chamado
  pelo controller/service de Movimentação Financeira.
