# API CCT

![github action status](https://github.com/RJ-SMTR/api-cct/actions/workflows/docker-e2e.yml/badge.svg)

## Descrição

*API do aplicativo CCT*  
(Centro de Compensação Tarifária)

[Documentação completa](https://github.com/RJ-SMTR/api-cct/blob/main/docs/readme.md)

Este projeto foi baseado no template [Nestjs Boilerplate](https://github.com/brocoders/nestjs-boilerplate/)

O [Projeto do App CCT](https://github.com/RJ-SMTR/app-cct) consome esta API.

## Table of Contents

* [API CCT](#api-cct)
  * [Descrição](#descrição)
  * [Table of Contents](#table-of-contents)
  * [Executar rapidamente](#executar-rapidamente)
  * [Desenvolvimento confortável](#desenvolvimento-confortável)
  * [Links](#links)
  * [Banco de dados](#banco-de-dados)
  * [Testes](#testes)
    * [Depurando testes](#depurando-testes)
  * [Testes no Docker](#testes-no-docker)
  * [Benchmarking de testes](#benchmarking-de-testes)

## Executar rapidamente

```bash
git clone --depth 1 .git my-app
cd my-app/
cp env-example .env
docker compose up -d
```

Para verificar status:

```bash
docker compose logs
```

## Desenvolvimento confortável

```bash
git clone --depth 1 .git my-app
cd my-app/
cp env-example .env
```

Mude `DATABASE_HOST=postgres` para `DATABASE_HOST=localhost`

Mude `MAIL_HOST=maildev` para `MAIL_HOST=localhost`

Executar contêiner adicional:

```bash
docker compose up -d postgres adminer maildev
```

Login no adminer (login de exemplo):

- Sistema: `PostgreSQL`
- Servidor: `postgres`
- Usuário: `root`
- Senha: `secret`
- Base de dados: `api`

Configurar projeto:

```bash
npm install

npm run migration:run

npm run seed:run

npm run start:dev
```

Rodar seed caso o banco não esteja vazio:
```
npm run seed:run __force
```

Rodar seed apenas de alguns módulos
```
npm run seed:run user mailhistory
```
> O comando não diferencia maiúsculas de minúsculas

Rodar seed com todos os módulos exceto alguns
```
npm run seed:run __exclude user mailhistory
> A ordem dos parâmetros não influencia a execução
```

## Links

- Swagger: http://localhost:3000/docs
- Adminer (client for DB): http://localhost:8080
- Maildev: http://localhost:1080

## Banco de dados

Generate migration

```bash
npm run migration:generate -- src/database/migrations/CreateNameTable 
```

Run migration

```bash
npm run migration:run
```

Revert migration

```bash
npm run migration:revert
```

Drop all tables in database

```bash
npm run schema:drop
```

Run seed

```bash
npm run seed:run
```

## Testes

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e
```

### Testando scripts localmente

Para testar scripts que fazem uso das mesmas boblioitecas e componentes deste projeto basta criar a seguinte pasta:
```bash
api-cct
📂 src
    📂 local_dev    # não sincornizado
        seus-scripts.ts
```

Para executar basta rodar:
```bash
ts-node "diretório do script"
```

### Depurando testes

**Exemplo de configuração no VSCode:**

Requisitos
- Extensão [Command Variable](https://marketplace.visualstudio.com/items?itemName=rioj7.command-variable)

.vscode/launch.json
```jsonc
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Jest test: Arquivo Atual",
            "type": "node",
            "request": "launch",
            "args": [
                "--runInBand"
            ],
            "cwd": "${fileDirname}",
            "runtimeArgs": [
                "--inspect-brk",
                "${workspaceFolder}/node_modules/jest/bin/jest.js",
                "${fileBasenameNoExtension}"
            ],
            "console": "integratedTerminal",
            "internalConsoleOptions": "neverOpen",
            "attachSimplePort": 9229,
        },
        {
            "name": "Jest test: Teste específico",
            "type": "node",
            "request": "launch",
            "args": [
                "--runInBand"
            ],
            "cwd": "${fileDirname}",
            "runtimeArgs": [
                "--inspect-brk",
                "${workspaceFolder}/node_modules/jest/bin/jest.js",
                "${fileBasenameNoExtension}",
                "--testNamePattern",
                "\".*${selectedText}\""
            ],
            "console": "integratedTerminal",
            "internalConsoleOptions": "neverOpen",
            "attachSimplePort": 9229,
        },
        {
            "name": "Jest e2e: Arquivo Atual",
            "type": "node",
            "request": "launch",
            "args": [
                "--runInBand"
            ],
            "cwd": "${workspaceFolder}",
            "runtimeArgs": [
                "--inspect-brk",
                "${workspaceFolder}/node_modules/jest/bin/jest.js",
                "--config",
                "${workspaceFolder}/test/jest-e2e.json",
                "${command:extension.commandvariable.file.relativeFilePosix}"
            ],
            "console": "integratedTerminal",
            "internalConsoleOptions": "neverOpen",
            "attachSimplePort": 9229,
        },
        {
            "name": "Jest e2e: Teste específico",
            "type": "node",
            "request": "launch",
            "args": [
                "--runInBand"
            ],
            "cwd": "${workspaceFolder}",
            "runtimeArgs": [
                "--inspect-brk",
                "${workspaceFolder}/node_modules/jest/bin/jest.js",
                "--config",
                "${workspaceFolder}/test/jest-e2e.json",
                "${command:extension.commandvariable.file.relativeFilePosix}",
                "--testNamePattern",
                "\".*${selectedText}\""
            ],
            "console": "integratedTerminal",
            "internalConsoleOptions": "neverOpen",
            "attachSimplePort": 9229
        }
    ],
}
```

## Testes no Docker

```bash
docker compose -f docker-compose.ci.yaml --env-file env-example -p ci up --build --exit-code-from api && docker compose -p ci rm -svf
```

## Benchmarking de testes

```bash
docker run --rm jordi/ab -n 100 -c 100 -T application/json -H "Authorization: Bearer USER_TOKEN" -v 2 http://<server_ip>:3000/api/v1/users
```
