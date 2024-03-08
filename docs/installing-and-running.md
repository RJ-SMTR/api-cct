# Instalação

## Table of Contents

* [Instalação](#instalação)
  * [Table of Contents](#table-of-contents)
  * [Comfortable development](#comfortable-development)
  * [Quick run](#quick-run)
    * [Video guideline](#video-guideline)
  * [Links](#links)

---

## Comfortable development

1. Clone repository

    ```bash
    git clone --depth 1 https://github.com/brocoders/nestjs-boilerplate.git my-app
    ```

2. Go to folder, and copy `env-example` as `.env`.

    ```bash
    cd my-app/
    cp env-example .env
    ```

3. Change `DATABASE_HOST=postgres` to `DATABASE_HOST=localhost`

   Change `MAIL_HOST=maildev` to `MAIL_HOST=localhost`

4. Executar gerenciador de banco Adminer:

    ```bash
    docker compose up -d postgres adminer maildev
    ```

    Login no adminer (login de exemplo):
    - Sistema: `PostgreSQL`
    - Servidor: `postgres`
    - Usuário: `root`
    - Senha: `secret`
    - Base de dados: `api`

5. Install dependency

    ```bash
    npm install
    ```

6. Run migrations

    ```bash
    npm run migration:run
    ```

7. Run seeds

    ```bash
    npm run seed:run
    ```

8. Run app in dev mode

    ```bash
    npm run start:dev
    ```

9. Open http://localhost:3000

---

## Quick run

If you want quick run your app, you can use following commands:

1. Clone repository

    ```bash
    git clone --depth 1 https://github.com/brocoders/nestjs-boilerplate.git my-app
    ```

1. Go to folder, and copy `env-example` as `.env`.

    ```bash
    cd my-app/
    cp env-example .env
    ```

1. Run containers

    ```bash
    docker compose up -d
    ```

1. For check status run

    ```bash
    docker compose logs
    ```

1. Open http://localhost:3000

### Video guideline

https://user-images.githubusercontent.com/6001723/235758846-d7d97de8-dea9-46d8-ae12-8cc6b76df03d.mp4

---

## Links

- Swagger (API docs): http://localhost:3000/docs
- Adminer (client for DB): http://localhost:8080
- Maildev: http://localhost:1080

---

Previous: [Introduction](introduction.md)

Next: [Working with database](database.md)
