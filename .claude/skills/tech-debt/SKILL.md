---
name: tech-debt
description: Load this yourself, without being asked, whenever work introduces or reveals technical debt — the user accepts a partial or temporary solution ("for now", "fix later"), a test is skipped or disabled, a check is silenced (eslint-disable, @ts-ignore, --no-verify), the validation baseline is relaxed, a bug is worked around instead of fixed, or known behavior is left untested. Ask the user whether to record it in docs/TECH-DEBT.md; never record without their yes.
user-invocable: false
---

# tech-debt

Keep `docs/TECH-DEBT.md` honest. The user often does not realize they are taking on debt, so notice it, name it, and ask. This skill is triggered by you, not by the user.

## Signals

Treat any of these as likely debt:

- The user (or you) accepts a partial, temporary or "good enough" solution: "por enquanto", "depois a gente arruma", "só pra passar".
- A test is skipped, disabled or focused: `it.skip`, `xit`, `describe.skip`, `.only`, a suite commented out.
- A check is silenced: `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `as any` to quiet an error, `git commit --no-verify`.
- The validation baseline is relaxed: `npm run validate:update-baseline` that lets a suite fail or an eslint count rise.
- A bug is worked around without fixing the cause, or a known failure is left behind.
- Behavior is added or changed without a test, on purpose.
- Code is duplicated or a hack is added to avoid a refactor.
- A `TODO` or `FIXME` is left for something that matters.

Not debt: a conscious, documented decision (that is an ADR), pure formatting or renames, and anything that already has a `TD-n` entry.

## Flow

1. Read `docs/TECH-DEBT.md` first. If the debt is already there, do not ask again; mention its id instead.
2. Describe the debt in one sentence and propose a payment criterion (what must be true to close it).
3. Ask **once**, briefly, in the user's language: "Isso parece um débito técnico: <uma frase>. Quer que eu registre em docs/TECH-DEBT.md?"
4. Do not ask again about the same debt in this session. If the answer is no, write nothing.
5. On yes:
   - next id = highest `TD-n` + 1;
   - **Registrado por**: `git config user.name` (ask if empty); **Detectado por**: `agente` whenever you were the one to point out that it is debt (the usual case, even if the user asked for the shortcut), `pessoa` only if the user themselves called it debt or asked to log it; **Data**: today, `AAAA-MM-DD`;
   - add a row to the index table and a `## TD-n` section at the end, in Brazilian Portuguese, with Status `aberto`, Contexto, Impacto/risco and Critério de pagamento, following the existing entries;
   - never edit or delete other entries.
6. Mention the new `TD-n` in your final report for the task.

## Paying a debt

Only when its payment criterion is met and verified: set Status `pago` and add **Pago por**, **Data do pagamento** and **Referência** (commit or PR). Never delete the entry. If the criterion is not met, say so and leave it `aberto`.

## Rules

- Never write to `docs/TECH-DEBT.md` without an explicit yes.
- One short question, not a form. Do not interrupt for trivia.
- Ids are never reused; if two branches add the same id, the later one renumbers on merge.
