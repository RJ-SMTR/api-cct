# ADR 0004: STUC - Gratuidade reaproveita o agrupamento de gratuidade do CNAB

Data: 2026-10-09
Status: aceito

## Contexto

Foi pedido um novo item "STUC - Gratuidade" no combo "Específico" dos
relatórios Consolidado e Movimentação Financeira (perfil Permissionário, em
`app-cct`), para acompanhar pagamentos (pagos e/ou com pendência de
pagamento) de um valor de gratuidade.

O sistema já tem, desde a remessa/CNAB, um agrupamento **separado** só para
esse valor: `ordem_pagamento.valorGratuidade` (coluna decimal, nullable) e
`ordem_pagamento.ordemPagamentoAgrupadoGratuidadeId` (FK própria para
`ordem_pagamento_agrupado`, distinta da FK normal
`ordemPagamentoAgrupadoId`). Esse agrupamento de gratuidade já tem sua
própria remessa e histórico (`ordem_pagamento_agrupado_historico`), e já é
usado parcialmente no sistema: `OrdemPagamentoAgrupadoRepository.findAllGratuidade`
e `OrdemPagamentoAgrupadoHistoricoRepository.getHistoricoDetalheA(gratuidade: true)`
já seguem esse caminho para a tela de detalhe de uma ordem.

## Decisão

O filtro "STUC - Gratuidade" busca em `ordem_pagamento` pelas linhas onde
`valorGratuidade` é não nulo, e segue o agrupamento de gratuidade **separado**
(`ordemPagamentoAgrupadoGratuidadeId` → `ordem_pagamento_agrupado` →
`ordem_pagamento_agrupado_historico`) para status e histórico — não o
agrupamento normal (`ordemPagamentoAgrupadoId`). O valor exibido no
relatório é `valorGratuidade`, não o `valor` total da ordem.

Na implementação, isso é uma nova query builder (`buildStucGratuidadeQuery`,
em `src/relatorio/novo-remessa/queries/novo-remessa-query-builder.ts`)
espelhando `buildEleicaoQuery`, trocando a origem (`ordem_pagamento` por
`valorGratuidade` + a FK de gratuidade) e usando o `STATUS_CASE` completo
(não o `ELEICAO_STATUS_CASE`, que restringe os status possíveis).

### Alternativa descartada

Filtrar pelo agrupamento normal (`ordemPagamentoAgrupadoId`) e só marcar as
linhas com `valorGratuidade` preenchido. Descartada porque a gratuidade já
tem remessa e histórico próprios no sistema — misturar os dois agrupamentos
geraria status incorreto (o status de uma ordem no agrupamento normal não
necessariamente reflete o status do pagamento da sua parte de gratuidade,
que é paga por uma remessa separada).

## Consequências

- "OPs atrasadas" (motivo de Pendência de Pagamento) não se aplica a STUC:
  esse motivo corresponde à query `buildPendentesQuery`, que opera sobre
  `ordem_pagamento` sem agrupamento (`ordemPagamentoAgrupadoId IS NULL`) — um
  conceito do fluxo normal que não existe no agrupamento de gratuidade.
  Simplesmente não é chamada para STUC; não precisa de um caso de exclusão
  explícito na query.
- O item é exclusivo com os demais itens do combo Específico (Eleição,
  Desativados, Pendentes): a UI impede combiná-los.
- Escopo: relatórios Consolidado e Movimentação Financeira do perfil
  Permissionário. Não se aplica a Guardador.
