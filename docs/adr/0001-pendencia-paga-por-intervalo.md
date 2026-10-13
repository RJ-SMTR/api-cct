# ADR 0001: Pendência Paga consultável por intervalo de datas

Data: 2026-10-07
Status: aceito

## Contexto

No relatório de Movimentação Financeira (perfil Permissionário), o status
"Pendência Paga" só podia ser pesquisado com uma única data (via campo de
data forçado para dia único no front, `isPendenciaPagaSelected` /
`hasSingleDayStatus`). A razão aparente, registrada em comentário no
backend (`relatorio-novo-remessa-financial-movement.service.ts`), era que
"Pendência Paga só existe em data única (pela data de pagamento): fora
dela não entra na base por vencimento" — a consulta principal
(`buildBaseQuery`) filtra por data de **vencimento**, enquanto Pendência
Paga é identificada pela data de **pagamento**, então nunca aparecia na
consulta principal.

Só que existe desde antes uma consulta dedicada para esse status,
`buildPendenciaPagaSingleDateQuery` (em
`novo-remessa/queries/novo-remessa-query-builder.ts`), que já filtra pela
data de pagamento com um `BETWEEN $1 AND $2` — um intervalo comum, não uma
igualdade de datas. Apesar do nome, o SQL nunca exigiu dia único; o gate de
dia único vivia só na camada JS (`resolveStatuses`, condicionado por
`isSingleDate`) e era replicado no front (forçar o date picker a um dia só
quando esse status é selecionado).

Isso causava o bug relatado pelo usuário: ao selecionar todos os status
(incluindo Pendência Paga) num intervalo de mais de um dia, o filtro de
Pendência Paga era descartado silenciosamente da consulta.

## Decisão

Pendência Paga passa a ser consultada pelo intervalo de datas completo
selecionado (data de pagamento), igual aos demais status — sem exigir dia
único. Removemos o gate `isSingle &&` que condicionava essa consulta e a
remoção de Pendência Paga da base por vencimento passa a ser incondicional
(nunca pertenceu à base por vencimento, janela de datas ou não).

Escopo: só o relatório de Movimentação Financeira do perfil **Permissionário**
(`relatorio-novo-remessa-financial-movement.service.ts` e
`FinancialMovement.js`). O relatório Consolidado do Permissionário não tem
essa lógica de dia único (não usa `resolveStatuses`); o fluxo de Guardador
tem sua própria cópia dessa lógica em arquivos separados
(`relatorio-guardador-financial-movement.repository.ts`,
`relatorio-guardador-consolidado.repository.ts`) e não foi alterado aqui.

## Consequências

- O date picker da Movimentação Financeira (Permissionário) não força mais
  dia único quando Pendência Paga está selecionada; aceita o mesmo
  intervalo que os demais status.
- `parentErrorStatusesSingleDate` (motivos de Pendência de Pagamento:
  Estorno/Rejeitado/OPs atrasadas) continua exigindo dia único — não foi
  tocado por esta decisão, é uma regra separada.
- `RelatorioNovoRemessaFinancialMovementRepository` (injetado no módulo,
  mas não chamado pelo controller/service de Movimentação Financeira) é
  código morto nesse caminho; não foi alterado nem removido aqui.
