## Problem

The current financial movement report export is generated entirely in the frontend (`app-cct/src/app/main/pages/admin/Report/components/FinancialMovement.js`). The browser builds CSV, PDF, and XLSX from the currently loaded page data, while summary totals come from a separate backend call. This causes poor UX, inconsistent export completeness for large datasets, duplicated presentation logic on the client, and scalability limits when report sizes grow.

## Objective

Move financial movement export generation fully to the backend so the frontend only submits an authenticated export request. The backend must own querying, file generation, and direct browser delivery through a single download endpoint.

## Scope

- Replace frontend file generation with an export request action for the financial movement report.
- Preserve the current filter model and business rules used by the financial movement flow.
- Add one backend export endpoint that returns the generated file directly to the browser.
- Require authenticated admin access through the existing JWT/auth flow.
- Generate one format per request: `csv`, `xlsx`, or `pdf`.
- Reuse the existing financial movement report SQL/filter logic as the source of truth.
- Return the generated file directly for the browser-download flow with the correct `Content-Type` and `Content-Disposition`.
- Support large result sets with a design that avoids loading the full dataset into Node.js memory where practical.

## Out Of Scope

- Changing the business meaning of existing filters or statuses.
- Refactoring unrelated report types (`consolidado`, `sintetico`, `analitico`).
- Building a user-facing download center, persistent export history UI, or retry dashboard.
- Introducing a new queue system unless an existing codebase mechanism cleanly supports it.
- Guaranteeing zero-buffer generation for formats that intrinsically require workbook/document state before finalization.
- Reintroducing asynchronous email delivery for this report.

## Affected Areas

- Frontend
  - `app-cct/src/app/main/pages/admin/Report/components/FinancialMovement.js`
  - `app-cct/src/app/store/reportSlice.js`
- Backend
  - `api-cct/src/relatorio/novo-remessa/relatorio-novo-remessa.controller.ts`
  - `api-cct/src/relatorio/movimentacao-financeira/relatorio-novo-remessa-financial-movement.service.ts`
  - `api-cct/src/relatorio/movimentacao-financeira/relatorio-novo-remessa-financial-movement.repository.ts`
  - `api-cct/src/relatorio/dtos/pay-and-pending-query.dto.ts`
  - `api-cct/src/relatorio/relatorio.module.ts`
- Dependencies
  - Potential backend additions for PDF generation, CSV/XLSX streaming, PostgreSQL streaming, and optional compression support.

## Technical Impact

- Frontend responsibility shrinks to request submission and user feedback, improving KISS and reducing duplicated export logic.
- Backend becomes the single source of truth for report content and filenames, improving correctness and maintainability.
- Pagination and export batching must use the same deterministic row identity so grouped rows are never skipped or duplicated across page/export boundaries.
- The current paginated financial movement query path should be refactored into shared query-building logic plus a dedicated non-paginated export reader.
- CSV export should stream rows directly from PostgreSQL to the output writer.
- XLSX export should use a streaming workbook writer instead of building a full workbook in memory. If that is not available in the current dependency set, the API must enforce a conservative XLSX row limit and direct larger exports to CSV.
- PDF export should be treated as the least stream-friendly format and may require staged generation with bounded buffering or temporary-file output.
- GZIP should be applied selectively where it materially reduces transfer/storage size without hurting usability. It should stay disabled for the direct browser-download endpoint so the user receives the requested extension directly.
- `fast-json-stringify` is not expected to provide material benefit because the export pipeline is dominated by SQL reads and binary/text file generation, not high-volume JSON API serialization.

## Risks

- Existing frontend export content is currently based on page data while summary totals come from a separate endpoint; aligning a backend export with the intended full dataset may surface previously hidden inconsistencies.
- Large PDFs and non-streaming XLSX generation can still consume significant CPU and memory.
- Direct downloads hold the HTTP connection open for the full generation and transfer lifecycle, which is worse for long-running exports than the email flow.
- The current frontend JWT-in-localStorage model prevents a true browser-native authenticated download without additional auth plumbing, so the short-term download flow may still buffer in the browser even after backend generation is fixed.
- Backend role restrictions must be tightened because the current financial movement endpoints use JWT auth but not explicit admin role guards.
- Temporary-file lifecycle and cleanup must be handled safely if files are staged on disk before response streaming.
- Browser cancellation during download must still trigger temporary-file cleanup.

## Test Strategy

- Unit test filter normalization and export request DTO validation.
- Unit test status mapping parity between page/summary/export flows.
- Integration test export endpoint auth rules for admin and non-admin users.
- Integration test repository export path against representative filters, including:
  - no status filters
  - `Pendência de Pagamento` variants
  - `Eleição`
  - `Desativados`
  - user/consortium filters
  - min/max values
- Verify generated CSV/XLSX/PDF contain the same rows and totals for the same filter set.
- Verify direct-download responses return the expected filename, content type, and uncompressed requested format.
- Validate behavior for empty result sets and large result sets.

## Acceptance Criteria

- Frontend no longer generates or downloads report files locally.
- A single authenticated backend export endpoint exists for financial movement report requests.
- The endpoint accepts the existing filter set plus a required output format.
- The endpoint requires JWT auth and explicit admin-authorized roles.
- Backend export content matches the financial movement report dataset and business rules.
- CSV, XLSX, and PDF exports contain the same underlying report rows and totals for the same request.
- The API returns the generated file directly and triggers a browser download using the selected format extension.
- The implementation is designed for large datasets with streaming/cursor-based reading where it materially improves memory usage.
- Compression is used only where appropriate and transparent to the recipient.
