# Guardador Consolidated Report Contract

## Scope

This document describes the frontend/backend contract for the consolidated guardador report filters implemented in:

- `src/relatorio/relatorio.controller.ts`
- `src/relatorio/interfaces/find-publicacao-relatorio.interface.ts`
- `src/relatorio/relatorio.service.ts`
- `src/relatorio/consolidado/relatorio-guardador-consolidado.repository.ts`

## Endpoint

- Method: `GET`
- Path: `/api/v1/cnab/relatorio/consolidadoGuardador`
- Auth: `Authorization: Bearer <jwt>`
- Content type: query string only

## Request Contract

### Required query params

- `dataInicio`: `YYYY-MM-DD`
- `dataFim`: `YYYY-MM-DD`

### Optional query params

- `favorecidoNome`: comma-separated string list
  - frontend example: `favorecidoNome=JOAO,MARIA`
  - for guardador flow, this filters guardador names
- `consorcioNome`: comma-separated string list
  - frontend example: `consorcioNome=ASSOCIACAO X,SINGAERJ`
  - in the guardador repository, this is effectively used as association name filter
- `valorMin`: number
- `valorMax`: number
- `pago`: boolean
- `aPagar`: boolean
- `emProcessamento`: boolean
- `rejeitado`: boolean
- `estorno`: boolean

### Serialization rules for frontend

- Send dates in `YYYY-MM-DD`.
- Send list filters as a single comma-separated query param.
- Omit empty filters instead of sending empty strings.
- Do not send `dataFim < dataInicio`.

## Filter Semantics

### Status filters

- No `pago` and no `aPagar`, with no name filters:
  - backend returns 4 blocks: `todos`, `pago`, `erros`, `aPagar`
- `pago=true`:
  - returns only `pago`
- `pago=false`:
  - returns only `erros`
- `aPagar=true`:
  - returns only `aPagar`
- `pago=true&aPagar=true`:
  - returns `pago` and `aPagar`

### Guardador-specific name filters

- If both `favorecidoNome` and `consorcioNome` are omitted, the repository unions association rows and guardador rows.
- If only `consorcioNome` is sent, the repository keeps the association side.
- If only `favorecidoNome` is sent, the repository keeps the guardador side.
- Special value `Todos` has custom backend behavior:
  - for `consorcioNome`, it maps to the two fixed association names
  - for `favorecidoNome`, it excludes those two association names from the guardador side

## Response Contract

The endpoint returns an array of status blocks:

```json
[
  {
    "count": 2,
    "valor": 150.5,
    "status": "todos",
    "data": [
      {
        "nome": "ASSOCIACAO X",
        "valor": 100.25
      },
      {
        "nome": "JOAO SILVA",
        "valor": 50.25
      }
    ]
  }
]
```

### Response field meanings

- `count`: number of rows in `data`
- `valor`: sum of all `data[].valor`, rounded to 2 decimals
- `status`: one of `todos`, `pago`, `erros`, `aPagar`
- `data[]`: consolidated lines
- `data[].nome`: display label for the row
- `data[].valor`: row amount, rounded to 2 decimals

## Error Contract

- Invalid date range returns HTTP `400`

```json
{
  "error": "Parametro de data inválido"
}
```

## Current Backend Gaps

- `consorcioNome` is a misleading parameter name for the guardador repository, because it behaves as an association-name filter there.
- The repository applies status using `pago`, `emProcessamento`, `rejeitado` and `estorno`, but the service currently also injects an internal `status` field that the repository does not read.
- The final SQL currently has signs of defects in post-union value filtering, so `valorMin` and `valorMax` should be validated with an integration test before the frontend relies on them.

## Frontend Recommendation

Build the UI against `consolidadoGuardador`, keep the same query contract above, and validate value-range filters against the real environment before considering them stable.
