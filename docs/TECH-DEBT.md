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
