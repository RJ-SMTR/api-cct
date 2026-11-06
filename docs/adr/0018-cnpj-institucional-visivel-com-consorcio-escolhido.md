# ADR 0018: CNPJs institucionais voltam a aparecer quando um Consórcio é escolhido

Data: 2026-11-06
Status: aceito, implementação pendente

## Contexto

`NOT_CPF_FILTER` (`novo-remessa-query-builder.ts`) exclui os 6 CNPJs institucionais dos
consórcios (VLT, Intersul, Internorte, Transcarioca, Santa Cruz, CMTC) sempre que nenhum
favorecido específico foi selecionado (`params.todosVanzeiros`), **independentemente** de o
usuário ter escolhido um Consórcio específico. Isso foi uma decisão deliberada (comentário em
`novo-remessa-query-builder.ts:117-123`, 2026-11-04) para evitar que o CNPJ institucional
aparecesse como "mais um favorecido" quando o usuário pede Favorecido=Todos sem filtrar
consórcio.

Só que a mesma exclusão também vale quando o usuário escolhe um Consórcio específico. Resultado
confirmado contra o banco: Movimentação Financeira, Consórcio=VLT (ou Internorte, Santa Cruz),
status=Pago, out/2026 → R$ 0,00, porque o pagamento desses consórcios é lançado no CNPJ
institucional dele, e esse CNPJ é sempre excluído. O Consolidado não tem essa exclusão e mostra
o valor correto (VLT R$ 3.912.838,32 em out/2026, bate com produção).

## Decisão

`NOT_CPF_FILTER` deixa de se aplicar quando o usuário já escolheu um Consórcio específico
(`params.hasConsorcioFilter`). A exclusão dos CNPJs institucionais continua valendo só para
"Favorecido=Todos" **sem** filtro de Consórcio — o cenário que motivou a regra original.

Confirmado por Rayanne em 2026-11-06.

## Consequências

- `buildTodosVanzeirosFilter` (`novo-remessa-query-builder.ts:124-127`) passa a retornar vazio
  quando `params.hasConsorcioFilter` é verdadeiro, em vez de aplicar `NOT_CPF_FILTER` sempre.
  `MODAIS_FILTER` já tinha essa condição (`params.hasConsorcioFilter ? '' : MODAIS_FILTER`);
  `NOT_CPF_FILTER` passa a ter a mesma.
- Selecionar um Consórcio específico (VLT, Internorte, Santa Cruz, Intersul, Transcarioca, CMTC)
  volta a mostrar o valor pago a ele na Movimentação Financeira, igual ao Consolidado.
- "Favorecido=Todos" sem filtro de Consórcio continua sem mostrar os CNPJs institucionais como
  linha individual (comportamento inalterado nesse cenário).
