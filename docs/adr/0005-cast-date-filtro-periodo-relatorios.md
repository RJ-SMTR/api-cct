# ADR 0005: Cast `::date` no filtro de período dos relatórios (Consolidado/Movimentação Financeira)

Data: 2026-10-19
Status: aceito

## Contexto

Usuário reportou que os relatórios estavam "trazendo datas erradas" ao filtrar
por período (campos "De"/"Até" do calendário), nos 4 fluxos: Consolidado e
Movimentação Financeira, perfis Permissionário e Guardador.

Investigação no código (rastreando controller → service → repository → query
builder para cada um dos 4 fluxos) encontrou a causa:

- `detalhe_a.dataVencimento` e `ordem_pagamento_agrupado.dataPagamento` são
  `@Column({ type: Date })`, isto é, `timestamp without time zone` no
  Postgres. Essas colunas são gravadas por `getInicioDoDiaBrasilia()`
  (`src/utils/date-utils.ts`), cujo valor literal persistido é `03:00:00`
  (= meia-noite de Brasília, UTC-3), não `00:00:00`.
- Três queries compõem o filtro de período como
  `coluna BETWEEN $1 AND $2`, onde `$1`/`$2` chegam como string
  `'yyyy-MM-dd'`. O Postgres promove a comparação para `timestamp`,
  tratando o parâmetro como `'yyyy-MM-dd 00:00:00'`. Uma linha do **último
  dia** do período, gravada como `...03:00:00`, fica acima desse limite e é
  excluída silenciosamente do resultado — sem erro, sem log, o usuário só vê
  "faltam dados do último dia".
- Em contraste, `ordem_pagamento.dataOrdem` e
  `ordem_pagamento_guardador.dataOrdem` são `@Column({ type: 'date' })` —
  `date` puro, sem componente de hora — então comparações `BETWEEN` com elas
  não têm esse problema. Uma auditoria inicial havia incluído essas colunas
  por engano; confirmado pelo tipo da coluna que não são afetadas.
- O próprio código já resolve esse problema em outro lugar: as queries de
  "Pendência Paga"/"Pendência de Pagamento" (dia único ou intervalo, nos
  mesmos arquivos) usam `coluna::date BETWEEN $1::date AND $2::date` — cast
  na coluna **e** nos parâmetros. Cast só nos parâmetros não bastaria: sem
  cast na coluna, o Postgres promove os parâmetros `date` de volta para
  `timestamp` na comparação, reproduzindo o mesmo bug.

### Pontos exatos do bug (3, não mais)

1. `src/relatorio/novo-remessa/queries/novo-remessa-query-builder.ts:140`
   (`buildGroupedQuery`, usada por `buildBaseQuery` e
   `buildStucGratuidadeQuery`)
2. `src/relatorio/novo-remessa/queries/novo-remessa-query-builder.ts:299`
   (`buildEleicaoQuery`)
3. `src/relatorio/novo-remessa/queries/guardador-novo-remessa-query-builder.ts:155`
   (`buildGuardadorBaseQuery`)

### Impacto por fluxo (rastreado via controller → service → repository)

- **Movimentação Financeira – Permissionário**
  (`relatorio-novo-remessa-financial-movement.service.ts`): afetada a busca
  normal (status Pago/Erro/Em processamento via `buildBaseQuery`), o filtro
  Eleição (`buildEleicaoQuery`) e o filtro STUC-Gratuidade
  (`buildStucGratuidadeQuery`).
- **Movimentação Financeira – Guardador**
  (`relatorio-guardador-financial-movement.repository.ts`): afetada a busca
  normal, via `buildGuardadorBaseQuery` (compartilhada com o Consolidado
  Guardador).
- **Consolidado – Guardador**
  (`relatorio-guardador-consolidado.repository.ts`): mesmo bug na busca
  normal, mesma função compartilhada (`buildGuardadorBaseQuery`).
- **Consolidado – Permissionário**
  (`relatorio-novo-remessa-consolidado.repository.ts`): a busca normal
  **já está correta** — esse repositório tem queries próprias
  (`getQueryConsorcios`/`getQueryVanzeiros`/etc.) que já usam
  `>= '...'::date AND < '...'::date + interval '1 day'`. Só o filtro
  STUC-Gratuidade usa `buildStucGratuidadeQuery` (ponto 1 acima) e por isso
  também é afetado.

Não afetados (confirmado pelo tipo de coluna, `date` puro): `buildPendentesQuery`
(`op."dataOrdem"`, novo-remessa-query-builder.ts) e `buildGuardadorAPagarQuery`
(`opg."dataOrdem"`, guardador-novo-remessa-query-builder.ts).

## Decisão

Aplicar `::date` na coluna **e** nos dois parâmetros, nos 3 pontos listados:

```sql
-- antes
da."dataVencimento" BETWEEN $1 AND $2
-- depois
da."dataVencimento"::date BETWEEN $1::date AND $2::date
```

Mesmo padrão já comprovado nas queries de Pendência Paga/Pendência de
Pagamento dos mesmos arquivos — não introduz lógica nova.

## Consequências

- Os 4 relatórios passam a incluir o registro do último dia do período
  selecionado em todos os status/filtros, não só em Pendência
  Paga/Pendência de Pagamento.
- Nenhuma mudança em `buildPendentesQuery` nem em `buildGuardadorAPagarQuery`
  (colunas `date` puro, não têm esse bug; tocar nelas seria risco sem
  benefício).
- `relatorio-novo-remessa-financial-movement.repository.ts` (código morto,
  ver ADR 0001) também importa `buildBaseQuery`/`buildEleicaoQuery`; herda a
  correção automaticamente por usar a mesma função exportada, mas não precisa
  de teste dedicado por ser código morto.
