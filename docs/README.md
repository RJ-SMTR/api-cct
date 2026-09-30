# Índice de `docs/`

O que existe aqui, o que cada arquivo cobre e o que ler para cada tarefa. Os diagramas `.drawio` são XML e difíceis de ler por agentes; o essencial deles já está em texto em [CONTEXT.md](../CONTEXT.md) (glossário e regras) e em [fluxo-pagamento.md](fluxo-pagamento.md) (fluxo com arquivos e métodos).

## O que ler para qual tarefa

| Tarefa | Leia |
| --- | --- |
| Qualquer coisa de pagamento (remessa, retorno, agrupamento) | `CONTEXT.md`, `docs/fluxo-pagamento.md`, `src/cron-jobs/CLAUDE.md`, `src/cnab/CLAUDE.md` |
| Lançamento financeiro | `CONTEXT.md` (seção Lançamento), `docs/lancamento/` |
| Usuários e convites por email | `CONTEXT.md` (seção Usuários), `docs/bilhetagem/estado-usuario-historico-email.drawio` |
| Pagamento indevido | `docs/bilhetagem/pagamentos-indevidos/pagamentos-indevidos.md` |
| Agendamento dos jobs | `docs/fluxo-pagamento.md` (tabela de jobs), `docs/cronjobs/` |
| Dívidas e o que foi adiado | `docs/TECH-DEBT.md` |
| Como rodar, testar e validar | `PROJECT.md` |
| Usar o Claude Code neste repositório (fluxo, gate, permissões, débitos) | `docs/COMO-TRABALHAR-COM-IA.md` |

## Arquivos

Tipo: **texto** (legível por agentes), **diagrama** (`.drawio`, XML), **planilha/PDF/imagem**, **stub** (quase vazio), **boilerplate** (documentação do template NestJS, não do negócio).

| Caminho | Assunto | Tipo |
| --- | --- | --- |
| `docs/fluxo-pagamento.md` | Fluxo de pagamento ponta a ponta, jobs ativos e desligados | texto |
| `docs/COMO-TRABALHAR-COM-IA.md` | Guia do time para trabalhar com IA neste repositório | texto |
| `docs/TECH-DEBT.md` | Registro de débitos técnicos | texto |
| `docs/cct dados conceitual.drawio` | Modelo conceitual de dados e regras de agrupamento (ordem, item, transação, DetalheA) | diagrama |
| `docs/cct-negocio.drawio` | Relação entre publicação, transação, item e lançamento | diagrama |
| `docs/cct metodos.drawio` | Sem conteúdo textual | diagrama (vazio) |
| `docs/NovoRemessa/Nova Arquitetura Remessa.drawio` | Arquitetura da geração de remessa (BigQuery, Postgres, CNAB, SFTP, banco) | diagrama |
| `docs/cronjobs/grantt-cronjobs.drawio` | Grade horária dos cron jobs | diagrama |
| `docs/cronjobs/cronjobs-cct.xlsx` | Agenda dos cron jobs em planilha | planilha |
| `docs/bilhetagem/negocio-bilhetagem.drawio` | Cron jobs de bilhetagem: salvar agrupamentos, sincronizar favorecidos, gerar remessa | diagrama |
| `docs/bilhetagem/sincronismo/logica-sincronismo.drawio` | Como transações são associadas às ordens (D1 a D6, ordem mais recente, ignora canceladas) | diagrama |
| `docs/bilhetagem/estado-usuario-historico-email.drawio` | Estados do usuário e do histórico de convite | diagrama |
| `docs/bilhetagem/pagamentos-indevidos/pagamentos-indevidos.md` | Regra de abatimento de pagamentos indevidos | texto |
| `docs/bilhetagem/pagamentos-indevidos/negocio-pagamentos-indevidos.drawio` | Sem conteúdo textual | diagrama (vazio) |
| `docs/bilhetagem/ocorrencias.md` | Uma linha sobre um código de ocorrência do banco | stub |
| `docs/bilhetagem/dias-anteriores.md` | Título apenas | stub |
| `docs/bilhetagem/tec/tec.md` | Título apenas | stub |
| `docs/lancamento/requisito/requisito-lancamento.md` | Datas padrão do lançamento (dias 05 e 20) | texto (curto) |
| `docs/lancamento/estado/diagrama-estado-lancamento.drawio` | Status do lançamento e transições | diagrama |
| `docs/lancamento/negocio/diagrama-negocio-lancamento.drawio` | Fluxo de negócio do lançamento (aprovações, remessa, retorno) | diagrama |
| `docs/lancamento/logica/diagrama-logica-lancamento.drawio` | Lógica do `GET /lancamento` | diagrama |
| `docs/lancamento/caso-de-uso/caso-de-uso-lancamento.drawio` | Papéis e permissões do lançamento; **contém nomes de pessoas, não copie** | diagrama |
| `docs/lancamento/caso-de-uso/caso-de-uso-lancamento.svg` | Imagem do diagrama anterior | imagem |
| `docs/lancamento/caso-de-uso/Permissoes-lancamento.pdf` | Permissões do lançamento | PDF |
| `docs/nest/auth.md`, `database.md`, `file-uploading.md`, `installing-and-running.md`, `introduction.md`, `readme.md`, `serialization.md` | Documentação do template NestJS usado como base | boilerplate |

## Observações

- O `README.md` da raiz aponta para um arquivo `readme.md` em `docs/` que não existe; este arquivo é o índice de fato.
- Arquivos de trabalho da IA (`docs/PRD.md`, `docs/TASKS.md`, `docs/tasks/`, `docs/task-runs/`, `docs/archive/`) ficam fora do git.
- Ao criar ou mover um arquivo em `docs/`, atualize esta tabela.
