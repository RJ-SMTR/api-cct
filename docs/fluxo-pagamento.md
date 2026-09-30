# Fluxo de pagamento

Sequência ponta a ponta do pagamento a consórcios, entidades (modais) e guardadores, com o arquivo e o método de cada etapa. Significado dos termos e regras em [CONTEXT.md](../CONTEXT.md). Fontes: código da `main` lido em 2026-09-30 (commit `c83718e2`) e confirmação de Matthew. Esta área está em desenvolvimento ativo (há commits de geração de remessa de 2026-09-29); confira o código antes de confiar em detalhes.

```
BigQuery ─(1)→ OrdemPagamento ─(2)→ OrdemPagamentoAgrupado ─(3 gatilho manual)→ (4) prepararRemessa
   → (5) gerarCnabText → (6) enviarRemessa → SFTP → banco → SFTP → (7) retornoExec → (8) extrato
```

## Estado atual: o que roda sozinho e o que não

Arquivo: `src/cron-jobs/cron-jobs.service.ts`. Horários em GMT (BRT = GMT-3).

| Job (`CronJobsEnum`) | Agenda | Situação |
| --- | --- | --- |
| `sincronizarEAgruparOrdensPagamento` | `0 9-21 * * *` | ativo: sincroniza e agrupa (modais), **não** gera remessa |
| `sincronizarEAgruparOrdensPagamentoGuardador` | `0 9-21 * * *` | ativo, mas o `onTick` chama o método dos **modais** (ver "Cuidados") |
| `updateRetorno` | `*/30 * * * *` | ativo: lê retorno do SFTP |
| `updateExtrato` | `*/30 * * * *` | ativo: lê extrato do SFTP |
| `generateRemessaVLT` | `0 12 * * *` | **corpo vazio** (só retorna no fim de semana) |
| `generateRemessaVanzeiros`, `generateRemessaEmpresa` | sexta 13:00 e 12:00 | **desligados**: chamadas comentadas |
| `syncWeeklyAgentUsers`, `syncWeeklyAgentUsers2` | `0 10 * * *` e `0 22 * * *` | sincronizam agentes do BigQuery |
| `backupSftp` | `0 23 * * *` | `fullBackup` do SFTP |
| `sendAdminFraudAlert` | setting `any__mail_admin_fraud_cronjob` | alerta de antifraude |
| `bulkSendInvites`, `bulkSendInvitesFixedTime` (`30 10 * * *`), `bulkResendInvites` (`45 14 15 * *`), `sendReport`, `pollDb` | ver o arquivo | fora do fluxo de pagamento |

A remessa é disparada **manualmente** (TD-9): no dia de pagamento, alguém coloca uma chamada em `onModuleLoad` (`remessaModalExec`, `remessaGuardadorExec` ou `remessaConsorciosExec`), faz o deploy (a remessa roda quando o app sobe) e depois remove a chamada. **Por padrão `onModuleLoad` não chama nenhuma geração de remessa**: a linha `await this.remessaModalExec(true)`, que existia na `main` em `c83718e2` e rodava a cada boot, foi removida em 2026-09-30. Não deixe esse tipo de chamada em `onModuleLoad` sem pedido explícito, pois cada restart ou deploy reexecutaria a geração.

## Etapas

### 1. Sincronismo com o BigQuery
- **Gatilho:** os dois jobs de sincronismo, que chamam `executarSincronizacaoEAgrupamento(tipo)` com lock distribuído (`acquireLock` em `src/cnab/novo-remessa/service/distributed-lock.service.ts`, chave por tipo).
- **Período:** `calcularPeriodoPagamento`. De sexta a segunda, início na sexta, fim na segunda, pagamento na terça; de terça a quinta, início na terça, fim na quinta, pagamento na sexta.
- **Métodos:** `OrdemPagamentoService.sincronizarOrdensPagamento` (consórcios e modais) e `sincronizarOrdensPagamentoGuardador` (guardadores), em `src/cnab/novo-remessa/service/ordem-pagamento.service.ts`.
- **Dados:** `OrdemPagamento` a partir de `BigqueryOrdemPagamento`; para guardadores, a entidade do repositório `ordem-pagamento-guardador`.

### 2. Agrupamento
- **Método:** `OrdemPagamentoAgrupadoService.prepararPagamentoAgrupados` (`src/cnab/novo-remessa/service/ordem-pagamento-agrupado.service.ts`).
- **Pagadores:** `contaBilhetagem` para modais, `contaRotativo` para guardadores (`src/cnab/enums/pagamento/pagador.enum.ts`); `cett` para pagamento único.
- **Regra:** agrupa por favorecido, soma os valores e usa o dia de pagamento no lugar da data da ordem.
- **Dados:** `OrdemPagamentoAgrupado` e `OrdemPagamentoAgrupadoHistorico`.

### 3. Gatilho da remessa (manual)
Métodos de `CronJobsService` em `src/cron-jobs/cron-jobs.service.ts`, todos terminando em `geradorRemessaExec`:

| Método | Escopo | Período | Observações (estado da `main`) |
| --- | --- | --- | --- |
| `remessaModalExec(pagamentoUnico?)` | STPC, STPL, TEC (`HeaderName.MODAL`) | hoje até hoje | a restrição a terça/sexta está comentada; `limparAgrupamentos` está comentado |
| `remessaGuardadorExec(pagamentoUnico?)` | guardadores (`HeaderName.GUARDADOR`), sem lista de consórcios | hoje até hoje | **executa** `limparAgrupamentos` do dia antes de gerar |
| `remessaConsorciosExec(pagamentoUnico?)` | `CronJobsService.CONSORCIOS` (`HeaderName.CONSORCIO`) | só roda na terça ou na sexta; terça: 4 dias atrás até ontem; sexta: 3 dias atrás até ontem | `limparAgrupamentos` está comentado |
| `remessaPendenteExec` | pendentes de um intervalo e, opcionalmente, de operadoras | informado na chamada | exposto por `GET .../financial-movement` em `src/pendentes/pagamento-pendente.controller.ts` |

- `geradorRemessaExec` agrupa por consórcio com `prepararPagamentoAgrupados` (pagador `contaBilhetagem`), exceto quando `pagamentoUnico` é verdadeiro, caso em que o agrupamento é pulado (a chamada está comentada); com a lista de consórcios vazia (guardadores) agrupa com `contaRotativo`. Depois: `prepararRemessa` → `gerarCnabText` → `enviarRemessa`.
- `limparAgrupamentos` (quando ativo) apaga histórico, vínculos e agrupamentos do intervalo antes de recriá-los.
- Confirme no código quais chamadas estão comentadas antes de disparar qualquer uma.

### 4. Preparação da remessa
- **Método:** `RemessaService.prepararRemessa` (`src/cnab/novo-remessa/service/remessa.service.ts`).
- **Seleção das ordens:** `pagamentoUnico` → `getOrdensUnicas`; pendentes → `getOrdensPendentes`; senão `getOrdens`. Para guardadores usa `getOrdemPagamentoGuardador`.
- Cria `HeaderArquivo` (reaproveita um existente em `remessaGerado`; senão pega o próximo NSA em `SettingsService.getNextNSA`), `HeaderLote` (crédito em conta corrente para o banco 104; TED, forma de lançamento `41`, nos demais) e, por `gerarDetalheAB`, `DetalheA` e `DetalheB`. Cada ordem preparada passa a `StatusRemessaEnum.PreparadoParaEnvio`. NSR de TED e de conta corrente são contados separadamente.
- Abate pagamento indevido do favorecido (`pagamentoIndevidoService.findByNome`). Favorecido sem `bankCode` não entra na remessa.

### 5. Texto CNAB 240
- **Método:** `RemessaService.gerarCnabText(headerName, pagamentoUnico, isPendente, consorcios)`, com os layouts em `src/cnab/`.

### 6. Envio ao banco
- **Método:** `RemessaService.enviarRemessa`, que chama `SftpService.submitCnabRemessa` (`src/sftp/sftp.service.ts`).
- Tenta conectar até 5 vezes. Grava o arquivo na pasta `BACKUP_REMESSA` do SFTP para todos os tipos (o tratamento especial do VLT está comentado) e envia uma cópia de backup. Se o retorno não for vazio, grava `remessaName` e passa o `HeaderArquivo` para `remessaEnviado`.

### 7. Retorno do banco
- **Gatilho:** job `updateRetorno`, a cada 30 minutos; `CronJobsService.retornoExec` lê arquivos em laço até acabarem.
- **Métodos:** `RetornoService.lerRetornoSftp` e `RetornoService.salvarRetorno` (`src/cnab/novo-remessa/service/retorno.service.ts`).
- `salvarRetorno` interpreta o CNAB 240 e localiza cada `DetalheA` por CPF/CNPJ do `DetalheB` (`numeroInscricao`) e valor do lançamento (`getDetalheARetorno`); sem correspondência, apenas registra em log. Depois atualiza o status do histórico da ordem (`StatusRemessaEnum`) e move o arquivo para a pasta de backup de sucesso ou de falha.

### 8. Extrato
- **Gatilho:** job `updateExtrato`, a cada 30 minutos; `CronJobsService.readRetornoExtrato` chama `CnabService.readRetornoExtrato` (`src/cnab/cnab.service.ts`), que alimenta `ExtratoHeaderArquivo`, `ExtratoHeaderLote` e `ExtratoDetalheE`.

## Settings que interferem

`any__cnab_current_nsa` (e `_test`), `any__cnab_current_nsr_sequence`, `any__cnab_last_nsr_sequence`, `any__cnab_current_nsr_date` e `any__cnab_jobs_enabled` (`src/settings/`). O NSA e o NSR mudam a cada remessa; nunca os edite à mão nem os reinicie em produção.

## Cuidados

- **Observações do código atual, sem correção proposta aqui** (a área está em desenvolvimento):
  - O sincronismo de guardadores usa uma data fixa (`new Date('2026-09-29')`) no lugar do período calculado.
  - O job `sincronizarEAgruparOrdensPagamentoGuardador` chama `sincronizarEAgruparOrdensPagamento`, o método dos modais.
  - Em `submitCnabRemessa` o `return` está num `finally` e o caminho é definido antes do upload; se o upload falhar depois da conexão, o método ainda devolve o caminho e o header pode ficar `remessaEnviado`.
- A cobertura de teste do pipeline é parcial: há specs para `retorno.service` e para os relatórios do novo-remessa, mas `cron-jobs.service.spec.ts` está ignorado e o do cliente SFTP está quase todo desabilitado, de propósito.
- Nunca dispare remessa, sincronismo ou leitura de retorno em teste nem contra um banco/SFTP reais sem pedido explícito.
- `limparAgrupamentos` é destrutivo para os dados do intervalo.
- A "sexta de pagamento" semanal (`nextFriday` em `src/utils/payment-date-utils.ts`, DTOs, entidades, extrato e receitas) é legado que ninguém mais usa (confirmado por Matthew em 2026-09-30). A regra vigente é terça e sexta (`calcularPeriodoPagamento`).
