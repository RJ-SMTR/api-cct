# PRD: Weekly Agent User Sync From BigQuery

## Summary

Implement a weekly cron job that imports new agent users from a BigQuery feed, creates missing agent person users in CCT, creates missing association users for unseen CNPJs, and queues invite emails for newly created agent person users when an email is available.

## Problem

Agent users are currently not synchronized automatically from the external source. The CCT needs a scheduled flow that:

- reads weekly agent records from BigQuery;
- creates agent person users when the person document is new;
- creates association users when the association CNPJ is new;
- reuses the current invite-email flow instead of creating a separate agent-specific mail pipeline unless a real difference is later required.

## Input Shape

The source rows will always follow this shape:

```json
{
  "id_cliente": "600",
  "nome": "Marcia Marques",
  "email": "marques.mcc@gmail.com",
  "telefone": "21996428346",
  "documento": "00036241709",
  "tipo_documento": "CPF",
  "cnpj": "42498733000148",
  "razao_social": "MUNICIPIO DE RIO DE JANEIRO",
  "nome_fantasia": "RIO DE JANEIRO GABINETE DO PREFEITO"
}
```

## In Scope

- Add a weekly cron scheduled for Friday 10:00 BRT.
- Introduce an agent BigQuery sync service/repository path.
- Create missing person users using:
  - `permitCode = id_cliente`
  - `fullName = nome`
  - `email = email`
  - `phone = telefone`
  - `cpfCnpj = documento`
  - `role = agents`
  - `status = register`
- Create missing association users using:
  - generated placeholder email in the format `user+<random>@example.com`
  - `fullName = razao_social`
  - `cpfCnpj = cnpj`
  - `phone = 5551999999999`
  - `permitCode = null`
  - `role = admin`
  - `status = null`
- Use normalized document matching for deduplication:
  - person rows by `documento`
  - association rows by `cnpj`
- Do not update existing users when source values differ.
- Queue invite rows for newly created person users when an email exists.
- Verify whether the current invite email flow already works for agents and keep that shared flow if there is no real behavioral split.

## Out Of Scope

- Real BigQuery table selection and production SQL finalization.
- Updating existing users when phone, email, or name changes in the source.
- Designing a separate email template exclusively for agents.
- Modeling an explicit persisted relation between person users and association users beyond creating both records.

## Functional Requirements

1. The cron must run once per week on Friday at 10:00 BRT.
2. The sync must fetch rows from a BigQuery-oriented repository abstraction.
3. If the person document does not already exist in `user`, a new agent user must be created.
4. If the association CNPJ does not already exist in `user`, a new association user must be created.
5. Existing matching users must be left unchanged.
6. Newly created person users with a valid email must receive a queued invite entry in `invite`.
7. The implementation must reuse the current `sendConcludeRegistration` / queued invite flow unless code inspection proves a required difference for agents.

## Acceptance Criteria

- A scheduled cron entry exists for the weekly agent sync.
- Running the sync with new rows creates new person users with role `agents` and status `register`.
- Running the sync with new rows creates association users for unseen CNPJs.
- Running the sync twice with the same rows does not duplicate users.
- Newly created person users with email generate queued invite entries.
- Existing invite sending flow remains valid for agent users.
- The code compiles and targeted tests cover duplicate-skip and invite-queue behavior.
