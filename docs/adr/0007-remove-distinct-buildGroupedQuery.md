# ADR 0007: Remover `SELECT DISTINCT` de `buildGroupedQuery` (subcontagem no Consolidado/Movimentação Financeira)

Data: 2026-10-20
Status: aceito

## Contexto

Comparando o filtro "STUC - Gratuidade" do relatório Consolidado (ADR 0004)
com uma query manual que soma `op."valorGratuidade"` diretamente, os totais
divergiram para o dia 2026-10-20 em produção: R$ 483.565,00 (soma direta,
sem dedup indevido) contra R$ 461.180,00 (relatório), uma diferença de
R$ 22.385,00.

A causa é `buildGroupedQuery` (em
`src/relatorio/novo-remessa/queries/novo-remessa-query-builder.ts`, usada
por `buildBaseQuery` e `buildStucGratuidadeQuery`, por sua vez consumidas
pelo Consolidado — `RelatorioNovoRemessaConsolidadoRepository` — e pela
Movimentação Financeira — `relatorio-novo-remessa-financial-movement.*`):
a query usa `SELECT DISTINCT`, mas a lista de colunas não inclui o id da
ordem de pagamento (`op.id`), só o id do agrupamento (`opa.id`). Quando duas
ordens de pagamento distintas do mesmo agrupamento coincidem em todas as
colunas selecionadas — o caso mais comum é o mesmo vanzeiro ter duas ordens
de gratuidade com o mesmo valor dentro do mesmo agrupamento/remessa —
`DISTINCT` colapsa as duas em uma só linha, subcontando o total.

Confirmado em produção (2026-10-20, filtro STUC): 5.850 linhas sem
`DISTINCT` somavam R$ 483.565,00; as mesmas linhas com o `DISTINCT` atual
(chave `opa.id` + valor) caem para 5.449 linhas e R$ 461.180,00 — a
diferença de R$ 22.385,00 bate exatamente com o valor das linhas
colapsadas.

Checado que remover o `DISTINCT` não introduz duplicação por fan-out de
JOIN: nem `ordem_pagamento_agrupado_historico` → `detalhe_a` (1:1 nos dados
atuais) nem `bank.code` (código único) produzem mais de uma linha por
`ordem_pagamento` nessas junções.

## Decisão

Remover o `DISTINCT` de `buildGroupedQuery` (usada tanto por
`AGRUPAMENTO_NORMAL` quanto por `AGRUPAMENTO_GRATUIDADE`, ou seja,
`buildBaseQuery` e `buildStucGratuidadeQuery`). Nenhuma outra mudança de
lógica ou de filtro.

### Alternativa descartada

Manter `DISTINCT` e acrescentar `op.id` à lista de colunas, preservando a
dedupe para o caso em que ela é de fato necessária. Descartada por ora:
não há join com fan-out real nos dados hoje (ver checagem acima), então
`DISTINCT` não está removendo nenhuma duplicação legítima — só colapsa
coincidências de valor. Se um fan-out real aparecer no futuro (ex.: uma
mudança de schema que permita `oph` → `da` 1:N), a dedupe correta deve
voltar via `DISTINCT ON` ou agregação explícita, não via `DISTINCT` cego
sobre colunas de negócio.

## Consequências

- Consolidado (filtro STUC e fluxo normal) e Movimentação Financeira
  (mesmas duas queries) passam a contar o valor correto quando duas ordens
  de pagamento do mesmo agrupamento coincidem em valor. O total do
  Consolidado com STUC em 2026-10-20 sobe de R$ 461.180,00 para
  R$ 483.565,00.
- Na Movimentação Financeira (relatório linha a linha), isso também
  corrige a listagem: uma ordem de pagamento que antes "desaparecia" por
  coincidir em valor com outra do mesmo agrupamento agora aparece.
- `buildPendenciaPagaTemplate` e `buildPendenciaPagamentoTemplate` têm o
  mesmo padrão de `SELECT DISTINCT` sem `op.id` na lista de colunas e
  podem ter o mesmo problema — fora do escopo desta correção (não foi o
  que a comparação encontrou), registrado em `docs/TECH-DEBT.md`.
- Nenhuma mudança de assinatura, parâmetro ou filtro — só a remoção do
  `DISTINCT` em `buildGroupedQuery`.
