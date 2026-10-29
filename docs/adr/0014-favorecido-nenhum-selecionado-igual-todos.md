# ADR 0014: "Nenhum favorecido selecionado" se comporta como "Todos" na Movimentação Financeira

Data: 2026-10-29
Status: aceito

## Contexto

Na Movimentação Financeira do Permissionário (`relatorio-novo-remessa-financial-movement.service.ts`,
que monta SQL via `novo-remessa-query-builder.ts`), o parâmetro `todosVanzeiros` só é verdadeiro
quando o usuário marca explicitamente "Todos" no filtro de Favorecido no front. Esse parâmetro
controla `NOT_CPF_FILTER`, que exclui das consultas os 6 CNPJs dos próprios consórcios (VLT,
Intersul, Internorte, Transcarioca, Santa Cruz, CMTC) — esses CNPJs têm registro de usuário próprio
e aparecem nas mesmas consultas que os vanzeiros individuais.

Quando o usuário não seleciona nada no filtro de Favorecido (nenhum `userId` e `todosVanzeiros`
`false`/`undefined`), `NOT_CPF_FILTER` não é aplicado — o resultado passa a incluir os pagamentos
lançados nesses 6 CNPJs misturados com os vanzeiros individuais, diferente do que se vê marcando
"Todos" explicitamente. As duas seleções deveriam ser equivalentes (achado comparando com o
Relatório Consolidado, que já normaliza explicitamente "nada selecionado" para
`todosConsorcios: true, todosVanzeiros: true` em `relatorio-novo-remessa-consolidado.repository.ts`
linhas 294-296) — sem teste cobrindo esse cenário na Movimentação Financeira.

## Decisão

Normalizar o filtro em `RelatorioNovoRemessaFinancialMovementService.normalizeFilter`: quando não
há `userIds` e `todosVanzeiros` não foi explicitamente marcado, tratar como `todosVanzeiros: true`.
Isso faz "nada selecionado" e "Todos" convergirem para o mesmo resultado em todas as consultas que
leem `filter.todosVanzeiros` (`buildBaseQuery`, `buildEleicaoQuery`, `buildStucGratuidadeQuery`,
`buildPendentesQuery` e as variantes de dia único de Pendência Paga/Pendência de Pagamento).

Escopo: só o filtro de Favorecido (eixo vanzeiro). O filtro de Consórcio (`consorcioNome`) já é
"tudo" por padrão quando vazio (os binds `$5`/`consorcioParam` aceitam `NULL` como "sem restrição"
nas queries) — não precisa de normalização equivalente, e esta mudança não o altera.

Não se aplica a Guardador (`relatorio-guardador-financial-movement.repository.ts`): é um arquivo
separado, com sua própria lógica, fora do escopo desta correção.

## Consequências

- "Nenhum favorecido selecionado" e "Todos os favorecidos" passam a trazer o mesmo resultado na
  Movimentação Financeira do Permissionário, em qualquer combinação de status/específico
  (Eleição, STUC - Gratuidade, Pendência Paga, etc.), já que todas essas consultas leem o mesmo
  `filter.todosVanzeiros` normalizado.
- Sem mudança de assinatura ou de parâmetro novo — só o valor padrão de `todosVanzeiros` quando
  omitido e sem `userIds`.
