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

## Perguntas em aberto

- Significado de negócio de guardador, agente e antifraude _(a confirmar)_.
- O workflow `validate.yaml` ainda não rodou no GitHub; falta um PR de teste e configurar o check como obrigatório na proteção de branch.
