---
description: Run the api-cct validation ladder on the changed files
argument-hint: "[files or spec path]"
---

Run the validation ladder from PROJECT.md ("Validation ladder") on the current changes. Stop at the first failing step and report its output.

1. Find the changed files: `git diff --name-only` and `git diff --name-only --cached`. If `$ARGUMENTS` is given, use it instead.
2. Format check (informational, many files diverge, TD-3): `npx prettier --check <changed files>`. Report the result, do not stop on it.
3. Lint, check only (never `npm run lint`, it runs `--fix`): `npx eslint <changed files>`.
4. Types: `npx tsc --noEmit`.
5. Focused test: `npx jest <spec files related to the change>`. If no spec covers the change, say so.
6. Gate: `npm run validate` (about 40 s). It fails only when something gets worse than `scripts/validate/baseline.json`.

Do not run `npm run validate:update-baseline` here. Do not run migrations, seeds or anything that writes to a database.

End with a short table: step, result, and anything not verified.
