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
Item do combo "Específico" nos relatórios Consolidado e Movimentação Financeira (perfil Permissionário, `app-cct`). Busca em `ordem_pagamento` pelo campo `valorGratuidade` (não nulo), seguindo o agrupamento de gratuidade separado do agrupamento normal: `ordem_pagamento.ordemPagamentoAgrupadoGratuidadeId` → `ordem_pagamento_agrupado` → `ordem_pagamento_agrupado_historico` (ver ADR 0004). O valor exibido é `valorGratuidade`, não o `valor` total da ordem.

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

### Relatório Consolidado e Movimentação Financeira (filtro Específico, Permissionário)

- **STUC - Gratuidade é exclusivo com os demais itens do combo Específico** (Eleição, Desativados, Pendentes) (ADR 0004, 2026-10-09, Rayanne). Selecionar um limpa/desabilita os outros na UI — a query muda de fonte de dados (agrupamento de gratuidade em vez do normal), misturar não tem sentido de negócio.
- **Todos os status principais continuam disponíveis com STUC selecionado** (Todos, A pagar, Aguardando Pagamento, Pago, Pendência de Pagamento, Pendencia Paga) (ADR 0004). Diferente do item Eleição, que já restringe via `ELEICAO_STATUS_CASE`.
- **"OPs atrasadas" não fica disponível como motivo de Pendência de Pagamento quando STUC está selecionado** (ADR 0004). Esse motivo corresponde à query `buildPendentesQuery`, que opera sobre o fluxo normal sem agrupamento e não se aplica à gratuidade.
- **Seleção de usuário "Todos" continua válida com STUC selecionado**; não há exigência de escolher permissionários específicos.
- Datas, Vlr Min./Vlr Max. e a mensagem para "data de pagamento não encontrada" seguem o comportamento padrão já usado pelos demais itens do combo — nenhuma regra nova.
- Escopo: relatórios Consolidado e Movimentação Financeira do perfil **Permissionário** em `app-cct`. Não se aplica a Guardador.

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
