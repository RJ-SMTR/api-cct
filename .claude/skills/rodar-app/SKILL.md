---
name: rodar-app
description: >
  Sobe a api-cct (NestJS, este repositório) e o cct-app (React, repositório irmão em ../app-cct)
  em modo desenvolvimento ou produção local, com o Postgres e a comunicação front→back configurados.
  Use quando pedirem para "rodar o projeto", "subir o app", "levantar em dev/produção", "iniciar a API
  e o front", "testar a aplicação rodando" ou "ver a feature funcionando no navegador".
---

# Rodar o CCT (API + Front)

Sobe a **api-cct** (NestJS 9) e o **cct-app** (React 18 + react-app-rewired), já se comunicando,
em modo **desenvolvimento** ou **produção**. Se o pedido não deixar claro o modo, pergunte antes de agir.

## Caminhos

Os caminhos não são fixos: a API é o repositório atual e o front é o repositório irmão `app-cct`
ao lado dele. Antes de qualquer comando, defina as variáveis (no Bash do Git for Windows):

```bash
API_DIR="$(git rev-parse --show-toplevel)"
APP_DIR="$(dirname "$API_DIR")/app-cct"
test -d "$APP_DIR" || { echo "app-cct não encontrado em $APP_DIR"; exit 1; }
```

Se o `app-cct` não estiver ao lado, pergunte ao usuário onde ele está e use esse caminho em `APP_DIR`.
Nos comandos abaixo, `$API_DIR` e `$APP_DIR` representam esses caminhos. Cada comando precisa
definir as variáveis de novo, porque o shell não mantém estado entre chamadas.

Produção aqui é build local rodando na máquina, não um deploy (deploy é `cd.yaml` / `cd_stag.yaml`, fora desta skill).

## Regras de segurança (do `.claude/settings.json` e de `PROJECT.md`)

- **Nunca leia `.env`** com a ferramenta de leitura nem com `cat`/`sed`: está bloqueado e não é necessário.
  Para saber a porta da API, peça ao usuário (ou use a informada por ele). Para o front, passe as
  variáveis inline no comando, como mostrado abaixo.
- **Não rode migrations nem seeds sem perguntar** (`npm run migration:*`, `npm run seed:run` são "ask first").
  Este fluxo só *sobe* a aplicação; não executa `startup.dev.sh` (que roda migrations e seed).
- **Não derrube o banco**: nunca `docker compose down` ou `docker rm` sem confirmação (apaga `./.data/db`).
- Não mate processos de outra sessão ou de outro agente que estejam nas portas. Antes, identifique-os
  (ver "Portas") e pergunte.

## Portas e URLs

| Serviço | Porta | URL |
| --- | --- | --- |
| Postgres (compose `postgres`) | `DATABASE_PORT` (do `.env` da API, pedir ao usuário) | — |
| API (`api-cct`) | `APP_PORT` do `.env` (código usa 3000 se não definido) | `http://localhost:<APP_PORT>/api/v1/...` (prefixo global `api`, versão por URI `v1`) |
| Front (`cct-app`) | 3001 (fixo nesta skill; 3000 costuma ser a API) | http://localhost:3001 |
| Swagger da API | mesma do `APP_PORT` | http://localhost:<APP_PORT>/docs (registrado em `src/main.ts` em qualquer ambiente) |

Front → back: o cliente usa `REACT_APP_BASE_URL_CCT` (`app-cct/src/app/configs/api/api.js`). O default
é a homologação (`https://api.cct.hmg.mobilidade.rio/api/v1/`), então **sempre** passe a variável
apontando para a API local, com a barra final:

```bash
REACT_APP_BASE_URL_CCT=http://localhost:<APP_PORT>/api/v1/
```

Se a API rodar na 3000 (porta padrão do código) e o front também tentar a 3000, o CRA pede outra porta;
por isso o front sempre sobe com `PORT=3001`.

## Pré-requisitos (checar antes de subir)

1. **Node 18.16.0** na API (`.nvmrc`): `nvm use` dentro de `api-cct`. Confira com `node -v`.
2. **Arquivos de ambiente existem**: `api-cct/.env` (copiar de `env-example` se faltar, ajustando
   `DATABASE_HOST=localhost` e `MAIL_HOST=localhost`) e, para o front, nenhum arquivo é obrigatório
   porque as variáveis vão inline. Se faltar o `.env` da API, peça ao usuário os valores; não invente.
3. **Dependências instaladas**:
   - `npm install` em `api-cct` (só se `node_modules` não existir).
   - `npm install` em `app-cct` (só se `node_modules` não existir). O projeto tem `yarn.lock` e
     `package-lock.json`; use o gerenciador que o usuário já usa, por padrão `npm`.
   Não reinstale a cada vez.

## Banco de dados (comum a dev e produção)

O Postgres sobe por Docker. Não existe `docker-compose.yaml` versionado (só `docker-compose.example.yaml`
e `docker-compose.ci.yaml`); o setup de `PROJECT.md` assume um `docker-compose.yaml` local.

```bash
cd "$API_DIR" && docker ps --filter "name=postgres" --format '{{.Names}} {{.Status}}'
```

- Já aparece `Up`: segue.
- Existe mas está parado: `docker compose start postgres`.
- Não existe: se houver `docker-compose.yaml` local, `docker compose up -d postgres`; senão,
  `docker compose -f docker-compose.example.yaml up -d postgres`. Pergunte antes se a instância for
  de um banco que não seja local.

Não rode `migration:run` aqui. Se a API reclamar de tabela inexistente, avise o usuário e pergunte se
pode rodar a migration (é ação que pede confirmação).

## Modo desenvolvimento (hot reload nos dois lados)

1. Banco: passos acima.
2. API, em background (`run_in_background: true` no Bash):
   ```bash
   cd "$API_DIR" && npm run start:dev
   ```
   Sobe com `nest start --watch`, que recompila ao salvar.
3. Front, em background, apontando para a API:
   ```bash
   cd "$APP_DIR" && REACT_APP_BASE_URL_CCT=http://localhost:<APP_PORT>/api/v1/ PORT=3001 BROWSER=none npm start
   ```
   `BROWSER=none` evita abrir o navegador sozinho; abra você mesmo o link.
4. Validar que os dois sobem:
   - `curl -s -o /dev/null -w '%{http_code}' http://localhost:<APP_PORT>/docs` deve responder `200`.
   - `curl -s -o /dev/null -w '%{http_code}' http://localhost:3001` deve responder `200`.
   - Se o front estiver de pé, confira no log que compilou sem erro (`Compiled successfully!`).
5. Reportar ao usuário as duas URLs e que os processos estão em background. Não ficar esperando
   eles terminarem.

## Modo produção (build local, sem infra de deploy)

Objetivo: validar o build antes do pipeline de deploy.

1. Banco: mesmos passos do modo dev.
2. API: build, depois start (não em background para o build; ele precisa terminar antes).
   ```bash
   cd "$API_DIR" && npm run build
   ```
   ```bash
   cd "$API_DIR" && npm run start:prod
   ```
   `start:prod` é `node dist/main`, sem watch. Rode em background.
3. Front: build com `REACT_APP_BASE_URL_CCT` já definido (CRA grava a URL no bundle no momento do build,
   então passar a variável só no start não adianta):
   ```bash
   cd "$APP_DIR" && REACT_APP_BASE_URL_CCT=http://localhost:<APP_PORT>/api/v1/ GENERATE_SOURCEMAP=false npm run build
   ```
   Depois servir a pasta `build/` na 3001 (sem SPA server no projeto; `npx --yes serve -s build -l 3001`
   serve para o fallback de rotas do React Router):
   ```bash
   cd "$APP_DIR" && npx --yes serve -s build -l 3001
   ```
4. Mesma validação de saúde do modo dev (`/docs` na porta da API e `200` na 3001).
5. Deixar claro que é build de produção rodando local, não deploy.

## Rodando com outro agente ou outra sessão na máquina

Se a porta `APP_PORT` ou 3001 já estiver ocupada, identifique antes de agir:

```bash
netstat -ano | grep -E ":(<APP_PORT>|3001) " | grep LISTENING
```

- Se for processo seu de uma sessão anterior e servir ao que você precisa, reaproveite e só aponte o
  `REACT_APP_BASE_URL_CCT` para ele.
- Se for de outro agente (ex.: Cursor) ou de dúvida, **não mate**. Pergunte ao usuário e, se ele aprovar
  rodar em paralelo, use portas livres (ex.: API `3002`, front `3003`) e informe que são instâncias isoladas.
- Não faça checkout nem troca de branch em `api-cct` ou `app-cct` para isolar: isso pode corromper o
  trabalho de outro agente. Use `git worktree` se precisar de outra branch.

## Encerrar

- Processos em background: `TaskStop`, ou matar só o PID da porta depois de confirmar que é seu
  (`netstat -ano | grep LISTENING` mostra o PID; `taskkill /PID <pid> /F` no Windows).
- Banco: pode ficar rodando entre sessões. Só `docker compose stop postgres` se o usuário pedir.
  Nunca `docker compose down -v` ou `docker rm` sem confirmação.

## Erros comuns

- **API não conecta ao banco**: container parado ou `DATABASE_PORT` do `.env` não bate com o mapeamento
  do compose. Confira com o usuário, sem ler o `.env`.
- **`Port 3000 is already in use` ou o front pede outra porta**: a API está na 3000. Use `APP_PORT`
  diferente ou mantenha a 3001 para o front, como esta skill faz.
- **Front chama o servidor de homologação** (requisições para `api.cct.hmg...`): a variável
  `REACT_APP_BASE_URL_CCT` não foi passada, ou no modo produção foi passada só no start. Refaça o build
  com ela.
- **CORS no navegador**: confira se o front (3001) está na lista de origens aceitas pela API
  (`FRONTEND_DOMAIN` no `.env` da API, pedir ao usuário). Não edite CORS sem perguntar.
- **Node errado**: a API exige `>=18.16.0`; rode `nvm use` antes de subir.
- **Build do front falha por `NODE_OPTIONS`/OpenSSL**: é de versão de Node do Webpack 4 do CRA; se
  acontecer, avise o usuário com o erro exato em vez de sair mexendo em `config-overrides.js`.

## Ao final, reporte

- Modo (dev ou produção), URLs usadas, portas e a `REACT_APP_BASE_URL_CCT` efetiva.
- O que foi validado (`/docs`, `/api/v1`, `200` no front) e o que não foi (ex.: fluxo de login ou dados reais).
- Se algum passo foi pulado ou pedido ao usuário (migration, `.env` faltando, porta ocupada).
