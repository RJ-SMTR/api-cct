# ADR 0017: "A Pagar" significa "banco ainda não confirmou o pagamento", nas duas telas

Data: 2026-11-06
Status: aceito, implementado

## Contexto

Comparando o Relatório Consolidado e a Movimentação Financeira do Permissionário com o mesmo
filtro (Favorecido=Todos, status A Pagar, 02/11–06/11/2026), os totais não batem: R$ 1.427.881,70
no Consolidado contra R$ 585.390,38 na Movimentação Financeira. Não é duplicação de valor nem
divergência de filtro de consórcio — são duas definições de negócio diferentes para "A Pagar":

- **Consolidado** (`RelatorioNovoRemessaConsolidadoRepository.getQueryApagarVanzeiros`/
  `getWhereApagar`): ordens **ainda não agrupadas nem enviadas em nenhuma remessa** —
  `(op."ordemPagamentoAgrupadoId" IS NULL) OR (da.id IS NULL)` —, filtradas por
  `op."dataCaptura"` (data da corrida/transação).
- **Movimentação Financeira** (`RelatorioNovoRemessaFinancialMovementService.buildFinalBaseQuery`
  → `buildBaseQuery`/`STATUS_CASE` em `novo-remessa-query-builder.ts`): ordens **já agrupadas e
  enviadas** em remessa, com `oph."statusRemessa" IN (0,1)` (criada/enviada, aguardando retorno
  do banco), filtradas por `da."dataVencimento"`.

As duas populações de ordens não se sobrepõem (confirmado contra produção, 0 ordens em comum
entre as duas consultas) — a soma das duas é o total realmente pendente de pagamento no período
(R$ 2.014.192,08 no período testado).

Uma primeira versão desta ADR (2026-11-06, sessão de grilling anterior) decidiu manter as duas
populações separadas sob nomes diferentes ("A Pagar" = nunca enviada, "Em Remessa" = enviada
aguardando banco). Revisitada na mesma data, à luz de uma lista de erros de relatório que
comparava os dois relatórios contra o banco de produção: para quem consulta o relatório, "A
Pagar" responde à pergunta "o banco já confirmou?" — e as duas populações respondem "não" a essa
pergunta. Separar em dois status obriga o usuário a somar duas telas/filtros para saber o total
pendente, que é exatamente o número que motivou a investigação original.

## Decisão

"A Pagar" passa a significar **"o banco ainda não confirmou o pagamento"** — união das duas
populações — em todas as telas que usam essa terminologia (Consolidado, Movimentação Financeira,
Guardador, Eleição, STUC-Gratuidade). Não existe status novo "Em Remessa"; a ideia é descartada.

Dentro do bucket `statusRemessa IN (0,1)` que o `STATUS_CASE` já classifica como "A Pagar":
`statusRemessa = 0` é a ordem agrupada mas ainda não enviada em remessa; `statusRemessa = 1` é a
ordem **em remessa** - já enviada, aguardando o retorno do banco. Os dois continuam sob o mesmo
rótulo "A Pagar", junto com as ordens nunca agrupadas - a distinção entre 0 e 1 é só para
entendimento do domínio, não gera status novo nem filtro novo.

Confirmado por Rayanne em 2026-11-06 (revisita à decisão original da mesma data).

## Escopo

- **Movimentação Financeira Permissionário**: `buildBaseQuery`/`STATUS_CASE` continuam
  classificando `statusRemessa IN (0,1)` como "A Pagar" (não muda). Precisa passar a **somar**
  também a população de ordens nunca agrupadas/enviadas (mesma fonte do Consolidado,
  `op."dataCaptura"`, sem agrupamento) quando "A Pagar" é pedido — hoje essa população não
  aparece porque a consulta só lê `detalhe_a`/histórico, que só existe depois do agrupamento.
- **Consolidado Permissionário**: `getQueryApagarVanzeiros`/`getWhereApagar` continuam cobrindo
  ordens nunca agrupadas (não muda). Precisa passar a somar também as ordens já enviadas com
  `statusRemessa IN (0,1)`.
- **Guardador**: `GUARDADOR_STATUS_CASE` já mapeia `statusRemessa IN (0,1)` para `'A Pagar'` e as
  duas telas (`relatorio-guardador-consolidado.repository.ts`,
  `relatorio-guardador-financial-movement.repository.ts`) já somam essa população com a de
  `buildGuardadorAPagarQuery` (ordens nunca agrupadas) sempre que "A Pagar" é selecionado — o
  Guardador **já implementa** a regra desta ADR hoje, nas duas telas. Nenhuma mudança necessária
  aqui; serve de referência para a implementação do Permissionário.
- **Eleição**: mesma regra — `ELEICAO_STATUS_CASE` (`statusRemessa IN (0,1)` → "A Pagar") soma
  com a população de ordens nunca agrupadas (`getQueryApagarEleicaoConsorcio`/
  `getQueryApagarEleicaoVanzeiro` no Consolidado; equivalente ainda não existe na Movimentação
  Financeira da Eleição e precisa ser criado).
- A sobreposição entre "A Pagar" (ordens nunca agrupadas, janela atual) e "Pendentes"/OPs
  atrasadas (ordens nunca agrupadas, janela anterior a `getDataMinima()`) não é um problema novo:
  o Consolidado já particiona as duas por janela de data (`dataInicio` empurrado para
  `dataMinima` em "A Pagar"; `dataFim` limitado a `dataMinima - 2` em "Pendentes") — ao portar a
  lógica para a Movimentação Financeira, essa partição vem junto, sem necessidade de nova regra.

## Consequências

- Nenhum status novo, nenhuma mudança de enum (`StatusPagamento` não ganha `EM_REMESSA`).
- Movimentação Financeira Permissionário (e Eleição) ganham uma segunda fonte de dados para "A
  Pagar" (ordens nunca agrupadas, por `dataCaptura`), somada à existente (`statusRemessa IN
  (0,1)`, por `dataVencimento`) — mesmo padrão que o Guardador já usa.
- Consolidado Permissionário ganha uma segunda fonte de dados para "A Pagar" (ordens já
  enviadas, `statusRemessa IN (0,1)`), somada à existente (ordens nunca agrupadas).
- Front-end (`app-cct`) não precisa de opção de filtro nova — "A Pagar" continua sendo uma opção
  só, agora com o total completo atrás dela.
- Implementação ainda não feita (ver `docs/TASKS.md` quando o plano for criado via
  `task-planner`). Esta ADR registra a decisão de negócio e o escopo, não a solução técnica linha
  a linha.

## Ver também

- `CONTEXT.md`, seção "Status 'A Pagar' significa 'banco ainda não confirmou'" (achado original
  com os números testados contra produção).
- [`docs/adr/0018-cnpj-institucional-visivel-com-consorcio-escolhido.md`](0018-cnpj-institucional-visivel-com-consorcio-escolhido.md)
- [`docs/adr/0019-eleicao-financeira-fallback-cpfcnpj-sem-idoperadora.md`](0019-eleicao-financeira-fallback-cpfcnpj-sem-idoperadora.md)
- [`docs/adr/0020-rejeitado-so-o-que-seria-pago-de-novo.md`](0020-rejeitado-so-o-que-seria-pago-de-novo.md)
