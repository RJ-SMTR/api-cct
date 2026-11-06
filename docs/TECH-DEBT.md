# Débitos técnicos

Registro único do que foi adiado de propósito, por quê e por quem. Serve para não perder a dívida de vista e para saber o que precisa ser verdade para ela ser paga.

## Regras

- **Só acrescentar.** Entradas novas vão ao final, com o próximo `TD-n`. Ids nunca são reutilizados.
- **Nunca apagar.** Ao resolver, mude o status para `pago` e preencha _Pago por_, _Data do pagamento_ e _Referência_ (commit ou PR). O critério de pagamento precisa estar cumprido.
- **Todo atalho aceito vira débito.** O agente reconhece sinais de débito e pergunta antes de registrar (skill `tech-debt`); ninguém precisa invocá-la.
- **Status:** `aberto`, `em andamento`, `pago`, `descartado` (com o motivo no texto).
- **Datas** em AAAA-MM-DD. **Detectado por** é `agente` ou `pessoa`.
- Contexto de domínio e decisões ficam em [CONTEXT.md](../CONTEXT.md); aqui ficam só a dívida e como pagá-la.

## Índice

| ID | Título | Status | Registrado por | Data |
| --- | --- | --- | --- | --- |
| [TD-1](#td-1) | 13 suítes de jest quebradas | aberto | Matthew | 2026-09-30 |
| [TD-2](#td-2) | 276 erros de eslint | aberto | Matthew | 2026-09-30 |
| [TD-3](#td-3) | Código fora do padrão do prettier | aberto | Matthew | 2026-09-30 |
| [TD-4](#td-4) | Gate por ratchet no lugar de base limpa | aberto | Matthew | 2026-09-30 |
| [TD-5](#td-5) | `tsconfig.json` inclui specs com erros de tipo (90 erros de tsc) | aberto | Matthew | 2026-09-30 |
| [TD-6](#td-6) | Sem testes para SFTP e cron jobs | descartado (parcial) | Matthew | 2026-09-30 |
| [TD-7](#td-7) | Gate não detecta teste pulado dentro de suíte que passa | aberto | Matthew | 2026-09-30 |
| [TD-8](#td-8) | 12 imports de `repository` para `service` | aberto | Matthew | 2026-09-30 |
| [TD-9](#td-9) | Pagamento depende de editar o código e fazer deploy | aberto | Matthew | 2026-09-30 |
| [TD-10](#td-10) | Baseline de eslint relaxada para `cron-jobs` e `ordem-pagamento-agrupado` | aberto | Rayanne | 2026-10-06 |
| [TD-11](#td-11) | Vulnerabilidades de dependências não tratadas (npm audit / Dependabot) | aberto | Rayanne | 2026-10-08 |
| [TD-12](#td-12) | `cron-jobs-pendentes.spec` quebrado na `main` bloqueia o pre-commit | aberto | Matthew | 2026-10-09 |
| [TD-13](#td-13) | Hook de pre-commit não funciona no Windows (`spawnSync` do `.bin/tsc`) e o ratchet fica vazio | aberto | William | 2026-10-04 |
| [TD-14](#td-14) | `SELECT DISTINCT` sem `op.id` em `buildPendenciaPagaTemplate`/`buildPendenciaPagamentoTemplate` pode subcontar como no ADR 0007 | reaberto (pagamento anterior usava diagnóstico errado — ADR 0011) | Rayanne | 2026-10-20 |
| [TD-15](#td-15) | Cadeia de migrations fora de ordem impede montar schema do zero | aberto | Rayanne | 2026-10-27 |
| [TD-16](#td-16) | `getQueryApagar` concatena `consorcioNome` sem aspas por item num ramo do filtro `favorecidoNome='Todos'` | aberto | Rayanne | 2026-10-27 |
| [TD-17](#td-17) | Baseline do gate desatualizado para `remessa.service.debitar-indevido.spec.ts`/`retorno.service.spec.ts` | pago | Rayanne | 2026-11-03 |
| [TD-18](#td-18) | `MODAIS_FILTER` quebra 10 de 14 testes de `relatorio-novo-remessa-financial-movement.integration.spec.ts` | aberto | Rayanne | 2026-11-06 |
| [TD-19](#td-19) | Resíduo de ~0,3% entre Consolidado e Movimentação Financeira em "A Pagar" (Permissionário) mesmo após o ADR 0017 | aberto | Rayanne | 2026-11-06 |
| [TD-20](#td-20) | CNPJ institucional em "Consórcio = Todos": Consolidado exclui, Movimentação Financeira inclui — intenção documentada e contraditória nos dois lados | aberto | Rayanne | 2026-11-06 |

## Entradas

## TD-1
**13 suítes de jest quebradas**

- **Status:** aberto
- **Registrado por:** Matthew · **Detectado por:** agente · **Data:** 2026-09-30
- **Contexto:** medido em 2026-09-30 na `main` (Node 18): dos 42 specs do app, 13 falham: `bank-statements.service`, `bigquery-ordem-pagamento.repository` e `.service`, `bigquery-transacao.repository` e `.service`, `ocorrencia.entity`, `cnab.service`, `cnab-104-utils`, `cnab-field-utils`, `cnab-utils`, `lancamento.controller`, `ticket-revenues.service` e `users.service`. Outros 4 estão ignorados. O gate por ratchet (TD-4) protege as 25 que passam sem exigir consertar estas.
- **Impacto/risco:** essas áreas (extrato bancário, CNAB, usuários, receitas) não têm rede de segurança automática.
- **Critério de pagamento:** `npx jest` sem suíte falhando (ou removida com justificativa) e `scripts/validate/baseline.json` com todas as suítes existentes em `passingSuites`.

## TD-2
**276 erros de eslint**

- **Status:** aberto
- **Registrado por:** Matthew · **Detectado por:** agente · **Data:** 2026-09-30
- **Contexto:** 276 erros em 90 arquivos (`{src,test,scripts}/**/*.ts`), medido em 2026-09-30: 264 antigos mais 12 de `repository → service` que passaram a existir quando as regras de camadas foram ligadas (TD-8). Corrigir tudo de uma vez geraria diffs enormes em código de pagamento.
- **Impacto/risco:** ruído no lint e risco de esconder erros novos entre os antigos; o gate impede só que aumentem.
- **Critério de pagamento:** `npx eslint "{src,test,scripts}/**/*.ts"` com 0 erros e `eslintErrors` vazio na baseline.

## TD-3
**Código fora do padrão do prettier**

- **Status:** aberto
- **Registrado por:** Matthew · **Detectado por:** agente · **Data:** 2026-09-30
- **Contexto:** 482 arquivos divergem do `.prettierrc` (que usa `printWidth: 2000`), medido em 2026-09-30. Prettier não é imposto no hook nem no CI para não forçar reformatar arquivos inteiros a cada commit.
- **Impacto/risco:** diffs inconsistentes e reformatações acidentais em PRs.
- **Critério de pagamento:** reformatação em massa em um commit próprio (sem mudança de lógica, revisada como tal) e `npx prettier --check "src/**/*.ts" "test/**/*.ts"` passando; depois, impor no gate.

## TD-4
**Gate por ratchet no lugar de base limpa**

- **Status:** aberto
- **Registrado por:** Matthew · **Detectado por:** pessoa · **Data:** 2026-09-30
- **Contexto:** o certo seria consertar todos os testes e o lint antes de ligar o gate. Escolhemos o ratchet (`npm run validate` compara com `scripts/validate/baseline.json`) para proteger o que já passa sem parar o trabalho. Limitação conhecida: o gate é por suíte (TD-7).
- **Impacto/risco:** a baseline pode ser relaxada por engano; suítes quebradas e erros antigos ficam escondidos na baseline.
- **Critério de pagamento:** TD-1 e TD-2 pagos, baseline sem suítes quebradas e sem erros de eslint, e o gate passa a falhar em qualquer suíte ou erro (sem baseline).

## TD-5
**`tsconfig.json` inclui specs com erros de tipo (90 erros de tsc)**

- **Status:** aberto
- **Registrado por:** Matthew · **Detectado por:** agente · **Data:** 2026-09-30
- **Contexto:** `npx tsc --noEmit -p tsconfig.json` retorna 90 erros (medido em 2026-09-30, todos fora do build de produção). O jest roda com `diagnostics: false`, então erros de tipo em specs não derrubam suítes. O gate usa `tsconfig.build.json`, que exclui specs.
- **Impacto/risco:** specs e e2e podem ter erros de tipo que ninguém vê.
- **Critério de pagamento:** `npx tsc --noEmit -p tsconfig.json` com 0 erros e esse comando incluído no gate.

## TD-6
**Sem testes para SFTP e cron jobs**

- **Status:** descartado (parcial — reaberto e revertido pra SFTP, cron jobs continua descartado)
- **Registrado por:** Matthew · **Detectado por:** agente · **Data:** 2026-09-30
- **Contexto:** `src/cron-jobs/cron-jobs.service.spec.ts` está ignorado e o spec do cliente SFTP (`src/sftp/sftp-client/sftp-client.service.spec.ts`) tem 8 blocos em `xdescribe`; só "should be defined" roda.
- **Impacto/risco:** o envio de arquivos ao banco e o agendamento dos jobs não têm teste automático.
- **Critério de pagamento:** os blocos voltam para `describe` e passam, ou a decisão de não testar vira um ADR.
- **Descartado por:** Matthew · **Data:** 2026-09-29 · **Motivo:** decisão de que SFTP e cron jobs nunca terão testes automatizados; os `xdescribe` ficam como estão e não são dívida a pagar.
- **Revertido (parcial) por:** Matthew · **Data:** 2026-09-30 · **Motivo:** `src/sftp/sftp.service.ts#submitCnabRemessa` tinha um bug real (upload falho reportado como sucesso) achado só rodando o envio real contra um SFTP local — nunca teria sido pego sem um teste. `src/sftp/sftp.service.spec.ts` prova o fix (vermelho contra o código antigo, verde com o fix). A partir de agora, specs de SFTP são bem-vindas quando cobrem esse tipo de lógica de retorno/tratamento de erro, mockando o cliente SFTP como fronteira. `cron-jobs.service` continua fora — decisão original mantida ali.

## TD-7
**Gate não detecta teste pulado dentro de suíte que passa**

- **Status:** aberto
- **Registrado por:** Matthew · **Detectado por:** agente · **Data:** 2026-09-30
- **Contexto:** o `validate` compara resultado por suíte. Testado: trocar um `it` por `it.skip` numa suíte que passava deixou o `validate` verde. Complementa o TD-4.
- **Impacto/risco:** um teste pode ser desligado sem ninguém perceber, e o gate continua verde.
- **Critério de pagamento:** a baseline registra também o número de testes que passam por suíte e o `validate` falha quando esse número diminui (ou a contagem de `skipped` aumenta).

## TD-8
**12 imports de `repository` para `service`**

- **Status:** aberto
- **Registrado por:** Matthew · **Detectado por:** agente · **Data:** 2026-09-30
- **Contexto:** ao ligar as regras de camadas por sufixo de arquivo, 12 imports de `*.service` dentro de `*.repository.ts` já existiam, em 9 arquivos: `agentes-bigquery`, `agentes`, `bank-statements`, `arquivo-publicacao`, `bigquery-ordem-pagamento` (e a variante guardador), `bigquery-transacao` (2), `ticket-revenues` (2) e `users` (2). Foram aceitos na baseline de eslint para não refatorar código de pagamento e injeção de dependência agora. Em uma versão anterior deste trabalho, Matthew avaliou a limpeza como de ganho baixo (para 3 imports); confirme antes de tratar como descartado.
- **Impacto/risco:** repositories que dependem de services criam ciclos e dificultam testar e trocar camadas; a baseline "esconde" esses 12 erros.
- **Critério de pagamento:** os 12 imports removidos (lógica movida para o service ou dependência invertida), a baseline sem os erros `no-restricted-imports` e `npm run validate` verde.

## TD-9
**Pagamento depende de editar o código e fazer deploy**

- **Status:** aberto
- **Registrado por:** Matthew · **Detectado por:** agente · **Data:** 2026-09-30
- **Contexto:** os jobs `generateRemessaVLT`, `generateRemessaVanzeiros` e `generateRemessaEmpresa` não geram remessa (corpo vazio ou chamada comentada). No dia de pagamento, alguém coloca uma chamada em `onModuleLoad` de `CronJobsService` (`remessaModalExec`, `remessaGuardadorExec` ou `remessaConsorciosExec`), faz o deploy (a remessa roda quando o app sobe) e depois remove a chamada. Confirmado por Matthew em 2026-09-30. Em `c83718e2` a primeira linha de `onModuleLoad` era `await this.remessaModalExec(true)`, que gerava remessa a cada boot do app; essa linha foi removida em 2026-09-30, e o gatilho continua manual.
- **Impacto/risco:** a remessa de pagamento depende de uma edição manual de código de produção; qualquer restart do app com a chamada ativa reenvia a remessa; não há trava contra execução dupla nem trilha de quem disparou; agentes podem "consertar" os crons desligados sem saber que é intencional.
- **Critério de pagamento:** a geração da remessa pode ser disparada sem alterar código nem fazer deploy (por endpoint autenticado com papel restrito, ou pelos crons reativados atrás de uma flag em `settings`), com trava contra execução duplicada e registro de quem disparou e quando; o processo fica descrito em `docs/fluxo-pagamento.md`.

## TD-10
**Baseline de eslint relaxada para `cron-jobs` e `ordem-pagamento-agrupado`**

- **Status:** aberto
- **Registrado por:** Rayanne · **Detectado por:** agente · **Data:** 2026-10-06
- **Contexto:** `npm run validate:update-baseline` foi rodado em 2026-10-06 porque `scripts/validate/baseline.json` (gerada em 2026-09-30) estava defasada: os commits de gratuidade (`2b334b88`, `1fac3367`, `b3b8db6f`) mexeram nesses dois arquivos depois dela. A baseline passou de 4 para 5 erros em `src/cnab/novo-remessa/repository/ordem-pagamento-agrupado.repository.ts` e de 5 para 7 em `src/cron-jobs/cron-jobs.service.ts`. Os erros novos são `@typescript-eslint/no-unused-vars` (`ICronjobDebug`, `dtInicio`, `dtFim`, `dataPagamento`, `subDaysInt`), `@typescript-eslint/no-floating-promises` (4 chamadas em `ordem-pagamento-agrupado.repository.ts`), `@typescript-eslint/require-await` (`onTick`) e `prefer-const` (`subDaysInt`). Aceitos para não mexer em código de remessa ao mesmo tempo que se faz a validação.
- **Impacto/risco:** o gate deixa de proteger esses dois arquivos contra mais erros de lint; `no-floating-promises` em código de remessa pode esconder uma promise não aguardada, o que é risco real de pagamento. `cron-jobs.service.ts` é o arquivo dos jobs de remessa (ver TD-9).
- **Critério de pagamento:** os 7 erros de `cron-jobs.service.ts` e os 5 de `ordem-pagamento-agrupado.repository.ts` corrigidos em commit próprio, com teste de remessa antes e depois, e a baseline regenerada com esses números menores.

## TD-11
**Vulnerabilidades de dependências não tratadas (npm audit / Dependabot)**

- **Status:** aberto
- **Registrado por:** Rayanne · **Detectado por:** agente · **Data:** 2026-10-08
- **Contexto:** revisão da branch `release` após o GitHub reportar 89 vulnerabilidades (4 críticas, 39 altas, 31 moderadas, 15 baixas) no push de `be8abb8b`. `npm audit` local (árvore completa) mede 144 (5 críticas, 94 altas, 40 moderadas, 5 baixas) — contagem diferente do Dependabot, mesma árvore. Destaques:
  - **`xlsx` (HIGH, sem fix disponível no npm)**: Prototype Pollution e ReDoS. Usado em `src/users/users.service.ts` (`getWorksheetFromFile`, via `xlsx.read(file.buffer, ...)`) para parsear a planilha do cadastro em massa de usuários — **entrada controlada por quem faz upload**, não um arquivo interno; é o item de maior risco concreto da lista.
  - **Fixes não-breaking disponíveis, não aplicados**: `handlebars` 4.7.7→4.7.10 (CRITICAL, via `@nestjs-modules/mailer`), `typeorm` 0.3.16→0.3.31 (HIGH, SQL injection em `repository.save`/`update`), `proxy-addr`/`fast-xml-parser` (CRITICAL, transitivos via `@aws-sdk/client-s3`/express). _Pago em parte, ver nota abaixo._
  - **Fixes exigem bump major (breaking), não aplicados**: `multer` 1.4.4→2.4.0 (HIGH, DoS em upload — mesmo caminho do risco do `xlsx`), `nodemailer` 6.9.3→10.0.16 (HIGH, incl. SMTP command injection), `google-auth-library` 8.8.0→11.2.0 (HIGH), e toda a família `@nestjs/*` 9.x→12.x (HIGH/MODERATE).
  - **Dependências de login social abandonadas, sem fix**: `twitter` e `fb` dependem de `request`/`form-data`/`qs`/`tough-cookie` vulneráveis; pacotes sem manutenção.
  - **Dev-only (jest, ts-jest, `@nestjs/cli`, `@typescript-eslint/*`, webpack, `tmp`, `inquirer`...)**: HIGH/MODERATE, mas em `devDependencies`, não vão para produção; o scan do GitHub conta de todo jeito.
- **Impacto/risco:** o item concreto é `xlsx` recebendo arquivo de upload de usuário sem patch disponível (Prototype Pollution/ReDoS explorável por arquivo malicioso). O restante é risco difuso de biblioteca desatualizada; o maior bloco de esforço é o upgrade de `@nestjs/*` 9→12, que arrasta `multer`, `typeorm`-adjacentes e outros.
- **Critério de pagamento:** `xlsx` substituído ou mitigado (ex.: validação/sandboxing do arquivo antes do parse, ou troca de biblioteca); fixes não-breaking do Tier 1 aplicados; decisão tomada (manter, trocar ou remover) sobre `twitter`/`fb` conforme uso real do login social; `npm audit` sem CRITICAL/HIGH em dependências de produção (`dependencies`, não `devDependencies`).
- **Progresso parcial (2026-10-08, commit `295faeb4`):** `handlebars` 4.7.7→4.7.10 e `typeorm` 0.3.16→0.3.31 atualizados (bumps não-major, dentro do range já aceito); `proxy-addr` 2.0.7→2.0.8 resolvido só com `npm update` (estava defasado no lockfile, `express` já aceitava a versão corrigida). `npm audit` caiu de 144 para 141 vulnerabilidades (5→3 críticas). `fast-xml-parser` segue sem fix aplicado: resolver exigiria saltar `@aws-sdk/client-s3` de 3.350.0 para 3.1147.0 — tecnicamente não-major pelo semver do SDK, mas um salto grande demais para tratar como baixo risco junto dos outros; fica para a rodada dos breaking. `xlsx`, `twitter`/`fb` e os bumps breaking (`multer`, `nodemailer`, `google-auth-library`, `@nestjs/*`) continuam sem tratamento — critério de pagamento completo não foi atingido, status continua `aberto`.

## TD-12
**`cron-jobs-pendentes.spec` quebrado na `main` bloqueia o pre-commit**

- **Status:** aberto
- **Registrado por:** Matthew · **Detectado por:** agente · **Data:** 2026-10-09
- **Contexto:** os commits de geração de remessa que estão na `main` e ainda não na `release` (`859b9ffb`, `24253f09`, `99b5652d`) fazem `src/cron-jobs/cron-jobs-pendentes.spec.ts` falhar 2 de 3 testes (`this.ordemPagamentoAgrupadoService.prepararPagamentoAgrupados is not a function`, em `geradorRemessaExec`). A suíte passa na baseline, então, sobre a `main`, o pre-commit bloqueia qualquer commit cujo `jest --findRelatedTests` a alcance (ex.: mudar `src/users/entities/user.entity.ts`) e `npm run validate` falha. Detectado ao trabalhar na issue #1192, que acabou rebaseada sobre a `release`. Na mesma `main`, `onModuleLoad` de `CronJobsService` chama `await this.remessaGuardadorExec()` (ver TD-9).
- **Impacto/risco:** commits sobre a `main` sem relação com pagamento precisam de `--no-verify`, o que desliga também o build check; o spec deixou de proteger o ciclo de vida do job de pendentes; quando a `main` for integrada à `release`, a falha vem junto.
- **Critério de pagamento:** `cron-jobs-pendentes.spec.ts` volta a passar na `main` (mock atualizado para a API atual de `OrdemPagamentoAgrupadoService` ou código corrigido), `npm run validate` verde e commits voltam a passar no pre-commit sem `--no-verify`.
- **Atualização (2026-10-13):** os commits manuais de `main` de 08/10 (`e4d96b98`, agrupamento e `prepararRemessa` dos pendentes de consórcio comentados em `geradorRemessaPendenteExec`) mantêm 1 de 3 testes falhando (consórcio). O commit que remove `remessaModalExec()` do `onModuleLoad` (PR da issue #1192 para a `main`) usou `--no-verify` por causa disso; o teste do `onModuleLoad` voltou a passar com ele.
- **Atualização (2026-10-15):** o commit do merge de `origin/stag` na `feature/mergeStagProd` foi feito com `--no-verify`, autorizado por William, porque esse spec (1 de 3 testes) bloqueava o pre-commit. O type-check de produção e os demais specs de `novo-remessa` passaram antes do commit.
- **Atualização (2026-10-26):** o merge de `origin/main` em `feat/relatorio-stuc` (PR #1240) voltou a quebrar o primeiro teste (`initializes without reading a return or replacing the SFTP transport`), agora com `this.ordemPagamentoAgrupadoService.prepararPagamentoAgrupadosUnico is not a function` em `geradorRemessaExec`. Causa: `main` atual tem `await this.remessaModalExec(true);` de volta em `onModuleLoad` (`src/cron-jobs/cron-jobs.service.ts:116`) — a mesma linha que a atualização de 2026-10-13 registra como removida, e que `src/cron-jobs/CLAUDE.md` proíbe explicitamente ("`onModuleLoad` calls none by default"). Reenviaria remessa de pagamento real a cada boot do app se chegar a produção. Decisão combinada com o usuário: manter o `main` como está por enquanto (não é escopo desta PR) e só reportar; removida `src/cron-jobs/cron-jobs-pendentes.spec.ts` do `scripts/validate/baseline.json` de `feat/relatorio-stuc` para destravar o commit do merge sem `--no-verify`.

## TD-13
**Hook de pre-commit não funciona no Windows (`spawnSync` do `.bin/tsc`) e o ratchet fica vazio**

- **Status:** aberto
- **Registrado por:** William · **Detectado por:** agente · **Data:** 2026-10-04
- **Contexto:** `scripts/validate/pre-commit.ts` chama `spawnSync(bin('tsc'), ...)` sem `shell`. No Windows `node_modules/.bin/tsc` não é executável direto, então o hook sai com erro sem stdout/stderr ("undefinedundefined") e bloqueia todo commit com `.ts` staged, mesmo com o build verde. Além disso, `compareSuites` compara os caminhos de suíte do baseline (`src/...`) com caminhos absolutos do Windows e acaba checando 0 suítes, ou seja, o ratchet não protege nada nessa plataforma. O commit do merge de `origin/main` (2026-10-04) usou `git commit --no-verify`; antes disso as mesmas etapas rodaram à mão: `tsc --noEmit -p tsconfig.build.json` (ok), `jest --findRelatedTests` e ratchet com caminhos normalizados. Única diferença contra o baseline: `cron-jobs-pendentes.spec.ts`, que falha idêntico no `origin/main` (arquivos iguais ao upstream).
- **Impacto/risco:** quem commita no Windows precisa de `--no-verify` e perde a validação automática; o baseline não é aplicado.
- **Critério de pagamento:** o hook roda no Windows (`spawnSync` com `shell: true` ou `npx`), `compareSuites` normaliza separadores e raiz dos caminhos, e um commit com `.ts` staged passa pelo hook sem `--no-verify`.

## TD-14
**`SELECT DISTINCT` sem `op.id` em `buildPendenciaPagaTemplate`/`buildPendenciaPagamentoTemplate` pode subcontar como no ADR 0007**

- **Status:** pago
- **Registrado por:** Rayanne · **Detectado por:** agente · **Data:** 2026-10-20
- **Pago por (anterior, revertido):** agente · **Data do pagamento:** 2026-10-21 · **Referência:** ADR 0010, branch `fix/pendencia-pagamento-distinct-subcontagem`
- **Reaberto por:** agente · **Data:** 2026-10-21 · **Referência:** ADR 0011, branch `fix/fanout-valorlancamento-duplicado`
- **Contexto:** o ADR 0007 corrigiu `buildGroupedQuery` (usada por `buildBaseQuery`/`buildStucGratuidadeQuery`), removendo um `SELECT DISTINCT` que colapsava ordens de pagamento distintas do mesmo agrupamento quando coincidiam em valor — confirmado em produção, subcontando R$ 22.385,00 no Consolidado com STUC de 2026-10-20. `buildPendenciaPagaTemplate` e `buildPendenciaPagamentoTemplate` (mesmo arquivo, `novo-remessa-query-builder.ts`) tinham o mesmo padrão: `SELECT DISTINCT` sem `op.id` na lista de colunas.
- **Impacto/risco (diagnóstico original, errado):** confirmado com dado real (banco local, não produção): 2026-04-02, filtro Pendência de Pagamento → Estorno, CPF 29709920782, `opa.id=253902` tem 3 ordens de pagamento distintas de R$12,38 cada, idênticas nas demais colunas exibidas — o `DISTINCT` colapsava as 3 em 1 linha. No relatório completo desse filtro/data, a tela mostrava R$ 2.637,43 contra R$ 2.951,15 reais (soma direta no banco), uma subcontagem de R$ 313,72.
- **Critério de pagamento anterior (revertido):** `DISTINCT` removido de `buildPendenciaPagaTemplate` e `buildPendenciaPagamentoTemplate`, com teste de regressão em `novo-remessa-query-builder.spec.ts` (`describe('... sem DISTINCT (ADR 0007 / TD-14)')`) cobrindo as duas funções. Validado então: tela e banco batiam em R$ 2.951,15 para o caso real acima.
- **Por que foi reaberto:** o diagnóstico estava errado. As "3 ordens de pagamento distintas de R$12,38 cada" de `opa.id=253902` são, na verdade, **1 único lançamento** (`da.id=21536`) com 3 ordens de pagamento filhas do mesmo agrupamento — confirmado direto no banco (`op.id` 34723/35787/36572, todas com o mesmo `oph.id=255318` e `da.id=21536`). O valor real do grupo é R$ 12,38, não R$ 37,14: remover o `DISTINCT` introduziu uma sobrecontagem 3x nesse caso específico, em vez de corrigir uma subcontagem. O mesmo mecanismo apareceu de forma muito mais visível em 2026-09-10 (Permissionário, Pago, via `buildBaseQuery`/`buildGroupedQuery`): R$ 281.131,68 exibidos contra R$ 59.212,56 reais. Ver ADR 0011 para a causa raiz completa.
- **Critério de pagamento (novo):** as três funções (`buildGroupedQuery`, `buildPendenciaPagaTemplate`, `buildPendenciaPagamentoTemplate`) restringem a fonte `AGRUPAMENTO_NORMAL` a uma única `ordem_pagamento` representante por agrupamento, eliminando o fan-out antes da soma — `AGRUPAMENTO_GRATUIDADE` (STUC) continua sem essa restrição, sem regressão no que o ADR 0007 corrigiu. Testes de regressão (positivos e negativos) em `novo-remessa-query-builder.spec.ts` (`describe('... uma ordem por agrupamento (ADR 0011...)')`). Validado após o fix: `opa.id=253902` passa a somar R$ 12,38 (não R$ 37,14); o caso de 2026-09-10 passa a somar R$ 59.212,56 (igual ao Consolidado e ao banco).

## TD-15
**Cadeia de migrations fora de ordem impede montar schema do zero**

- **Status:** aberto
- **Registrado por:** Rayanne · **Detectado por:** agente · **Data:** 2026-10-27
- **Contexto:** achado incidentalmente na branch `refactor/relatorio-parametrizar-queries` (T2), ao tentar montar um Postgres isolado (schema do zero, via migrations) para escrever specs de integração sem depender do container compartilhado. A migration `CreateUserRelatonshipAndOrdemPagamentoGruadador1784579152936` dropa uma coluna de uma tabela que só é criada por uma migration posterior — rodar `migration:run` do zero falha nessa cadeia. Não investigado a fundo (fora do escopo do refactor); o workaround usado foi trabalhar sobre o container `api-cct-postgres-1` já existente, recriando manualmente só as tabelas faltantes (`transacao_view`) em vez de migrar do zero.
- **Impacto/risco:** qualquer ambiente novo (CI, onboarding, banco de teste isolado) que tente `npm run migration:run` contra um Postgres vazio falha nessa migration; hoje só funciona porque os ambientes existentes já têm o schema aplicado fora de ordem (ou aplicado antes do bug existir).
- **Critério de pagamento:** `npm run migration:run` (ou equivalente) aplica a cadeia completa de migrations do zero, sem erro, contra um Postgres vazio; a migration que dropa a coluna é reordenada ou corrigida para não depender de uma tabela criada depois dela.

## TD-16
**`getQueryApagar` concatena `consorcioNome` sem aspas por item num ramo do filtro `favorecidoNome='Todos'`**

- **Status:** aberto
- **Registrado por:** Rayanne · **Detectado por:** agente · **Data:** 2026-10-27
- **Contexto:** achado em `src/relatorio/sintetico/relatorio-sintetico.repository.ts`, `RelatorioSinteticoRepository.getQueryApagar` (T3 do refactor `refactor/relatorio-parametrizar-queries`). Quando `favorecidoNome` inclui o sentinela `'Todos'` e `consorcioNome` também está definido, o código monta `tv."nomeConsorcio" in('STPC','STPL',${args.consorcioNome?.join("','")})` — os itens de `args.consorcioNome` entram concatenados sem aspas em volta de cada um, diferente dos outros itens fixos da lista (`'STPC'`, `'STPL'`). Preservado como estava (comentado no código) por estar fora do escopo do refactor de parametrização (mudar regra de negócio pré-existente exige confirmação separada).
- **Impacto/risco:** qualquer `consorcioNome` com mais de uma palavra ou que não seja um identificador solto gera erro de sintaxe SQL nesse ramo específico (`favorecidoNome=['Todos']` + `consorcioNome` definido, em `findSintetico` com `aPagar=true`); se algum nome de consórcio tiver caractere especial, é também um vetor de SQL injection residual, já que esse trecho não foi parametrizado.
- **Critério de pagamento:** o item do array `args.consorcioNome` passa a entrar citado (`'${item}'` ou, melhor, via parâmetro bind) na lista `IN`, com teste de integração cobrindo esse ramo (`favorecidoNome=['Todos']` + `consorcioNome` definido) antes e depois do fix.

## TD-17
**Baseline do gate desatualizado para `remessa.service.debitar-indevido.spec.ts`/`retorno.service.spec.ts`**

- **Status:** pago
- **Registrado por:** Rayanne · **Detectado por:** agente · **Data:** 2026-11-03
- **Pago por:** Rayanne · **Data do pagamento:** 2026-11-03 · **Referência:** commit `420978d5`
- **Contexto:** achado durante a validação de T1 (correção do Extrato Bancário, issue #1276). `npm run validate` falhou com `src/cnab/novo-remessa/service/remessa.service.debitar-indevido.spec.ts` tendo 1 erro de eslint novo (baseline esperava 0) e `src/cnab/novo-remessa/service/retorno.service.spec.ts` tendo 4 (baseline esperava 3), ambos `@typescript-eslint/require-await` em funções `async` de teste sem `await` dentro. Confirmado via `git stash` de toda a mudança de T1 que os erros existem sem nenhuma alteração desta tarefa — é `scripts/validate/baseline.json` desatualizado em relação ao estado atual desses dois arquivos, não uma regressão introduzida agora. Mesma execução também viu timeout em suítes diferentes em cada rodada (`financial-movement-pdf.spec.ts` numa vez, `run-with-worker-timeout.spec.ts` na outra) — ambas passam isoladas, é flakiness sob carga da suíte completa, não listado aqui como TD por não ser uma contagem fixa do baseline.
- **Impacto/risco:** `npm run validate` fica vermelho por uma causa não relacionada a mudanças futuras nesses 2 arquivos, dificultando saber se um PR futuro realmente piorou algo ali ou só herdou esse drift; bloqueia `npm run validate:update-baseline` de quem estiver trabalhando perto desses arquivos sem querer "aceitar" esse drift de propósito.
- **Critério de pagamento:** `npx eslint src/cnab/novo-remessa/service/remessa.service.debitar-indevido.spec.ts src/cnab/novo-remessa/service/retorno.service.spec.ts` sem erros novos em relação ao baseline atual (corrigindo os `async`/`await` ou removendo `async` onde não há espera real), seguido de `npm run validate:update-baseline`.

## TD-18
**`MODAIS_FILTER` quebra 10 de 14 testes de `relatorio-novo-remessa-financial-movement.integration.spec.ts`**

- **Status:** aberto
- **Registrado por:** Rayanne · **Detectado por:** agente · **Data:** 2026-11-06
- **Contexto:** achado durante a implementação do T1 (ADR 0017, correção de "A Pagar" na Movimentação Financeira). `MODAIS_FILTER` (`novo-remessa-query-builder.ts`, ADR "2026-11-04" em `CONTEXT.md`) restringe toda consulta com `todosVanzeiros=true` e nenhum filtro de consórcio a `pu."permitCode" LIKE '4%' OR '81%' OR '7%'`. `normalizeFilter` do serviço marca `todosVanzeiros=true` por padrão sempre que a chamada não passa `userIds` (ADR 0014) — e nenhuma fixture deste spec de integração define `permitCode` no `INSERT` de `public.user`, então `pu."permitCode" LIKE '...'` nunca é verdadeiro e toda consulta sem `userIds` explícito retorna vazio. Rodando o spec contra um Postgres local (`RUN_RETORNO_DB_TESTS=1`), 10 das 14 suítes falham - incluindo testes sem nenhuma relação com "A Pagar" ou MODAIS, como `pendenciaPaga`. Confirmado que o problema é anterior ao T1 (mesma falha rodando o spec original, sem nenhuma mudança de código desta tarefa). Como o spec exige banco local e a flag `RUN_RETORNO_DB_TESTS=1`, não roda no CI padrão (`npm run validate` pula a suíte inteira via `describe.skip`), então a regressão passou despercebida.
- **Impacto/risco:** quem depender deste spec de integração para validar mudanças na Movimentação Financeira do Permissionário vê falhas em massa não relacionadas à própria mudança, o que mascara regressões reais e desencoraja rodar a suíte. T1 contornou o problema passando `userIds` explícito nos dois testes novos que adicionou, sem corrigir os 10 pré-existentes.
- **Critério de pagamento:** as fixtures de `relatorio-novo-remessa-financial-movement.integration.spec.ts` passam a inserir um `permitCode` compatível com os cenários testados (ou a suíte passa `userIds` explícito em todo filtro), e as 14 suítes passam com `RUN_RETORNO_DB_TESTS=1` contra um Postgres local com as migrations em dia.

## TD-19
**Resíduo de ~0,3% entre Consolidado e Movimentação Financeira em "A Pagar" (Permissionário) mesmo após o ADR 0017**

- **Status:** aberto
- **Registrado por:** Rayanne · **Detectado por:** agente · **Data:** 2026-11-06
- **Contexto:** validação em staging do fix do ADR 0017 (T1, commit `83686d98`), filtro Favorecido=Todos/A Pagar/02-11 a 06-11/2026, Permissionário: Consolidado R$ 4.894.127,49 contra Movimentação Financeira R$ 4.878.109,16 — diferença de R$ 16.018,33 (~0,3%), concentrada quase inteira no dia 05/11 (R$ 16.938,33), isolada a um único favorecido (user id 1716, JOSE MELQUIADES TAVARES): presente no Consolidado, ausente (count 0) na Movimentação Financeira em qualquer filtro de status/data testado para ele. Os outros dias (03 e 04/11) têm diferenças pequenas e de sinal trocado (-185/-735), compatíveis com drift de dados ao vivo entre as duas chamadas de API (não o mesmo padrão do dia 05). Comparação direta da sub-query "nunca enviada" (`buildAPagarNuncaEnviadoQuery` vs `getWhereApagar`+`fromQueryApagar`) rodada byte-a-byte contra o banco local (sincronizado até 04/11) para 1.721 favorecidos do dia 04/11 deu 0 diferenças — a lógica textual das duas sub-queries está correta; o registro problemático do dia 05/11 não está no banco local (sync 1 dia atrasado) e não pôde ser reproduzido diretamente.
- **Impacto/risco:** pequeno em valor absoluto (~0,3% no período testado), mas indica que a união das duas populações (ADR 0017) ainda pode divergir em casos pontuais não identificados — risco de subcontagem real de "A Pagar" para favorecidos específicos, não só de exibição.
- **Critério de pagamento:** acesso de leitura ao Postgres de staging/produção para inspecionar a linha de `ordem_pagamento` do caso registrado (ou um caso equivalente capturado no mesmo dia da investigação), achar a causa raiz (candidatos não descartados: a metade "histórico" `statusRemessa IN (0,1)` da união, ou timing/race condition entre as duas chamadas de relatório) e corrigir ou documentar como comportamento esperado.

## TD-20
**CNPJ institucional em "Consórcio = Todos": Consolidado exclui, Movimentação Financeira inclui — intenção documentada e contraditória nos dois lados**

- **Status:** aberto
- **Registrado por:** Rayanne · **Detectado por:** agente · **Data:** 2026-11-06
- **Contexto:** achado numa comparação regra-a-regra entre Consolidado (`relatorio-novo-remessa-consolidado.repository.ts`) e Movimentação Financeira (`relatorio-novo-remessa-financial-movement.service.ts`/`novo-remessa-query-builder.ts`), Permissionário, feita após o fix do ADR 0017. Para o filtro "Consórcio = Todos" (sem favorecido específico), os 6 CNPJs institucionais dos consórcios (pagamento lançado direto no CNPJ do consórcio, não de um vanzeiro individual) têm tratamento oposto:
  - **Consolidado**: `excluiCnpjConsorcioInstitucional` é aplicado em `getQueryConsorcios`/`getQueryPendenciaPagaConsorcios` dentro do ramo `todosConsorcios === true` (repo.ts ~linha 572) — exclui os institucionais do histórico (Pago, Aguardando, etc.) quando "Todos".
  - **Movimentação Financeira**: `hasConsorcioFilter(filter)` (service.ts ~linha 527) retorna `true` tanto para um consórcio específico quanto para `todosConsorcios`, e `buildTodosVanzeirosFilter` (query-builder.ts ~linha 124) só aplica `NOT_CPF_FILTER` quando `!hasConsorcioFilter` — ou seja, "Consórcio = Todos" desliga a exclusão, incluindo os institucionais. O comentário no código (query-builder.ts ~linha 117-123) documenta isso como decisão deliberada: "Uma vez que o usuário pediu um Consórcio (específico ou 'Todos'), é o filtro de consórcio... que decide quais linhas aparecem, não estes dois."
  - A ADR 0018 (que criou essa regra) só discute o caso de um consórcio *específico* (VLT, Internorte, Santa Cruz) — nunca menciona "Todos os consórcios" explicitamente, então os dois lados ficaram com intenção documentada mas oposta sem ninguém perceber a contradição.
- **Impacto/risco:** para o mesmo filtro (Consórcio = Todos, qualquer status que passe pelo histórico — Pago, Aguardando, a metade histórico de A Pagar etc.), o Consolidado mostra um total sem os institucionais e a Movimentação Financeira mostra um total com eles — divergência real e atual entre as duas telas, não coberta por nenhuma ADR/TD anterior.
- **Critério de pagamento:** decisão de negócio sobre qual comportamento é o correto para "Consórcio = Todos" (institucional aparece ou não), confirmada com quem define a regra; depois, alinhar o lado divergente (ajustar `hasConsorcioFilter`/`buildTodosVanzeirosFilter` na Movimentação, ou o ramo `todosConsorcios` no Consolidado) com teste de regressão cobrindo o cenário.
