# ADR 0011: Restringir a uma ordem por agrupamento em `AGRUPAMENTO_NORMAL` (corrige o ADR 0010)

Data: 2026-10-21
Status: aceito

## Contexto

Durante uma verificação pedida pelo usuário (comparar o relatório de Movimentação Financeira
do Permissionário com o banco, para vários status, incluindo STUC), confirmei com dado real
(banco local, 2026-09-10, Permissionário, status Pago) que a Movimentação Financeira mostrava
R$ 281.131,68, contra R$ 59.212,56 reais — quase 5x a mais. O relatório Consolidado, para o
mesmo filtro, mostrava o valor correto (R$ 59.212,56).

A causa: `buildGroupedQuery` (usada por `buildBaseQuery`/`buildStucGratuidadeQuery`, em
`src/relatorio/novo-remessa/queries/novo-remessa-query-builder.ts`) parte de
`FROM ordem_pagamento op INNER JOIN ordem_pagamento_agrupado opa ON op."ordemPagamentoAgrupadoId" = opa.id`.
Essa relação é 1:N por design — um `OrdemPagamentoAgrupado` "agrupa as ordens de pagamento por
favorecido para uma data de pagamento; o valor é somado" (`CONTEXT.md`) — mas o `valor`
selecionado para a fonte `AGRUPAMENTO_NORMAL` é `da."valorLancamento"`, o total do **lote**
(do `detalhe_a`/histórico daquele agrupamento), não um valor por `ordem_pagamento`. Quando um
agrupamento tem N ordens filhas, a consulta gera N linhas repetindo o mesmo
`da."valorLancamento"`; o `SUM()` do serviço consumidor (CTE `grouped`, ver ADR 0002) soma o
mesmo lançamento N vezes.

Confirmado com dado real: `opa.id=507542` (ALEXANDRA MAURICIO ANGELO, STPL) tem 6 ordens de
pagamento filhas (`op.id` 746319, 748220, 750395, 751794, 754745, 756783), todas do mesmo
`userId`, todas apontando para o mesmo `detalhe_a.id` (R$ 3.027,12 cada aparição, mas é o
**mesmo** lançamento) — o valor real do grupo é R$ 3.027,12, não R$ 18.162,72. Em outro
agrupamento do mesmo dia, 8 ordens filhas inflaram R$ 5.548,80 (real) para R$ 44.390,40.

**O ADR 0007 estava correto** para `AGRUPAMENTO_GRATUIDADE` (`op."valorGratuidade"` é um valor
genuinamente por ordem — duas ordens de gratuidade distintas podem legitimamente coincidir em
valor sem ser a mesma ordem, e a checagem de fan-out feita naquele ADR, para esse caso
específico, estava certa). **O ADR 0010 copiou o mesmo raciocínio para `buildPendenciaPagaTemplate`
e `buildPendenciaPagamentoTemplate`, só que essas duas também usam a fonte `AGRUPAMENTO_NORMAL`
(`da."valorLancamento"`)** — o mesmo fan-out se aplica, e remover o `DISTINCT` lá piorou o bug
em vez de corrigi-lo.

O próprio caso de exemplo do ADR 0010 confirma isso: `opa.id=253902` (CPF 29709920782) foi
descrito como "3 ordens de pagamento distintas de R$12,38 cada". Conferindo no banco:

```
op_id  | oph_id | da_id | valorLancamento
34723  | 255318 | 21536 | 12.38
35787  | 255318 | 21536 | 12.38
36572  | 255318 | 21536 | 12.38
```

É **o mesmo `da_id` (21536)** nas 3 linhas — 1 único lançamento com 3 ordens filhas do mesmo
agrupamento, não 3 lançamentos distintos que coincidem em valor. O valor real desse grupo é
R$ 12,38, não R$ 37,14: a "correção" do ADR 0010 introduziu uma sobrecontagem 3x nesse caso,
em vez de corrigir uma subcontagem. TD-14, pago com esse diagnóstico, está sendo reaberto
(`docs/TECH-DEBT.md`).

O Consolidado (`RelatorioNovoRemessaConsolidadoRepository.getQueryConsorcios`/`getQueryVanzeiros`)
não usa essas funções compartilhadas e não sofria essa sobrecontagem — seu próprio
`SELECT DISTINCT (nome, nome2, valor, idLinha)` já colapsa, por acidente, as linhas fanned-out
(mesmo `nome`/`nome2`/`valor`/`idLinha` para todas as ordens filhas de um agrupamento sem
substituição). Ele tinha, à parte, um guard faltando (`NOT EXISTS` de agrupamento filha) que as
consultas de Pendência Paga do mesmo arquivo já tinham — corrigido aqui por defesa em
profundidade (não altera o valor total hoje).

## Decisão

Para a fonte `AGRUPAMENTO_NORMAL` (`da."valorLancamento"`), restringir `buildGroupedQuery`,
`buildPendenciaPagaTemplate` e `buildPendenciaPagamentoTemplate` (as duas branches do
`UNION ALL` desta última) a **uma única `ordem_pagamento` representante por agrupamento**,
via `op.id = (SELECT MIN(o.id) FROM ordem_pagamento o WHERE o."ordemPagamentoAgrupadoId" = opa.id)`.
A fonte `AGRUPAMENTO_GRATUIDADE` não ganha essa restrição — seu valor continua genuinamente por
ordem (ADR 0007 permanece válido para ela).

Adicionalmente, `getQueryConsorcios`/`getQueryVanzeiros` (Consolidado) ganham o mesmo guard
`NOT EXISTS (agrupamento filha)` + exclusão de `motivoStatusRemessa IN ('AM','AE')` que
`getQueryPendenciaPagaConsorcios`/`Vanzeiros` já tinham, para não depender do efeito colateral
do `DISTINCT`.

### Alternativas descartadas

- **Reverter o `DISTINCT` globalmente (desfazer ADR 0007/0010)**: mais simples, mas
  reintroduz a subcontagem real que o ADR 0007 corrigiu para STUC-Gratuidade.
- **`DISTINCT ON (opa.id)`**: equivalente em efeito à subquery `MIN(o.id)` escolhida, mas
  mudaria a estrutura da consulta (não é mais um simples `SELECT` com `WHERE`); a subquery
  correlacionada é uma mudança menor no padrão de template string já usado no arquivo.

## Consequências

- Movimentação Financeira e Pendência Paga/Pendência de Pagamento (Permissionário) voltam a
  mostrar o valor real quando um agrupamento tem mais de uma ordem de pagamento filha.
- TD-14 reaberto: o critério de pagamento anterior (ADR 0010) usava um caso mal diagnosticado.
- STUC-Gratuidade (`AGRUPAMENTO_GRATUIDADE`) não é afetado — nenhuma mudança de comportamento
  coberto pelo ADR 0007.
- Consolidado ganha defesa em profundidade (guard `NOT EXISTS`/motivo), sem mudança de valor
  observável hoje.
- Nenhuma mudança de assinatura, parâmetro ou filtro público — só a condição adicional no
  `WHERE` das três funções, e o guard adicional nas duas queries do Consolidado.
- Fluxo de Guardador (`guardador-novo-remessa-query-builder.ts`) não foi auditado nesta ADR;
  se usar o mesmo padrão de agrupamento 1:N com valor por lote, pode ter o mesmo bug — fora do
  escopo, registrar como achado separado se confirmado.
