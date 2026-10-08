# ADR 0002: Tie-breakers no cursor de paginação e filtro de valor aplicado após o agrupamento

Data: 2026-10-08
Status: aceito (Guardador implementado; Permissionário planejado)

## Contexto

No relatório de Movimentação Financeira, tanto o repository do Guardador
(`relatorio-guardador-financial-movement.repository.ts`) quanto o serviço
do Permissionário (`relatorio-novo-remessa-financial-movement.service.ts`
— **não** o `relatorio-novo-remessa-financial-movement.repository.ts`, que
é código morto confirmado na ADR 0001: injetado no módulo mas nunca usado
por nenhum controller/service) agregam a `base` num CTE `grouped` (`GROUP
BY "dataReferencia", nomes, email, "codBanco", "nomeBanco", "cpfCnpj",
"nomeConsorcio", status, "dataPagamento"[, "codigoErro" no Guardador]`) e
paginam por keyset sobre só 4 colunas: `(dataReferencia, nomes, status,
cpfCnpj)`.

Essas 4 colunas não identificam uma linha agrupada de forma única — o
`GROUP BY` usa mais colunas que isso. Duas linhas agrupadas podem empatar
nessa tupla de 4 (por exemplo, o mesmo favorecido pago sob dois
`nomeConsorcio` diferentes na mesma data e status). Quando um limite de
página cai dentro desse empate, a comparação `(tupla) > (cursor)` do
keyset exclui as linhas restantes do grupo empatado sem aviso — perda
silenciosa de linhas na paginação e na exportação (`streamFinancialMovementRows`
usa o mesmo cursor).

Separadamente, o filtro de valor (`valorMin`/`valorMax`) tinha dois
comportamentos diferentes:
- No Permissionário (`relatorio-novo-remessa-financial-movement.service.ts`),
  já era aplicado corretamente **depois** do agrupamento (substituição de
  `$6`/`$7` por literais neutros dentro do CTE `base`, filtro real só nas
  queries sobre `grouped`), correção anterior a este ADR. O repository
  homônimo (dead code) replica o mesmo padrão correto, mas não importa por
  não estar em uso.
- No Guardador, o filtro ainda era aplicado **antes** do agrupamento, em
  `guardador-novo-remessa-query-builder.ts`, sobre `da."valorLancamento"`
  (uma linha individual de lançamento, pré-`GROUP BY`). Isso filtra pelo
  valor de um lançamento isolado, não pelo valor final somado que o
  relatório exibe e pagina — então uma linha cujo total agregado está
  dentro do intervalo pode ser descartada (ou incluída) pelo valor errado
  quando o grupo soma mais de um lançamento.

Ambos os problemas foram encontrados em revisão/teste de código, sem
incidente relatado por usuária até o momento desta decisão.

## Decisão

1. **Cursor de paginação ganha tie-breakers.** A tupla de keyset passa a
   incluir todas as colunas não-agregadas do `GROUP BY` que ainda faltam:
   Guardador — `nomeConsorcio, codBanco, dataPagamento, codigoErro, email`;
   Permissionário (planejado) — `nomeConsorcio, codBanco, dataPagamento,
   email` (sem `codigoErro`, que não existe nesse `grouped`). Cada
   tie-breaker usa `COALESCE(..., '')` (texto) ou uma formatação ISO
   sortável para `dataPagamento`, para que a comparação de tupla do
   Postgres nunca vire `NULL` (o que excluiria a linha silenciosamente) e
   para que a ordenação de `dataPagamento` seja cronológica mesmo como
   texto.
2. **Filtro de valor sempre após o agrupamento.** Onde ainda filtra antes
   (Guardador: `guardador-novo-remessa-query-builder.ts`), remove-se o
   filtro de `valorMin`/`valorMax` da query base e ele passa a ser
   aplicado só nas queries sobre `grouped` (`COUNT`, agregados, página),
   igual ao padrão já usado no Permissionário.
3. **Escopo:** o tie-breaker do cursor vale para Guardador e Permissionário
   (não só para quem motivou o achado). Guardador já está implementado
   neste fluxo; Permissionário (`relatorio-novo-remessa-financial-movement.service.ts`,
   método `findFinancialMovementPage`/`findFinancialMovementBatchRows`)
   ainda precisa da mesma mudança nos tie-breakers do cursor — já está
   correto quanto ao filtro de valor, então o ponto 2 desta decisão não se
   aplica a ele. O `relatorio-novo-remessa-financial-movement.repository.ts`
   (dead code) fica fora do escopo de ambas as correções: não vale a pena
   corrigir código que não roda.
4. **Cursor deixa de ser opaco para o front.** Os novos campos do cursor
   (`cursorNomeConsorcio`, `cursorCodBanco`, `cursorDataPagamento`,
   `cursorCodigoErro`, `cursorEmail`) são adicionados aos DTOs/interface de
   filtro. O app-cct lê e repassa campos do `nextCursor` manualmente (não
   como blob opaco), então precisa de um ajuste espelhado para enviar os
   novos campos na próxima página — do contrário a paginação quebra ao
   cruzar uma página que dependa de um tie-breaker.

## Consequências

- Resultado de página e exportação do relatório Guardador deixam de perder
  linhas quando duas linhas agrupadas empatam nas 4 colunas antigas.
- `nextCursor` tem mais campos; qualquer client que montava esse objeto à
  mão (não só repassando o que recebeu) precisa do mesmo conjunto de
  campos — é o caso do app-cct, que requer PR espelhado (como ocorreu na
  ADR 0001/T2).
- Permissionário continua com o mesmo bug de tie-breakers até a tarefa
  correspondente ser implementada; listada como próxima tarefa, não como
  dívida técnica (é a mesma correção, só não aplicada ainda).
- `RelatorioNovoRemessaFinancialMovementRepository` (ver ADR 0001) não
  recebe nenhuma das duas correções: é código morto confirmado, fora do
  escopo tanto da correção quanto de qualquer decisão futura de remoção
  (que continua não tomada).
