## Symptom

The direct financial report download endpoint generated the export file, but the browser request stayed pending and the frontend never completed the download flow.

## Suspected Cause

The endpoint used `response.download(...)` with callback-based cleanup after generating a temporary file. That made the HTTP completion depend on `download()` callback behavior instead of a direct and explicit stream lifecycle.

## Affected Areas

- `api-cct/src/relatorio/novo-remessa/relatorio-novo-remessa.controller.ts`
- Direct download flow for `POST /cnab/relatorio-novo-remessa/report/export/download`

## Hypothesis

The export generation finished correctly, but the response lifecycle stayed open because the controller delegated transfer completion to `response.download(...)` rather than explicitly streaming the file and awaiting the stream termination.

## Validation Plan

- Replace `response.download(...)` with an explicit `createReadStream(...) -> response` pipeline.
- Keep temporary-file cleanup in `finally`.
- Re-run backend build and focused controller/service tests.

## Evidence

- Repository logs showed repeated export batch completion and a final export completion signal.
- The frontend request still remained pending after generation finished.
