# ADR 0023: Desempenho dos relatórios v2 — timeout, agregação no banco e índices de expressão

Data: 2026-11-12
Status: aceito, não implementado

## Contexto

Teste em produção em 2026-11-12 (Rayanne), perfil Permissionário, todos os favorecidos e todos os status:

| Período | Consolidado v2 | Movimentação Financeira v2 (`report/v2/page`) |
|---|---|---|
| 3 meses | 9 s | 16–17 s |
| 6 meses | 17 s | 32 s |
| 1 ano | sem resposta após 3,5 min | não rodou |

Os totais bateram entre os dois relatórios nos períodos que responderam. O tempo cresce de forma linear até 6 meses e
explode em 1 ano, o que indica uma mudança de plano de execução no Postgres. Causas encontradas no código:

- Não há timeout em nenhuma camada: nem `statement_timeout` nas queries, nem `timeout` no axios do `app-cct`. Uma
  consulta que o usuário abandonou continua rodando no banco.
- `ConsolidadoV2Controller` → `VanzeiroAggregatorService`/`ConsorcioAggregatorService` chamam
  `BasePagamentoRepository.findGroupedRows`, que traz todas as linhas do período (cerca de 51 mil em 3 meses e 101 mil
  em 6 meses) para o Node e soma em JS. Com favorecido e consórcio ao mesmo tempo, `ConsolidadoCombinadoService` roda
  isso duas vezes em paralelo.
- `FinancialMovementV2SummaryService.findPage` roda a página e o resumo completo (`findSummary` → `findGroupedRows`)
  em toda chamada, inclusive em cada clique de próxima página. Por isso o tempo é cerca de 2× o do Consolidado.
- Os filtros de período usam `col::date BETWEEN $1::date AND $2::date` (ADR 0005, obrigatório porque as colunas são
  `timestamp` gravadas às 03:00). Esse cast impede o uso de índice comum na coluna. As migrations também não criam
  índice nas chaves de join usadas pela CTE (`detalhe_a."ordemPagamentoAgrupadoHistoricoId"`,
  `ordem_pagamento_agrupado_historico."ordemPagamentoAgrupadoId"` e `ordem_pagamento_agrupado."ordemPagamentoAgrupadoId"`).

## Decisão

1. **Timeout de 120 s nas queries dos relatórios v2** (`SET LOCAL statement_timeout` numa transação só de leitura),
   não global no pool. Quando o Postgres cancela (SQLSTATE `57014`), a API devolve **504** com a mensagem
   "A consulta demorou mais de 2 minutos; reduza o período". No `app-cct`, os relatórios usam timeout de **130 s** no
   axios, e uma nova pesquisa cancela a anterior com `AbortController`.
2. **Consolidado agrega no banco** (`SUM`/`GROUP BY` por favorecido ou consórcio sobre a mesma CTE de
   `buildCombinadoSql`), em vez de `findGroupedRows` mais soma em JS. Paridade obrigatória: os mesmos totais ao centavo,
   e as mesmas linhas e contagens que o caminho atual.
3. **Movimentação Financeira calcula o resumo só na primeira página.** `report/v2/page` (e a equivalente do
   Guardador) calcula o resumo apenas quando não vem cursor; as páginas seguintes trazem só as linhas, e a tela mantém
   os totais da primeira página (`mergeReportList`). O resumo passa a ser calculado em SQL (`SUM`/`COUNT` por status),
   sem trazer as linhas para o Node.
4. **Índices de expressão, não reescrita dos filtros de data.** Índices em `("dataVencimento"::date)`,
   `("dataPagamento"::date)` e `("dataCaptura"::date)`, mais as chaves de join, todos com
   `CREATE INDEX CONCURRENTLY IF NOT EXISTS` numa migration sem transação. Antes, os índices existentes em produção
   são conferidos (`pg_indexes`) para não duplicar índice com outro nome. A SQL dos filtros não muda, então o ADR 0005
   fica intacto.

## Alternativas descartadas

- **Limitar o período na tela/API (6 meses)**: chegou a ser escolhido e foi retirado pela Rayanne na mesma sessão. Vale
  o mesmo motivo do ADR 0016: empurra o problema para uma restrição de uso.
- **Reescrever os filtros como intervalo meio-aberto** (`col >= $1 AND col < $2 + 1`): o resultado é o mesmo, mas
  mexe em cerca de 12 pontos da SQL de pagamento e exige testes de borda do último dia. O índice de expressão alcança
  o mesmo uso de índice sem alterar quais linhas entram.
- **Tela chamar `/summary` e `/page` separadamente**: muda o contrato de `/page` para outros clientes.
- **Aguardar `EXPLAIN ANALYZE` antes dos índices**: a Rayanne preferiu criar agora. Risco aceito: algum índice pode não
  atacar o gargalo real. Medir de novo em produção depois do deploy.

## Consequências

- Uma consulta acima de 120 s passa a falhar com mensagem clara em vez de prender a conexão do banco.
- A exportação (`FinancialMovementV2ExportService.streamBaseRows`) continua reexecutando a CTE inteira a cada lote de
  500 linhas. Fica fora desta decisão, como pergunta em aberto, e só ganha com os índices e o timeout.
- Índices novos aumentam o custo de escrita em `detalhe_a`/`ordem_pagamento_agrupado*` (remessa/retorno). Esse custo
  foi aceito.
