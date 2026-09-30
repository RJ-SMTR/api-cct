# Como trabalhar com IA neste repositório

Guia para quem usa o Claude Code no `api-cct`. O repositório foi preparado para que o agente receba contexto, tenha feedback rápido e não faça o que não deve. Você não precisa decorar nada: o agente lê os arquivos abaixo sozinho. Este guia explica o que existe e como usar.

## O que o repositório entrega

| Arquivo | Para quê |
| --- | --- |
| `CLAUDE.md` | Contrato curto do agente: fluxo de trabalho, regras que não se inferem do código. Carregado em toda sessão. |
| `PROJECT.md` | Como trabalhar no projeto: stack, comandos, estrutura, regras de camadas, segurança do agente. |
| `CONTEXT.md` | Glossário e regras de negócio em português (remessa, retorno, janelas de pagamento...), áreas frágeis e decisões. |
| `docs/README.md` | Índice de tudo em `docs/` e o que ler para cada tarefa. |
| `docs/fluxo-pagamento.md` | O fluxo de pagamento ponta a ponta, com arquivo e método de cada etapa. |
| `docs/TECH-DEBT.md` | Registro de débitos técnicos: quem registrou, quando, por quê e como pagar. |
| `src/cron-jobs/CLAUDE.md`, `src/cnab/CLAUDE.md` | Riscos do código de pagamento. Só carregam quando o agente trabalha nessas pastas. |
| `.claude/skills/` | As skills do fluxo de trabalho (abaixo). |
| `.claude/settings.json` | Permissões compartilhadas: o que o agente não pode fazer e o que pede confirmação. |

## O fluxo de trabalho

Para feature, refactor ou correção que não seja trivial, o caminho é este, em ordem:

| # | Skill | O que faz | Resultado |
| --- | --- | --- | --- |
| 1 | `/grill-with-docs` | Entrevista você, uma pergunta por vez, até o plano estar claro. Registra termos e decisões. | `CONTEXT.md` e `docs/adr/` atualizados |
| 2 | `/to-prd` | Transforma a conversa em requisitos, sem nova entrevista. | `docs/PRD.md` |
| 3 | `/task-planner` | Quebra o PRD em tarefas pequenas, cada uma com comportamento atual e desejado, restrições e comando de validação. | `docs/TASKS.md` e `docs/tasks/T<n>.md` |
| 4 | `/task-runner` | Executa a próxima tarefa com TDD, registra o resultado e faz um commit só de código e testes. | `docs/task-runs/T<n>-*.md` |

Exemplo: `/grill-with-docs quero incluir o campo X na remessa`. O agente pergunta, você responde; depois peça `/to-prd`, `/task-planner` e, tarefa a tarefa, `/task-runner`.

- **Bug urgente e pequeno:** você pode pedir para pular os passos 1 e 2. O agente ainda precisa dizer qual é o comportamento errado, o esperado, a área afetada e escrever um teste de regressão.
- **Só revisão:** não precisa do fluxo.
- **Arquivos de trabalho** (`docs/PRD.md`, `docs/TASKS.md`, `docs/tasks/`, `docs/task-runs/`) ficam **fora do git**. Nunca os commite. O que fica no git é o que dura: `CONTEXT.md`, `docs/adr/`, `docs/TECH-DEBT.md` e o código.
- O `task-runner` commita em inglês, sem push e sem abrir PR. Isso é com você.

## Como validar

- `npm run validate`: roda o build de produção, o jest e o eslint (sem `--fix`) e compara com `scripts/validate/baseline.json`. Falha só se algo **piorar**: uma suíte que passava e falhou, ou um arquivo com mais erros de eslint. Leva cerca de 30 segundos.
- O hook de pré-commit roda o build e os specs relacionados aos arquivos alterados. Para emergências existe `git commit --no-verify`, mas registre o motivo como débito técnico.
- O CI (`validate.yaml`) roda o mesmo `validate` em PRs para `main`, `homol` e `hmg`.
- Quando você consertar suítes ou erros de lint, ou adicionar um spec novo que passa, rode `npm run validate:update-baseline` e commite a nova baseline. A baseline só deve **diminuir** em erros; relaxá-la é débito técnico.
- Limite conhecido: o gate é por suíte. Pular um teste dentro de uma suíte que passa não é detectado (TD-7).

## Testes

- **Política:** lógica de negócio nova ou alterada ganha um spec ao lado do código, escrito antes (TDD), começando pela lógica pura. Nunca vale para SFTP nem cron jobs. As suítes quebradas que já existem (13, TD-1) não precisam ser consertadas para você seguir.
- **Trave o teste novo:** um spec novo que passa só é protegido pelo gate depois de entrar na baseline. Rode `npm run validate:update-baseline` e commite a baseline; senão o teste pode quebrar depois sem o `validate` reclamar (comprovado em 2026-09-30).
- **Estado dos testes (2026-09-30):** dos 42 specs do app, 25 passam, 13 falham e 4 estão ignorados. Agentes, antifraude, mail, relatórios do novo-remessa e `retorno.service` têm testes; `cron-jobs`, SFTP, extrato bancário e receitas não. `validate` verde não quer dizer que a mudança está segura: revise à mão, principalmente em pagamento.
- O e2e (`npm run test:e2e`) precisa de Postgres e roda no CI (`docker-e2e.yml`) em pushes e PRs para `main`.

## Regras de arquitetura

Os imports vão em uma direção: controller → service → repository, e `utils` não depende dos três. Como o repositório é organizado por feature, a regra vale pelo sufixo do arquivo (`*.controller.ts`, `*.service.ts`, `*.repository.ts`). O ESLint bloqueia o contrário, com uma mensagem que diz o que fazer. Detalhes em `PROJECT.md`, seção "Layer rules". Não silencie com `eslint-disable`.

## Débitos técnicos

Você não precisa invocar nada. Quando o agente percebe um atalho (teste pulado, verificação silenciada, baseline relaxada, "por enquanto"), ele pergunta uma vez se deve registrar em `docs/TECH-DEBT.md`. Só registra se você disser sim, com seu nome, a data e o critério para pagar a dívida. Registros nunca são apagados: uma dívida resolvida ou desistida muda de status.

## O que o agente pode e não pode

Definido em `.claude/settings.json` e descrito em `PROJECT.md`, seção "Agent safety":

- **Bloqueado:** ler `.env*` e `env-deploy*` com a ferramenta de arquivos, `git push --force`, `git reset --hard`, `rm -rf`, `git commit --no-verify`.
- **Pede confirmação:** `git push`, migrations, seeds, `schema:drop`, `psql`, `docker compose down`.
- **Livre:** `npm run validate`, jest, eslint e tsc.
- Ajustes pessoais vão em `.claude/settings.local.json` (não versionado).
- Isso é uma proteção, não um sandbox: comandos de shell como `cat` num arquivo de ambiente não são bloqueados por essas regras. Não deixe segredos reais na pasta do projeto.

## Cuidado com o pagamento

O pagamento é disparado **manualmente**, colocando uma chamada em `onModuleLoad` e fazendo deploy (TD-9). Os jobs de remessa estão desligados de propósito. Por padrão `onModuleLoad` não chama remessa (a linha `await this.remessaModalExec(true)` que gerava remessa a cada boot foi removida em 2026-09-30), mas um branch ou deploy antigo que ainda a tenha gera remessa ao subir. Peça ao agente para não reativar os jobs nem deixar chamadas de remessa em `onModuleLoad`. O fluxo completo e os riscos estão em `docs/fluxo-pagamento.md`. Essa área tem cobertura parcial de teste: revise à mão e com calma.

## Mantendo tudo atualizado

- Mudou um comando, a stack ou a estrutura: atualize `PROJECT.md`.
- Aprendeu uma regra de negócio, um risco ou tomou uma decisão: atualize `CONTEXT.md` (o `/grill-with-docs` faz isso durante a conversa).
- Criou ou moveu um arquivo em `docs/`: atualize `docs/README.md`.
- Não repita a mesma informação em dois arquivos: deixe o detalhe em um e aponte para ele no outro.

## Primeira vez

1. Instale as dependências (`nvm use` e `npm ci --legacy-peer-deps`) e copie `env-example` para `.env` (detalhes em `PROJECT.md`).
2. Rode `npm run validate` para ver o gate passar.
3. Abra o Claude Code na raiz e peça algo pequeno com `/grill-with-docs`.
4. Se algo no contexto estiver errado ou faltando, corrija o arquivo: os agentes seguintes vão se beneficiar.
