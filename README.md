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
  * [Features](#features)
  * [Quick run](#quick-run)
  * [Comfortable development](#comfortable-development)
  * [Links](#links)
  * [Automatic update of dependencies](#automatic-update-of-dependencies)
  * [Database utils](#database-utils)
  * [Tests](#tests)
  * [Tests in Docker](#tests-in-docker)
  * [Test benchmarking](#test-benchmarking)

## Quick run

```bash
git clone --depth 1 .git my-app
cd my-app/
cp env-example .env
docker compose up -d
```

For check status run

```bash
docker compose logs
```

## Comfortable development

```bash
git clone --depth 1 .git my-app
cd my-app/
cp env-example .env
```

Change `DATABASE_HOST=postgres` to `DATABASE_HOST=localhost`

Change `MAIL_HOST=maildev` to `MAIL_HOST=localhost`

Run additional container:

```bash
docker compose up -d postgres adminer maildev
```

```bash
npm install

npm run migration:run

npm run seed:run

npm run start:dev
```

## Links

- Swagger: http://localhost:3000/docs
- Adminer (client for DB): http://localhost:8080
- Maildev: http://localhost:1080

## Automatic update of dependencies

If you want to automatically update dependencies, you can connect [Renovate](https://github.com/marketplace/renovate) for your project.

## Database utils

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

## Tests

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e
```

## Tests in Docker

```bash
docker compose -f docker-compose.ci.yaml --env-file env-example -p ci up --build --exit-code-from api && docker compose -p ci rm -svf
```

## Test benchmarking

```bash
docker run --rm jordi/ab -n 100 -c 100 -T application/json -H "Authorization: Bearer USER_TOKEN" -v 2 http://<server_ip>:3000/api/v1/users
```
