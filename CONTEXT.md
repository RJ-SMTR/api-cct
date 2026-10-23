# api-cct

Memória evolutiva do projeto: o que sabemos, o que foi decidido e o que o trabalho futuro deve lembrar. Comandos e estrutura ficam em [PROJECT.md](PROJECT.md); dívidas técnicas ficam em [docs/TECH-DEBT.md](docs/TECH-DEBT.md).

## Language

Termos do domínio como o código os escreve. Itens marcados _(a confirmar)_ vêm só do código ou de diagramas e ainda não foram validados por pessoa do time. Revisado por Matthew em 2026-09-30.

### Origem dos pagamentos

**Bilhetagem**:
Nome do domínio de pagamento das ordens do transporte público; aparece em `ContaBilhetagem`, `TransacaoView` e na pasta `docs/bilhetagem`.

**Jaé**:
Sistema externo que gera as ordens de pagamento consumidas pela CCT via BigQuery.

**OrdemPagamento** (`ordem-pagamento`):
Espelho local de uma ordem de pagamento vinda do BigQuery: um consórcio ou operador, em um dia (`BigqueryOrdemPagamento`, campo `dataOrdem`).
_Avoid_: OrdemPgto, bqOrdem, BqOrdemPgto (nomes do diagrama e de comentários)

**Sincronismo**:
Passo que copia ordens e transações do BigQuery para o Postgres e associa cada transação a uma ordem. Roda pelo job `sincronizarEAgruparOrdensPagamento`.
_Avoid_: sync, importação

**Consórcio**:
Empresa concessionária que recebe pagamento em conjunto pelas linhas que opera. Lista atual em `CronJobsService.CONSORCIOS`: VLT, Intersul, Transcarioca, Internorte, MobiRio, Santa Cruz, MOBI-Rio BUM, TUSE e GTU.
_Avoid_: empresa (usado só no nome do job `generateRemessaEmpresa`)

**Entidade**:
Organização à qual pertence cada permissionário que não é de um consórcio. Hoje: STPC, STPL e TEC (`CronJobsService.MODAIS`).
_Avoid_: modal (nome usado no código, ver abaixo)

**Permissionário**:
Usuário que presta o serviço e recebe o pagamento. Ou pertence a um consórcio, ou a uma entidade.

**Modal**:
Nome que o código dá às entidades (`CronJobsService.MODAIS`, `HeaderName.MODAL`, `remessaModalExec`). O pagamento dos modais é por favorecido, com agrupamento que soma transações.
_Avoid_: vanzeiros (termo informal; nomeia o job `generateRemessaVanzeiros`)

**ClienteFavorecido**:
Quem recebe o pagamento (pessoa ou empresa), identificado por CPF/CNPJ único. Uma ordem pode gerar vários itens para o mesmo favorecido. Sem dados do favorecido, o item é ignorado até serem preenchidos.
_Avoid_: beneficiário, destinatário

**Pagador**:
Conta de onde sai o dinheiro. Existem três: `CETT` (pagamento único), `ContaBilhetagem` (pagamento normal dos modais e consórcios) e `ContaRotativo` (guardadores). Números de conta ficam em `PagadorContaEnum`, nunca neste arquivo.
_Avoid_: remetente

### Agrupamento

**ItemTransacao**:
Uma ordem de pagamento (ou lançamento) atribuída a um favorecido. Gera, com sucesso, um `DetalheA`; sem `DetalheA`, ainda não foi processado.

**Transacao** e **TransacaoAgrupado**:
`Transacao` representa um pagamento a um favorecido em uma data. `TransacaoAgrupado` agrupa transações por data da ordem CCT e pagador, e representa um arquivo CNAB.

**ItemTransacaoAgrupado**:
Um destinatário a ser pago dentro de um `TransacaoAgrupado`: a soma de todos os `ItemTransacao` dele naquele CNAB.

**OrdemPagamentoAgrupado** (e **Histórico**):
Agrupamento das ordens de pagamento por favorecido para uma data de pagamento; o valor é somado. O Histórico registra cada tentativa de pagamento (cópia) e é o que a remessa lê.
_Avoid_: agrupamento (genérico)

**OPA filha**:
Obrigação original vinculada a uma nova tentativa de pagamento pendente. Preserva as ordens e o histórico de origem, mas não representa um segundo pagamento ao banco.

**OPA pai**:
Tentativa de pagamento pendente que consolida uma ou mais OPAs filhas do mesmo favorecido. É a única representante financeira dessas filhas na remessa.

**STUC - Gratuidade**:
Item do combo "Específico" nos relatórios Consolidado e Movimentação Financeira (perfil Permissionário, `app-cct`). Busca em `ordem_pagamento` pelo campo `valorGratuidade` (não nulo), seguindo o agrupamento de gratuidade separado do agrupamento normal: `ordem_pagamento.ordemPagamentoAgrupadoGratuidadeId` → `ordem_pagamento_agrupado` → `ordem_pagamento_agrupado_historico` (ver ADR 0004). O valor exibido é `valorGratuidade`, não o `valor` total da ordem. Com esse filtro, cada linha do relatório representa uma **Janela de pagamento** (ver abaixo), com colunas por dia (ADR 0012).

**Janela de pagamento**:
Período fixo de dias (3 ou 4, por dia da semana) cujas ordens são pagas juntas numa mesma data de pagamento (`calcularPeriodoPagamento`, ver Regras de negócio "Pagamento"). No filtro STUC - Gratuidade, é a unidade que cada linha do relatório representa; os até-4 dias da janela aparecem como colunas (ADR 0012).

**TransacaoView**:
Visão das transações de bilhetagem por dia. **Legado: ninguém mais usa** (confirmado por Matthew em 2026-09-30); não a use em código novo.

### Remessa e retorno

**Remessa**:
Arquivo CNAB 240 enviado ao banco (Caixa Econômica Federal, código 104) por SFTP com as ordens a pagar. Cada `id_transacao` do dia cria um `HeaderArquivo`.
_Avoid_: envio, arquivo de pagamento

**Retorno**:
Arquivo CNAB devolvido pelo banco com o resultado de cada pagamento. É lido do SFTP a cada 30 minutos (`retornoExec`).

**Extrato**:
Arquivos de extrato bancário devolvidos pelo banco e lidos por `readRetornoExtrato` / `cnabService.readRetornoExtrato`; alimentam `ExtratoHeaderArquivo`, `ExtratoHeaderLote` e `ExtratoDetalheE`.

**HeaderArquivo**, **HeaderLote**, **DetalheA**, **DetalheB**:
Registros do CNAB 240: cabeçalho do arquivo, cabeçalho do lote, detalhe de pagamento (segmento A) e detalhe complementar (segmento B). Um `ItemTransacao` gera um `DetalheA`; o favorecido do `DetalheA` e do `ItemTransacao` é sempre o mesmo. Status do header em `HeaderArquivoStatus`: criado, remessaGerado, remessaEnviado.

**NSA**:
Número sequencial do arquivo de remessa, guardado em settings (`any__cnab_current_nsa`, com variante `_test`). Vai de 1 a 999999 e volta a 1. `getNextNSA` o incrementa e grava.

**NSR**:
Número gerado e associado ao lote enviado na remessa; é sempre novo, nunca se repete. Guardado em settings (`any__cnab_current_nsr_sequence`, `..._last_nsr_sequence`, `..._nsr_date`).

**Ocorrência**:
Código de retorno do banco por pagamento (por exemplo `EA - Excedeu limite de horário`); lista em `ocorrencia.enum.ts`. Erros técnicos são ocultados do usuário por uma mensagem genérica (`Ocorrencia.formatToUserErrors`).

**ArquivoPublicacao**:
Resultado do pagamento de uma ordem a um operador (`idOrdemPagamento`, `idConsorcio`, `idOperadora`), publicado de volta ao sistema externo. É atualizado pela leitura do retorno.
_Avoid_: publicação

### Outros

**Lançamento**:
Pagamento gerado manualmente por pessoa do financeiro, 1 para 1 (não agrupa), com fluxo de aprovação (ver Regras de negócio).
_Avoid_: ordem manual

**Pagamento indevido**:
Valor pago a mais a um favorecido no passado (issue #488), guardado na tabela `pagamento_indevido` com `saldoDevedor`, que abate pagamentos futuros.

**Pagamento pendente**:
Pagamento que já sofreu uma tentativa de pagamento antes e vai ser reprocessado (`remessaPendenteExec`, entidade `pagamentos-pendentes`, campo `ocorrenciaErro`).

**Data Tentativa Pagamento do guardador**:
Data da tentativa registrada na ordem de pagamento agrupada. No relatório de movimentação financeira, cada filha continua sendo exibida em sua própria linha. Para uma consulta de um único dia de `Pendência Paga`, a data vem da filha e a data efetiva da pai seleciona a família. Para uma consulta de um único dia de `Pendência de Pagamento` (`Rejeitado` ou `Estorno`), a data de tentativa da pai seleciona e é exibida para a família; o histórico mais recente da pai determina status e ocorrência, enquanto a filha preserva o valor da linha. Consultas de mais de um dia permanecem orientadas pela data da filha.

**Data Efetiva Pagamento do guardador**:
Data em que a ordem de pagamento agrupada pai foi efetivamente paga. Em uma consulta de `Pendência Paga` para um único dia, essa data seleciona a família pai/filhas e é repetida nas linhas das filhas, sem somar ou repetir seus valores.

**Consulta de família de pagamento no relatório financeiro**:
Para guardadores e permissionários, uma consulta de um único dia de `Pendência Paga` ou `Pendência de Pagamento` seleciona a família pela ordem pai: as linhas continuam no grão das filhas, com seus valores, e usam os dados de tentativa/status/ocorrência apropriados da pai. Uma consulta por intervalo mantém o grão e as datas das filhas.

**Guardador**:
Beneficiário do fluxo de pagamento próprio "guardador": ordens em `ordem-pagamento-guardador`, pagador `ContaRotativo`, `HeaderName.GUARDADOR`, sincronismo `sincronizarOrdensPagamentoGuardador` e relatórios específicos. O significado de negócio não está no código _(a confirmar)_.

**Agente**:
Usuário sincronizado do BigQuery pelo módulo `agentes` (`syncWeeklyAgentUsers`, papel `RoleEnum.agentes`). O significado de negócio não está no código _(a confirmar)_.

**Antifraude**:
Módulo `antifraud`, que gera o alerta enviado aos administradores (`sendAdminFraudAlert`). _(a confirmar)_

**Convite**:
Email enviado ao usuário para concluir o cadastro; estados `queued`, `sent`, `used` (`InviteStatusEnum`).

## Regras de negócio

Fonte entre parênteses. Revisado por Matthew em 2026-09-30 (janelas de pagamento, pagamento manual, entidades, legado); o que ainda não foi validado por pessoa fica marcado _(a confirmar)_. Baseado no código da `main` (commit `c83718e2`).

### Relatório de Movimentação Financeira

- **Pendência Paga é consultada por data de pagamento, em qualquer intervalo** (ADR 0001, 2026-10-07). A consulta principal do relatório (`buildBaseQuery`) filtra por data de vencimento, onde Pendência Paga nunca aparece; uma consulta dedicada (`buildPendenciaPagaSingleDateQuery`, nome desatualizado) sempre trouxe esse status pela data de pagamento com um `BETWEEN`, aceitando intervalo — o antigo gate de "dia único" vivia só em JS (`resolveStatuses`) e no front, e por isso Pendência Paga desaparecia silenciosamente ao selecionar todos os status num intervalo de mais de um dia. Vale só para Movimentação Financeira do Permissionário; o Consolidado do Permissionário não tem essa lógica, e o fluxo de Guardador tem cópia própria (não alterada).
- **Cursor de paginação precisa de tie-breakers além de `(dataReferencia, nomes, status, cpfCnpj)`** (ADR 0002, 2026-10-08). O `GROUP BY` do CTE `grouped` usa mais colunas que essas 4; duas linhas agrupadas podem empatar nessa tupla (ex.: mesmo favorecido pago sob dois `nomeConsorcio` diferentes na mesma data/status), e um limite de página caindo dentro do empate perde linhas silenciosamente. Guardador (`relatorio-guardador-financial-movement.repository.ts`) já ganhou os tie-breakers `nomeConsorcio, codBanco, dataPagamento, codigoErro, email`; Permissionário (**serviço** `relatorio-novo-remessa-financial-movement.service.ts`, não o repository homônimo — esse é código morto, ver ADR 0001) tem o mesmo bug e ainda não foi corrigido (próxima tarefa, mesmo ADR). `nextCursor` deixou de ser opaco para o front por causa disso — o app-cct monta/lê os campos do cursor manualmente e precisa de PR espelhado a cada campo novo.
- **Filtro de valor (`valorMin`/`valorMax`) só é correto se aplicado depois do agrupamento** (ADR 0002, 2026-10-08). Antes do `GROUP BY`, o valor é de um lançamento individual, não o total somado que o relatório exibe e pagina. O serviço do Permissionário já aplicava corretamente (literais neutros substituindo `$6`/`$7` dentro do CTE `base`, filtro real só sobre `grouped`); Guardador aplicava antes (em `guardador-novo-remessa-query-builder.ts`, sobre `da."valorLancamento"`) e foi corrigido para aplicar depois, igual ao Permissionário. Esse ponto já está fechado nos dois fluxos.
- **Estorno/Rejeitado de dia único exige agrupamento pai — registros de primeiro nível somem sem ele** (ADR 0008, 2026-10-21). `buildPendenciaPagamentoTemplate` (dia único, Estorno/Rejeitado) só tinha a branch de família pai/filha (`INNER JOIN` exigindo `opa."ordemPagamentoAgrupadoId"`); uma ordem que nunca teve retentativa (`opa."ordemPagamentoAgrupadoId" IS NULL`) ficava de fora do filtro de dia único, mesmo aparecendo corretamente em intervalos de mais de um dia (via `buildBaseQuery`). Corrigido com uma segunda branch (`UNION ALL`) usando a própria data/status do registro quando não há pai — sem `DISTINCT` (mesmo motivo do ADR 0007).
- **`buildPendenciaPagaTemplate`/`buildPendenciaPagamentoTemplate` também subcontavam por `SELECT DISTINCT` sem `op.id`** (ADR 0010/TD-14, 2026-10-21 — mesmo mecanismo do ADR 0007, agora confirmado também nesses dois fluxos, incluindo a branch de família do item acima). Duas ordens de pagamento distintas do mesmo agrupamento que coincidem em valor eram colapsadas em uma linha: confirmado com dado real (2026-04-02, Pendência de Pagamento → Estorno, `opa.id=253902`), subcontando R$ 313,72 no total do dia para um favorecido. `DISTINCT` removido das duas funções; TD-14 fechado. **Correção (ADR 0011, 2026-10-21): esse diagnóstico estava errado** — `opa.id=253902` não tem 3 lançamentos distintos de R$12,38, tem 1 único lançamento (`da.id=21536`) com 3 ordens de pagamento filhas do mesmo agrupamento (o valor real do grupo é R$12,38, não R$37,14). TD-14 reaberto, ver item abaixo.
- **ADR 0007/0010 removeram o `DISTINCT` errado para o fluxo normal (`AGRUPAMENTO_NORMAL`) e sobrecontam o valor do lote** (ADR 0011, 2026-10-21). O `valor` de `AGRUPAMENTO_NORMAL` é `da."valorLancamento"` — o total do **lote** (`OrdemPagamentoAgrupado`/Histórico, que "soma" as ordens, ver glossário acima) —, não um valor por `ordem_pagamento`. Quando um agrupamento tem N ordens filhas (`op."ordemPagamentoAgrupadoId" = opa.id`, 1:N por design), a query seleciona uma linha por ordem filha mas repete o mesmo `da."valorLancamento"` em cada uma; sem `DISTINCT`, o `SUM` do `GROUP BY` (no CTE `grouped`, ver ADR 0002) soma o mesmo lote N vezes. Confirmado com dado real (banco local, 2026-09-10, Permissionário, Pago): agrupamento com 8 ordens filhas (`opa.id` com `n_orders=8`) tem seu lançamento de R$ 5.548,80 somado 8x; no total do dia, a Movimentação Financeira mostrava R$ 281.131,68 contra R$ 59.212,56 reais (24 lançamentos distintos) — quase 5x a mais. Diferente do caso do ADR 0007 (STUC-Gratuidade, `op."valorGratuidade"` — valor genuinamente por ordem, sem fan-out real naquele teste): aqui o fan-out é real e by-design (um agrupamento normal tem, de fato, múltiplas ordens). Corrigido deduplicando por agrupamento/`detalhe_a` (uma linha representativa por `opa.id`) só na fonte `AGRUPAMENTO_NORMAL`; `AGRUPAMENTO_GRATUIDADE` continua sem dedupe (seu valor é mesmo por ordem). Afeta `buildGroupedQuery` e as duas templates de dia único (`buildPendenciaPagaTemplate`/`buildPendenciaPagamentoTemplate`, mesma fonte `AGRUPAMENTO_NORMAL`). O Consolidado (`RelatorioNovoRemessaConsolidadoRepository.getQueryConsorcios`/`getQueryVanzeiros`) não usa essas funções e não sofria essa sobrecontagem — seu próprio `SELECT DISTINCT (nome, nome2, valor, idLinha)` já colapsava o fan-out por acidente —, mas não tinha o guard `NOT EXISTS (agrupamento filha)`/exclusão de `motivoStatusRemessa IN ('AM','AE')` que as consultas de Pendência Paga do mesmo arquivo já tinham; corrigido para usar o mesmo guard, por defesa em profundidade (não muda o valor total hoje, já descartado por acidente pelo filtro `nome IS NOT NULL`).

### Filtro de período (todos os relatórios Consolidado/Movimentação Financeira)

- **`dataVencimento`/`dataPagamento` são `timestamp` gravados às 03:00:00 (meia-noite de Brasília)** (ADR 0005, 2026-10-19). `getInicioDoDiaBrasilia()` grava meia-noite de Brasília, que em UTC (coluna sem timezone) é `03:00:00`. Um `BETWEEN $1 AND $2` sem cast, com `$1`/`$2` em `'yyyy-MM-dd'`, compara contra `00:00:00` e exclui silenciosamente o registro do último dia do período — corrigido com `coluna::date BETWEEN $1::date AND $2::date` (cast na coluna **e** nos parâmetros; só nos parâmetros não resolve, o Postgres promove de volta para `timestamp`). `dataOrdem` (`ordem_pagamento` e `ordem_pagamento_guardador`) é `date` puro e não tem esse problema — não confundir os dois ao investigar bugs de data nos relatórios.
- **Escopo do bug corrigido**: `buildGroupedQuery`/`buildBaseQuery`/`buildStucGratuidadeQuery` e `buildEleicaoQuery` (`novo-remessa-query-builder.ts`), e `buildGuardadorBaseQuery` (`guardador-novo-remessa-query-builder.ts`). Afetava a busca normal de Movimentação Financeira (Permissionário e Guardador) e Consolidado Guardador; o Consolidado Permissionário só era afetado no filtro STUC-Gratuidade (sua busca normal usa queries próprias já corretas).

### Relatório Consolidado e Movimentação Financeira (filtro Específico, Permissionário)

- **STUC - Gratuidade é exclusivo com os demais itens do combo Específico** (Eleição, Desativados, Pendentes) (ADR 0004, 2026-10-09, Rayanne). Selecionar um limpa/desabilita os outros na UI — a query muda de fonte de dados (agrupamento de gratuidade em vez do normal), misturar não tem sentido de negócio.
- **Todos os status principais continuam disponíveis com STUC selecionado** (Todos, A pagar, Aguardando Pagamento, Pago, Pendência de Pagamento, Pendencia Paga) (ADR 0004). Diferente do item Eleição, que já restringe via `ELEICAO_STATUS_CASE`.
- **"OPs atrasadas" não fica disponível como motivo de Pendência de Pagamento quando STUC está selecionado** (ADR 0004). Esse motivo corresponde à query `buildPendentesQuery`, que opera sobre o fluxo normal sem agrupamento e não se aplica à gratuidade.
- **Seleção de usuário "Todos" continua válida com STUC selecionado**; não há exigência de escolher permissionários específicos.
- Datas, Vlr Min./Vlr Max. e a mensagem para "data de pagamento não encontrada" seguem o comportamento padrão já usado pelos demais itens do combo — nenhuma regra nova.
- Escopo: relatórios Consolidado e Movimentação Financeira do perfil **Permissionário** em `app-cct`. Não se aplica a Guardador.
- **Colunas de dia da janela de pagamento** (ADR 0012, 2026-10-23, Rayanne). Cada linha do relatório passa a representar uma Janela de pagamento de um favorecido, com até 4 colunas (`dataOrdemPagamento1..4`/`valorOrdemPagamento1..4`) — uma por dia da janela, com a data de referência/vencimento da ordem daquele dia e a soma do `valorGratuidade` naquele dia. Janela de 3 dias (terça-quinta) deixa a 4ª coluna vazia. A coluna "Valor" existente passa a representar a soma da janela (deixa de ser um total geral do favorecido no Consolidado). Pendência de Pagamento deriva a janela pela própria data de referência da ordem (mesma regra `calcularPeriodoPagamento`), já que ainda não tem `dataPagamento`. Sem overflow: a janela nunca passa de 4 dias, então nunca precisa de linha extra — múltiplas janelas no período geram múltiplas linhas, como já é hoje.

### Pagamento

- **Janelas de pagamento.** Ordens de sexta a segunda são pagas na terça seguinte; ordens de terça a quinta são pagas na sexta seguinte (`calcularPeriodoPagamento`, `src/cron-jobs/cron-jobs.service.ts`). Vale para modais e consórcios (confirmado por Matthew em 2026-09-30).
- **Sincronismo e agrupamento** rodam de hora em hora entre 09:00 e 21:00 GMT (06:00 a 18:00 BRT), com lock distribuído para não haver duas execuções ao mesmo tempo. Há um job para modais e outro para guardadores.
- **A geração de remessa não é automática.** Os jobs `generateRemessaVLT` (corpo vazio), `generateRemessaVanzeiros` e `generateRemessaEmpresa` (chamadas comentadas) não geram remessa.
- **Processo manual de pagamento** (débito técnico, TD-9) _(confirmado por Matthew em 2026-09-30)_: no dia de pagamento coloca-se uma chamada em `onModuleLoad` de `CronJobsService` (`remessaModalExec`, `remessaGuardadorExec` ou `remessaConsorciosExec`), faz-se o deploy (a remessa roda quando o app sobe) e depois remove-se a chamada. **Por padrão `onModuleLoad` não chama geração de remessa**: a linha `await this.remessaModalExec(true)`, que existia na `main` em `c83718e2` e gerava remessa dos modais a cada boot, foi removida em 2026-09-30 (pedido de Matthew). `remessaPendenteExec` reprocessa pendentes por `GET .../financial-movement` (`src/pendentes/pagamento-pendente.controller.ts`).
- **Escopo de cada gatilho** (estado da `main`): `remessaModalExec` e `remessaGuardadorExec` trabalham com o dia de hoje; `remessaConsorciosExec` só roda na terça ou na sexta e usa o intervalo de 4 (terça) ou 3 (sexta) dias atrás até ontem. `remessaGuardadorExec` apaga os agrupamentos do dia antes de gerar (`limparAgrupamentos`); nos outros dois essa chamada está comentada.
- **Pagamento único** (`pagamentoUnico`): usa o pagador `CETT`, pula o agrupamento em `geradorRemessaExec` e seleciona as ordens por `getOrdensUnicas`.
- **Agrupamento de ordens.** Agrupa por favorecido e `TransacaoAgrupado`; a data da ordem do BigQuery é ignorada e usa-se o dia de pagamento (ou da tentativa); o valor é somado (diagrama `cct dados conceitual`). Serve para não repetir no extrato as inúmeras transações dos vanzeiros.
- **Sincronismo de transações com ordens.** Cada transação é associada à primeira ordem: ordem de D1, depois D2, depois D3 a D6; havendo duplicidade, vale a criada mais recentemente (`ItemTransacao.id` maior); ordens canceladas (status 5) são ignoradas (`docs/bilhetagem/sincronismo`).
- **Pagamento indevido.** Ao surgir nova ordem, o valor primeiro é abatido do saldo em `pagamento_indevido`; só o que sobrar sai dos fundos da Prefeitura; o favorecido vê a mensagem "T1 - Pagamento indevido" (`docs/bilhetagem/pagamentos-indevidos`; a remessa consulta o saldo por nome do favorecido em `PagamentoIndevidoService.findByNome`).
- **Retorno e extrato** são lidos do SFTP a cada 30 minutos (`*/30 * * * *`). O retorno é casado com o `DetalheA` pelo CPF/CNPJ do `DetalheB` e pelo valor do lançamento, e não por id. Pelos comentários do código, não devem rodar enquanto a remessa é gerada.

### Lançamento financeiro

- **Datas padrão:** dia 05 (1ª quinzena) e dia 20 (2ª quinzena) (`docs/lancamento/requisito`).
- **Status** (`LancamentoStatus`): gerado → autorizado parcial (1ª aprovação) → autorizado (2ª aprovação) → remessa enviado → pago; ou erro; ou cancelado. Ler retorno decide entre pago e erro (`docs/lancamento/estado`).
- **Papéis:** lançador financeiro cria e edita/deleta lançamentos em `gerado`; aprovador financeiro autoriza (1ª e 2ª vez) e edita/deleta os `autorizado parcial` e `autorizado`; admin master tem tudo (`docs/lancamento/caso-de-uso`, sem os nomes).
- **Envio:** o cron de remessa na data do lançamento envia; hoje esse cron não está ativo (ver "A geração de remessa não é automática").

### Usuários

- **Ciclo do usuário:** register → upload de planilha → concluir cadastro → ativo/inativo. **Histórico de email (convite):** queued → sent → used; reenvio pelo cron `bulkResendInvites` todo dia 15 às 11:45 BRT; `bulkSendInvites` usa a cron das settings e `bulkSendInvitesFixedTime` roda todo dia às 10:30 GMT (`docs/bilhetagem/estado-usuario-historico-email.drawio`).
- **Upload de planilha (`POST /users/upload`) mitigado, não corrigido, contra as CVEs do `xlsx`** (ADR 0003, 2026-10-08). `xlsx.read`/`sheet_to_json` (`users.service.ts`) parseiam um arquivo controlado por quem faz upload; o pacote `xlsx` tem CVEs de Prototype Pollution/ReDoS sem fix no npm (TD-11). Mitigação: limite de 10 MB no `FileInterceptor`, sniff real de conteúdo (não só o `mimetype` do client, hoje falsificável) antes do parse, e isolamento do parse em `worker_thread` com timeout de 10s (necessário porque `xlsx.read` é síncrono e bloqueia a thread única do Node — um timeout sem worker não interrompe o bloqueio). O endpoint exige JWT mas não tem `@Roles`; se deveria restringir a admin ficou como pergunta em aberto, não resolvida aqui.
- **Data dos dados bancários** (`user.bankDataUpdatedAt`, issue #1192): gravada sempre que o valor de `bankCode`, `bankAgency`, `bankAccount` ou `bankAccountDigit` muda de fato, inclusive no primeiro preenchimento; reenviar o mesmo valor não conta. `previousBankCode` continua sendo preenchido só na troca de banco. Na tela de Dados Bancários: sem `previousBankCode` → "Primeiro cadastro realizado em: `bankDataUpdatedAt`"; com `previousBankCode` → "Banco anterior" + "Última atualização em: `bankDataUpdatedAt`"; coluna `null` (nunca preencheu) → nenhuma data.

## Arquitetura em camadas

A `main` é organizada por feature (`src/users`, `src/cnab`, `src/cron-jobs`...). A direção dos imports vale pelo **papel do arquivo**, dado pelo sufixo: `controller → service → repository`, e `utils` não depende dos três. Proibido:

- `*.controller.ts` importar `*.repository`
- `*.service.ts` ou `*.repository.ts` importar `*.controller`
- `*.repository.ts` importar `*.service` (12 imports em 9 arquivos hoje, aceitos como legado na baseline: TD-8)
- `src/utils/**` importar controller, service ou repository

Não são impostos: acesso direto ao banco (`InjectRepository`, `DataSource`, `createQueryBuilder`) fora de repositories e imports entre features.

## Áreas frágeis

- **Testes.** Em 2026-09-30, dos 42 specs do app 25 passam, 13 falham (TD-1) e 4 estão ignorados. Cobertos: agentes, antifraude, mail, relatórios do novo-remessa e `retorno.service`. Sem teste funcionando: `cron-jobs.service`, cliente SFTP, extrato bancário e receitas de bilhetagem. Mudanças em pagamento pedem testes antes e cuidado extra na revisão.
- **Specs desabilitados de propósito.** `cron-jobs.service.spec.ts` (ignorado) e o cliente SFTP (8 blocos em `xdescribe`): SFTP e cron jobs nunca terão testes automatizados (TD-6, descartado). O gate também não enxerga testes pulados dentro de suítes que passam (TD-7).
- **Código de pagamento em desenvolvimento ativo** (commits de 2026-09-29): o sincronismo de guardadores usa data fixa (`new Date('2026-09-29')`); o job `sincronizarEAgruparOrdensPagamentoGuardador` chama o método dos modais; em `submitCnabRemessa` o `return` está num `finally` e o caminho é definido antes do upload, então uma falha de upload pode deixar o header como `remessaEnviado`. São observações do código, não decisões.
- **Lógica antiga de "sexta de pagamento" semanal é legado** (confirmado por Matthew em 2026-09-30: ninguém mais usa). A regra vigente é terça e sexta (`calcularPeriodoPagamento`). O código antigo ainda existe (`nextFriday` em `src/utils/payment-date-utils.ts`, DTOs, entidades, extrato e receitas): não o use como referência nem o estenda em código novo.
- **`RemessaService.prepararRemessa` não aguardava `atualizaStatusRemessa`** (ADR 0006, 2026-10-19), nem este aguardava `saveStatusHistorico` — 4 floating promises num loop sequencial. Já era contornado em `remessa-retorno.integration.spec.ts` por um helper de polling (`esperarStatusPai`) com comentário explícito sobre a causa. Corrigido com `await` nos 4 pontos; nenhuma mudança de assinatura ou regra de negócio. Não havia nenhum spec para `remessa.service.ts` antes desta correção.
- **Trigger `user_update_trigger` em `"user"`** (fora das migrations; capturado em `local_dev_example/sql/prod-routines.sql`): grava cada UPDATE em `user_changes_log`. A função `user_update_function` usa `OLD.permitCode` sem aspas e quebra com `record "old" has no field "permitcode"`; no banco local, com essa versão, todo UPDATE em `"user"` falha (visto em 2026-10-09). Não confirmado se produção tem a mesma função ou o trigger desativado. Migrations que fazem UPDATE em massa em `"user"` devem desativar o trigger e restaurar o estado (ex.: `1791300000000-AddBankDataUpdatedAtToUser`).

## Decisões

- **Validação por ratchet, não por limpeza** (2026-09-30, Matthew). A base tem falhas (13 suítes, 276 erros de eslint); o gate impede que piore, sem exigir consertar tudo antes. O custo dessa escolha está em TD-4.
- **Base do trabalho:** a `main` é a branch principal e a `homol` a secundária (2026-09-30, Matthew). O CI de validação cobre `main`, `homol` e `hmg`.
- **Sem testes para SFTP e cron jobs, nunca** (2026-09-29, Matthew). Cobertura futura do fluxo de pagamento deve mirar os serviços de `src/cnab/novo-remessa/`.
- **Política de testes:** lógica de negócio nova ou alterada exige spec ao lado, com TDD; depois rode `npm run validate:update-baseline` para o gate proteger o teste novo (2026-09-30, Matthew).
- **Fronteiras de arquitetura com `no-restricted-imports` do ESLint, por sufixo de arquivo** (2026-09-30, Matthew), não `dependency-cruiser` nem teste próprio: zero dependências novas e as violações existentes entram na baseline de eslint. Limite conhecido: o casamento é pelo texto do import, e um erro novo pode ser compensado se o mesmo arquivo corrigir outro erro de eslint no mesmo commit.
- **Limites do agente: bloquear o destrutivo, pedir confirmação para o arriscado** (2026-09-30, Matthew), em `.claude/settings.json` versionado. Não é sandbox: a negação de leitura vale só para a ferramenta de arquivos, não para `cat`/`grep` no shell. Node fixado em 18.16.0. `env-example` mantém o nome porque `docker-compose.ci.yaml` e o CI e2e o usam.
- **Hook local** roda só build e specs relacionados aos arquivos staged; prettier não é imposto e eslint fica no CI.
- **Documentos de trabalho do fluxo de IA** (`docs/PRD.md`, `docs/TASKS.md`, `docs/tasks/`, `docs/task-runs/`, `docs/archive/`) ficam fora do git. `CONTEXT.md`, `docs/adr/` e `docs/TECH-DEBT.md` são versionados.
- **Trabalho refeito sobre a `main`** (2026-09-30): uma primeira versão foi feita sobre a `master`, que tem outra estrutura de pastas; foi descartada e refeita a partir da `main`.
- **Uma única coluna de data bancária** (2026-10-09, Matthew, #1192). Rejeitado: duas colunas (`bankDataCreatedAt` + `bankDataUpdatedAt`). Limitação aceita: quem altera só agência/conta/dígito, sem trocar o banco, continua vendo "Primeiro cadastro realizado em", agora com a data dessa alteração. Backfill: `updatedAt` para quem tem `previousBankCode` e `createdAt` para quem tem dados bancários sem `previousBankCode` (as datas que a tela já mostrava), então a data de quem tinha `previousBankCode` é aproximada.

## Perguntas em aberto

- Significado de negócio de guardador, agente e antifraude _(a confirmar)_.
- O workflow `validate.yaml` ainda não rodou no GitHub; falta um PR de teste e configurar o check como obrigatório na proteção de branch.
