# ADR 0012: STUC - Gratuidade mostra os dias da janela de pagamento como colunas

Data: 2026-10-23
Status: aceito

## Contexto

A issue #1181 pedia, além do próprio filtro "STUC - Gratuidade" (ADR 0004),
8 colunas extras no relatório: 4 pares de "Data da Ordem de Pagamento" +
"Valor". A leitura inicial era que essas 4 datas eram 4 pagamentos
cronológicos arbitrários de um favorecido no período. Isso está errado: o
sistema já paga em janelas fixas por dia da semana (regra "Janelas de
pagamento" em `CONTEXT.md`, `calcularPeriodoPagamento`,
`src/cron-jobs/cron-jobs.service.ts`) — sexta a segunda (4 dias) paga na
terça seguinte; terça a quinta (3 dias) paga na sexta seguinte. As 4 colunas
pedidas são os até-4 dias de **uma** janela, não 4 janelas diferentes.

## Decisão

Para o filtro STUC, cada linha do relatório (Consolidado e Movimentação
Financeira, Permissionário) passa a representar uma **janela de pagamento**
de um favorecido, com até 4 colunas de dia (`dataOrdemPagamento1..4` +
`valorOrdemPagamento1..4`), preenchidas com a data de referência/vencimento
da ordem daquele dia específico e a soma do `valorGratuidade` das ordens
daquele dia. Janela de 3 dias (terça-quinta) deixa a 4ª coluna vazia. A
coluna "Valor" existente na linha passa a representar a soma da janela
(não mais um total geral do favorecido, nem um pagamento isolado).

Pendência de Pagamento (ainda não paga) não tem uma `dataPagamento` real;
a janela é derivada da própria data de referência/vencimento da ordem, pela
mesma regra `calcularPeriodoPagamento` — sem isso, pendências ficariam sem
como ser agrupadas em janelas.

Como a janela tem no máximo 4 dias por regra de negócio, não existe caso de
"mais de 4 datas para a mesma janela" a tratar (sem overflow/linha extra).
Múltiplas janelas no período selecionado continuam gerando múltiplas linhas,
como o relatório já faz hoje.

### Alternativa descartada

Tratar as 4 colunas como os 4 pagamentos mais recentes/antigos de um
favorecido no período (independente de janela), com "transbordo" para uma
linha extra ao passar de 4. Descartada porque não corresponde a nenhum
conceito de negócio real — inventaria uma regra de paginação de colunas sem
necessidade, já que o calendário de pagamento já limita naturalmente a 3 ou
4 dias por janela.

## Consequências

- Granularidade do Consolidado para STUC muda: hoje é 1 linha por
  favorecido somando todo o período; passa a ser 1 linha por favorecido por
  janela de pagamento. Os demais filtros do Consolidado (Eleição,
  Desativados, Pendentes, normal) não mudam.
- Precisa de uma função que derive, a partir de uma data de referência,
  a identidade da janela e a posição do dia dentro dela (mesma regra de
  `calcularPeriodoPagamento`, reimplementada sem acoplar o módulo de
  relatórios ao `cron-jobs`).
