# src/cron-jobs

Job schedules and the manual remessa triggers for the payment pipeline. This moves real money. Read `CONTEXT.md` and `docs/fluxo-pagamento.md` before changing anything here.

## Do not

- Do not add or leave a `remessaModalExec`, `remessaGuardadorExec` or `remessaConsorciosExec` call in `onModuleLoad`, and do not re-enable `generateRemessaVLT`, `generateRemessaVanzeiros` or `generateRemessaEmpresa`. Payment is triggered manually (TD-9) and every app boot would resend the remessa. `onModuleLoad` calls none by default; the `remessaModalExec(true)` line that used to be there was removed on 2026-09-30, so an older branch or deploy may still generate a remessa at boot.
- Do not call remessa, sync or return reading from tests, scripts or exploration, and never run the app against a real database or SFTP from a branch that still has a `remessa*Exec()` call in `onModuleLoad`.
- `limparAgrupamentos` deletes the groupings of an interval. Today it is active only in `remessaGuardadorExec`; do not enable or remove it elsewhere without being asked.

## Things that are easy to get wrong

- `remessaConsorciosExec` returns without doing anything unless today is Tuesday or Friday. `remessaModalExec` and `remessaGuardadorExec` work on today only.
- `pagamentoUnico` uses the `cett` payer and skips the grouping step in `geradorRemessaExec`.
- Cron expressions are in GMT; comments and business talk use BRT (GMT-3).
- There are two sync jobs (modais and guardadores) with the same schedule. The guardador job currently calls the modais method, and the guardador sync uses a hard-coded date. Do not assume either is intended; ask before touching.
- Keep the try/finally around `acquireLock` / `releaseLock` for jobs that must not overlap.
- Keep Portuguese domain names (`remessa`, `favorecido`, `ordem de pagamento`); do not translate them.

## Verification

`cron-jobs.service.spec.ts` is skipped on purpose and cron jobs never get tests (TD-6). Put new logic in a separate function or service and give it a spec (PROJECT.md, "Testing"). Also check with `npx tsc --noEmit -p tsconfig.build.json` and `npm run validate`. Services must not import controllers and repositories must not import services (ESLint enforces it; see PROJECT.md, "Layer rules").
