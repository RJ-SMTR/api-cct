# RN-0047: Plano de teste dos relatórios, derivado das RN-0001 a RN-0029

Área: Relatórios (Movimentação Financeira, Consolidado, STUC-Gratuidade, Eleição, Extrato Bancário; perfis Permissionário e Guardador; rotas legadas e v2)
Fonte: RN-0001 a RN-0029, ADR 0021 e ADR 0022, 2026-11-09

Cada caso abaixo sai de uma regra registrada. O **resultado esperado vem da regra, não do código
atual**: se o código divergir, o caso reprova e o bug é do código (ou a regra precisa ser revista
por quem decide o domínio, com um novo RN). Vale para o relatório legado e para a reescrita v2,
que tem como alvo de paridade o comportamento já corrigido (ADR 0022, decisão 5).

## Como executar

| Camada | Comando | Banco | Situação em 2026-11-09 |
| --- | --- | --- | --- |
| U: unitários da API | `npx jest src/relatorio` | não usa | 20 suítes aprovadas, 402 testes aprovados |
| I: integração da API | `RUN_RETORNO_DB_TESTS=1 npx jest src/relatorio` | Postgres **local** | **não executado**; são as 9 suítes e 114 testes que ficam pulados sem a variável |
| E: e2e da API | `npm run test:e2e` | Postgres e maildev | **não executado** |
| F: testes do front | em `app-cct`: `CI=true npm test -- --watchAll=false src/app/store src/app/main/pages/admin/Report` | não usa | 6 suítes e 38 testes aprovados |
| M: manual ou homologação | seção "Validação com dados reais" | hml ou produção, só leitura | não executado |

Verde em U não prova as regras de valor: várias só verificam o texto do SQL. As regras de soma,
fan-out e paridade com o legado só ficam provadas em I. **Rode I antes de qualquer cutover da v2.**

Nomes curtos dos specs, todos em `src/relatorio/` salvo indicação:

- `consolidado.spec`: `novo-remessa/relatorio-novo-remessa-consolidado.repository.spec.ts`
- `builder.spec`: `novo-remessa/queries/novo-remessa-query-builder.spec.ts`
- `guardador-builder.spec`: `novo-remessa/queries/guardador-novo-remessa-query-builder.spec.ts`
- `fm-service.spec`: `movimentacao-financeira/relatorio-novo-remessa-financial-movement.service.spec.ts`
- `fm-integ`: `movimentacao-financeira/relatorio-novo-remessa-financial-movement.integration.spec.ts`
- `guardador-fm.spec`: `movimentacao-financeira/relatorio-guardador-financial-movement.repository.spec.ts`
- `base-integ`: `movimentacao-financeira-v2/base/base-pagamento.repository.integration.spec.ts`
- `stuc-integ`: `movimentacao-financeira-v2/stuc-gratuidade/stuc-gratuidade.repository.integration.spec.ts`
- `vanzeiro-integ`: `consolidado-v2/vanzeiro-aggregator.service.integration.spec.ts`
- `pivot.spec`: `utils/stuc-gratuidade-pivot.spec.ts`
- `extrato.spec`: `extrato-bancario/relatorio-extrato-bancario.repository.spec.ts`

Estados: **coberto** (há teste da regra e ele passou), **coberto, falta rodar** (o teste é I ou E),
**parcial** (falta parte da regra), **aberto** (a regra ainda não está atendida), **a confirmar**
(falta decisão de negócio).

## Casos por regra

### Movimentação Financeira

| Caso | RN | Cenário | Resultado esperado | Cobertura | Estado |
| --- | --- | --- | --- | --- | --- |
| CT-01 | 0001 | Permissionário, Pendência Paga, intervalo de vários dias | Traz as linhas pela data de pagamento, sem exigir dia único, também com todos os status marcados | `fm-service.spec` "Pendencia Paga status filter"; `base-integ` (T5) | parcial: **o e2e contradiz a regra**, ver "Divergências" |
| CT-02 | 0002 | Paginar um resultado com empate na tupla (dataReferencia, nomes, status, cpfCnpj), nos dois perfis | Nenhuma linha perdida ou repetida entre páginas; cursor antigo de 4 colunas continua aceito | `fm-service.spec` "tie-breaker cursor"; `base-integ` "Keyset pagination" | coberto (legado); coberto, falta rodar (v2) |
| CT-03 | 0003 | `valorMin`/`valorMax` onde o lançamento individual fica fora da faixa e o total agrupado fica dentro, e o inverso | A faixa vale sobre o total agrupado, nos dois perfis | `guardador-builder.spec` ($6/$7); `base-integ` "after grouping" | coberto, falta rodar |
| CT-04 | 0004 | Dia único, Estorno/Rejeitado, ordem sem retentativa (`ordemPagamentoAgrupadoId` nulo) | A linha aparece, tanto em dia único quanto em intervalo | `builder.spec` "has no parent"; `base-integ` "Estorno sem agrupamento pai" | coberto |
| CT-05 | 0005 | Agrupamento normal com N ordens filhas, Pago | O valor do lote conta uma vez. Gratuidade **não** deduplica, pois o valor é por ordem | `builder.spec` "uma ordem por agrupamento"; `base-integ` "counts the lote value once" | coberto |

### Período e status

| Caso | RN | Cenário | Resultado esperado | Cobertura | Estado |
| --- | --- | --- | --- | --- | --- |
| CT-06 | 0006 | Lançamento às 03:00:00 no último dia do período | Entra no resultado (cast `::date` na coluna e nos parâmetros) | `builder.spec` e `guardador-builder.spec` "período"; `base-integ` "last day" | coberto |
| CT-07 | 0007 | A Pagar com ordem nunca enviada e ordem com `statusRemessa` 0 ou 1, no Consolidado e na Movimentação, nos dois perfis, Eleição e STUC | Soma as duas populações, sem status separado e sem duplicar | `consolidado.spec` "(ADR 0017)"; `fm-integ` "union"; `base-integ` "union" | coberto; confronto de totais em M-01 |
| CT-08 | 0008 | Consórcio específico (VLT, Internorte, Santa Cruz) | O CNPJ institucional aparece, e o total bate com o Consolidado | `builder.spec` "hasConsorcioFilter"; `base-integ` "consorcio especifico" | coberto |
| CT-09 | 0009 | Eleição, ordem sem `idOperadora`, CPF do usuário existente | Aparece pelo fallback de `cpfCnpj`, usado só quando nenhum usuário tem o `permitCode` | `builder.spec` "falls back"; `base-integ` "Eleição (T7)" | coberto; total em M-02 |
| CT-10 | 0010 | Rejeitado com pagamento posterior bem-sucedido, em dia único e em intervalo | Não aparece em nenhum dos dois relatórios | `fm-service.spec` "retry-aware"; `base-integ` "Rejeitado corrigido" | coberto |

### Consolidado Permissionário

| Caso | RN | Cenário | Resultado esperado | Cobertura | Estado |
| --- | --- | --- | --- | --- | --- |
| CT-11 | 0011 | `valorMax` que elimina todos os consórcios e deixa só vanzeiros | O total é a soma dos vanzeiros, não zero | `consolidado.spec` "does not zero the total" | coberto |
| CT-12 | 0012 | Filha paga com mais de uma linha em `detalhe_a` | Conta uma vez | `consolidado.spec` "umaLinhaPorFilhaPaga"; `fm-integ` "several old attempt lines" | coberto |
| CT-13 | 0013 | Filha paga sem `detalhe_a` (PASSO 0) | Aparece, com o valor da filha e a data de pagamento do pai | `consolidado.spec` "PASSO 0"; `fm-integ` | coberto |
| CT-14 | 0014 | STUC, só Pendência Paga | Não devolve o total de Todos; a consulta principal não contribui | `consolidado.spec` "(AND FALSE)" | coberto |
| CT-15 | 0021 | Janela de 90 dias, Todos os status | HTTP 200, totais iguais à reconstrução no banco | `consolidado.spec` "uma ordem por agrupamento (ADR 0016)"; `vanzeiro-integ` "90 days" | parcial: U só verifica o SQL; prova de memória em M-03 |
| CT-16 | 0022 | Busca nova que falha; paginação que falha | Em qualquer erro, a tabela não exibe dados de outro filtro como se fossem atuais | nenhum teste automatizado | parcial, ver "Divergências" |

### STUC-Gratuidade

| Caso | RN | Cenário | Resultado esperado | Cobertura | Estado |
| --- | --- | --- | --- | --- | --- |
| CT-17 | 0015 | Selecionar STUC com Eleição, Desativados ou Pendentes marcado; abrir os motivos de Pendência de Pagamento | Selecionar um item limpa ou desabilita os outros; "OPs atrasadas" não fica disponível; todos os status principais e favorecido Todos continuam válidos | Back: `fm-service.spec` "never includes the Pendentes", `stuc-integ`. Front: nenhum | parcial: exclusividade na tela só em teste manual |
| CT-18 | 0016 | Janela sexta a segunda e janela terça a quinta; duas janelas do mesmo favorecido | Até 4 colunas de dia; Valor é a soma da janela; janela de 3 dias deixa a 4ª vazia; cada janela é uma linha | `pivot.spec`; `consolidado.spec` e `fm-service.spec` "payment window"; `stuc-integ` | coberto |
| CT-19 | 0017 | Dia sem lançamento dentro da janela, na tela e no export | Mostra a data real com valor 0; só a posição inexistente fica vazia | `pivot.spec`; `fm-service.spec` "explodes each day"; `stuc-integ` | coberto |
| CT-20 | 0018 | Ordens do mesmo lote em dias diferentes | Cada ordem cai na coluna do próprio dia, não na data do lote | `consolidado.spec` "dataReferencia é por dia"; `stuc-integ` "mesmo lote" | coberto |

### Favorecido, cadastro e Guardador

| Caso | RN | Cenário | Resultado esperado | Cobertura | Estado |
| --- | --- | --- | --- | --- | --- |
| CT-21 | 0019 | Movimentação sem favorecido selecionado, comparada a "Todos" marcado | Mesmo resultado, com a mesma exclusão dos 6 CNPJs | `fm-service.spec` "nenhum selecionado" | coberto |
| CT-22 | 0020 | Favorecido = Todos sem consórcio; Consórcio = Todos; consórcio comum específico | O primeiro traz só STPC/STPL/TEC (sem VLT); os outros trazem os consórcios e batem com o Consolidado | `builder.spec` "modais" e "hasConsorcioFilter"; `fm-service.spec` "Consórcio = Todos"; `base-integ` (T3) | coberto; total em M-06 |
| CT-23 | 0023 | Consolidado Guardador combinando Pago, A Pagar, Em processamento e Pendência de pagamento | Um card por status, sem exclusividade e sem `pago=false` | `relatorio-novo-remessa.service.spec.ts` "combining pago"; `agentConsolidatedReportUtils.test.js` | coberto; bloco próprio de Em processamento + erros sem teste específico |
| CT-24 | 0024 | Dois usuários ativos com o mesmo CPF, em cada consulta que liga `"user"` por `cpfCnpj` | Uma ordem nunca vira duas linhas | Eleição: `base-integ` "duplicate CPF". Consolidado e Movimentação legados: nenhum | **aberto** nos legados (`relatorio-novo-remessa-consolidado.repository.ts:178,184`, `relatorio-novo-remessa-movimentacao.repository.ts:247,254`); o teste deve nascer vermelho |

### Extrato Bancário

| Caso | RN | Cenário | Resultado esperado | Cobertura | Estado |
| --- | --- | --- | --- | --- | --- |
| CT-25 | 0025 | `GET /cnab/relatorio/extrato` com `dataFim` anterior a `dataInicio` | HTTP 400, sem consultar o banco | `extrato.spec` "rejeita", sem teste HTTP | coberto na camada de repositório |
| CT-26 | 0026 | `conta` = `cett`, outro valor, ausente | Hoje: `loteServico` 1 para `cett`, 2 para os demais. Validar se ContaBilhetagem e ContaRotativo podem ficar juntas | integração do extrato | a confirmar |
| CT-27 | 0027 | Período com vários arquivos de retorno | Hoje: cada linha traz o saldo do seu lote. Validar se o front exibe saldo corrente | nenhum | a confirmar |
| CT-28 | 0028 | Token válido de usuário sem papel administrativo | Definir: 403 ou 200. Hoje só exige JWT | nenhum | a confirmar |
| CT-29 | 0029 | `operacao` com texto exato e com variação de caixa | Hoje: comparação exata. Validar a origem das opções do filtro | integração do extrato | a confirmar |

## Validação com dados reais

Somente leitura. Os valores são as referências registradas nas RNs, medidas na data indicada; se o
dado do ambiente mudou, refazer a reconstrução no banco antes de comparar.

| Caso | RN | Filtro | Referência |
| --- | --- | --- | --- |
| M-01 | 0007 | Produção, Permissionário, Favorecido = Todos, A Pagar, 02/11 a 06/11/2026 | R$ 2.014.192,08, soma de R$ 1.427.881,70 (nunca enviada) e R$ 585.390,38 (aguardando retorno), iguais nas duas telas |
| M-06 | 0020 | hml, Permissionário, Pago, Favorecido = Todos, 01/09 a 01/10/2026 | Consolidado e Movimentação batem em R$ 33.821.587,53 |
| M-02 | 0009 | Eleição, nov/2024 | R$ 830.180,00 |
| M-03 | 0021 | Consolidado Permissionário, Todos os status, 01/06 a 31/08/2026 | HTTP 200, total igual à reconstrução no banco |
| M-04 | 0005 | Banco local, Permissionário, Pago, 10/09/2026 | R$ 59.212,56 no dia |
| M-05 | 0018 | STUC, CPF 00054892708, lançamentos de 13 a 15/10, pagos em 16/10 | Três colunas, uma por dia, sem somar outro lote |

## Divergências encontradas ao montar o plano

- **RN-0001 x e2e**: `test/relatorio/financial-movement.e2e-spec.ts:153` espera **0 linhas** para
  Pendência Paga em intervalo, o oposto da RN-0001 e do `fm-service.spec`. O e2e está
  desatualizado e deve ser corrigido; não é o resultado esperado. A RN-0001 também diz que o
  Consolidado Permissionário não tem essa lógica, mas ele passou a consultar por data de
  pagamento (RN-0011 a RN-0014).
- **Regras com estado desatualizado**: RN-0002 (o Permissionário já tem os tie-breakers), RN-0023
  (os três pontos já estão corrigidos) e RN-0025 (o repositório já rejeita o intervalo invertido)
  ainda descrevem o problema como aberto.
- **RN-0022, correção parcial**: uma busca nova limpa a tabela antes de consultar, mas o `.catch`
  de `submitPagePermissionario` (`ConsolidatedReportPage.js`) não limpa nada, então uma falha na
  **paginação** mantém a página anterior na tela.
- **RN-0009** aponta "ver RN-0030" para o `cpfCnpj` não único; a regra certa é a RN-0024.

## Critério de aprovação

- U, I, E e F passam, e o e2e da RN-0001 foi corrigido.
- CT-24 está corrigido ou registrado como risco aceito em `docs/TECH-DEBT.md`.
- CT-26 a CT-29 têm decisão de negócio.
- M-01 a M-06 foram conferidos no ambiente indicado, e a v2 só substitui o legado com esses
  totais iguais nas duas rotas.
