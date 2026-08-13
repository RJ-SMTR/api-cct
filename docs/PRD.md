## Problem Statement

O sincronismo semanal de guardadores interrompe o fluxo de enriquecimento quando encontra um usuário já existente pelo documento. Com isso, usuários importados incorretamente no passado continuam sem campos cadastrais básicos, mesmo quando o BigQuery já fornece dados válidos para complementar o cadastro.

## Solution

Quando o sincronismo encontrar um guardador já existente na base, ele deve continuar tratando esse registro como existente para fins de criação, mas deve completar ou corrigir apenas os dados básicos e metadados de cadastro que possam ser obtidos ou inferidos da linha do BigQuery. O comportamento de criação, relacionamento e convite deve permanecer inalterado para novos usuários.

## User Stories

1. As an operations analyst, I want the weekly guardador sync to complement missing agent profile fields for existing users, so that legacy bad imports do not leave incomplete records forever.
2. As an operations analyst, I want existing guardadores to keep their current filled profile data, so that the sync does not overwrite manual corrections or trusted values already stored in the platform.
3. As an operations analyst, I want the sync to use the BigQuery email only when the existing user has no email, so that missing contact data can be recovered without changing valid addresses already in use.
4. As an operations analyst, I want the sync to derive agent name fields from the BigQuery row only when those name fields are empty in the platform, so that incomplete legacy users become usable in listings and registration flows.
5. As an operations analyst, I want the sync to replace legacy ghost emails that use the system fallback `@example.com` domain when BigQuery provides a different email, so that the guardador keeps a real contact address in CCT.
6. As an operations analyst, I want existing guardadores to be corrected to the expected guardador role and registration status during sync, so that legacy imports do not keep inconsistent access metadata.
7. As an operations analyst, I want the duplicate-detection behavior by document to remain intact, so that this fix does not create duplicate guardador users.
8. As an operations analyst, I want invitation behavior to stay the same for this fix, so that the change remains limited to profile data enrichment and metadata correction.

## Implementation Decisions

- The synchronization flow will keep using the normalized document as the existence check for agent users.
- When an existing agent user is found, the sync will calculate a partial backfill payload using only BigQuery-backed values.
- The backfill will only target missing basic profile fields available in the BigQuery row: email, fullName, firstName, lastName, and phone.
- Existing users found by the guardador sync will also be corrected to the expected guardador role and registration status used for newly created guardador users.
- An existing email using the fallback `@example.com` domain will be treated as a ghost email and may be replaced when BigQuery provides a different valid email.
- A field is considered missing when it is null, undefined, or blank after trimming.
- Existing non-empty values must not be overwritten.
- Synthetic fallback email generation remains exclusive to newly created agent users; existing users will only receive an email if BigQuery provides a valid real email.
- The existing repository update path will be reused for persistence so validation and logging stay consistent with the rest of the application.

## Testing Decisions

- A good test verifies observable synchronization behavior through `syncWeeklyAgentUsers`, not through private helper methods.
- The primary regression test will cover an existing agent user with partial missing data, wrong role/status metadata, and a ghost email, asserting that only the intended fields are corrected from the sync.
- Existing duplicate-user tests will continue asserting that duplicate detection prevents new user creation.
- Similar prior art already exists in `AgentesSyncService` specs, which exercise creation, duplicate skipping, relationship creation, and incremental cursor handling through the public service method.

## Out of Scope

- Re-sending or generating invites for pre-existing users that receive a backfilled email.
- Backfilling fields outside the basic profile scope, such as permit code, status, or role.
- Revisiting existing association-user synchronization rules.
- Repairing legacy records that contain incorrect non-empty values instead of missing values.
- Re-sending invites after ghost email replacement or role/status correction.

## Further Notes

- `WORKFLOW.md` was not present in the repository at implementation time, so this PRD records the minimum decision trail needed for a narrow bug fix while preserving the repository's documented PRD/TASKS gate.
