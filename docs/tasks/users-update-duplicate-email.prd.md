## Problem Statement

Ao atualizar um usuário pela rota `PATCH /users/:id`, quando o e-mail informado já pertence a outro usuário, a API responde com um erro de validação genérico. Isso não deixa claro para o consumidor da rota que o problema específico é conflito de e-mail já em uso.

## Solution

Padronizar a resposta de erro do fluxo de atualização de usuário para que, quando houver conflito de unicidade de e-mail, a resposta `422 Unprocessable Entity` informe explicitamente que o e-mail já está em uso, preservando o envelope de erro já utilizado pela API.

## User Stories

1. As an admin user, I want the user update endpoint to tell me when an email is already in use, so that I can correct the submitted data without guessing the cause.
2. As an API consumer, I want duplicate-email failures on `PATCH /users/:id` to return a stable validation message, so that I can display the proper feedback in the client.
3. As a developer, I want a regression test for duplicate-email updates, so that future refactors do not bring back the generic validation response.

## Implementation Decisions

- The change is limited to the user update flow and does not alter other validation entry points.
- The route keeps returning `422 Unprocessable Entity` for validation failures.
- The response envelope remains the current validation envelope, but the message for duplicate-email conflicts becomes explicit instead of the current generic DTO-validation text.
- The update validation still relies on the existing uniqueness validator for email; the change only standardizes the response emitted by the update flow.

## Testing Decisions

- The main regression coverage should exercise the public HTTP interface of the admin users update route.
- A good test should verify observable API behavior: status code and returned validation message, not repository internals.
- Existing admin users e2e tests provide prior art for authenticated `PATCH /users/:id` validation coverage.

## Out of Scope

- Changing duplicate-email responses for user creation or authentication flows.
- Returning metadata about the conflicting user.
- Changing the persistence rules for user uniqueness.

## Further Notes

- The repository currently uses `emailAlreadyExists` as the duplicate-email validation key; this bug fix keeps that contract and makes the update response explicit.
