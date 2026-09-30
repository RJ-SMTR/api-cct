---
name: tdd
description: Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions "red-green-refactor", or wants integration tests.
---

# Test-Driven Development

## Philosophy

**Core principle**: Tests should verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't.

**Good tests** are integration-style: they exercise real code paths through public APIs. They describe _what_ the system does, not _how_ it does it. A good test reads like a specification - "user can checkout with valid cart" tells you exactly what capability exists. These tests survive refactors because they don't care about internal structure.

**Bad tests** are coupled to implementation. They mock internal collaborators, test private methods, or verify through external means (like querying a database directly instead of using the interface). The warning sign: your test breaks when you refactor, but behavior hasn't changed. If you rename an internal function and tests fail, those tests were testing implementation, not behavior.

**Tautological tests** restate the implementation inside the assertion, so they pass by construction and give zero confidence. When the expected value is computed the way the code computes it — `expect(add(a, b)).toBe(a + b)`, snapshotting a figure you derived by hand the same way the code does, asserting a constant equals itself — the test can never disagree with the code: break the code wrong and the assertion breaks wrong with it. The expected value must come from an independent source of truth — a known-good literal, a worked example, the spec.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

## Anti-Pattern: Horizontal Slices

**DO NOT write all tests first, then all implementation.** This is "horizontal slicing" - treating RED as "write all tests" and GREEN as "write all code."

This produces **crap tests**:

- Tests written in bulk test _imagined_ behavior, not _actual_ behavior
- You end up testing the _shape_ of things (data structures, function signatures) rather than user-facing behavior
- Tests become insensitive to real changes - they pass when behavior breaks, fail when behavior is fine
- You outrun your headlights, committing to test structure before understanding the implementation

**Correct approach**: Vertical slices via tracer bullets. One test → one implementation → repeat. Each test responds to what you learned from the previous cycle. Because you just wrote the code, you know exactly what behavior matters and how to verify it.

```
WRONG (horizontal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

RIGHT (vertical):
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  RED→GREEN: test3→impl3
  ...
```

## Workflow

### 1. Planning

Before coding, read `PROJECT.md`, `CONTEXT.md` (if it exists) so test names match the domain language, ADRs in the area you're touching, `docs/PRD.md` and the task file in `docs/tasks/` you are implementing. Feature and refactor work does not start without a PRD and a task plan; if they are missing, go back to `to-prd` / `task-planner`.

Work on one task at a time. When invoked by `task-runner`, it owns the status in `docs/TASKS.md`; when invoked directly, do not edit the index.

Before writing any code:

- [ ] Confirm with user what interface changes are needed
- [ ] Confirm with user which behaviors to test (prioritize)
- [ ] Identify opportunities for deep modules (small interface, deep implementation)
- [ ] List the behaviors to test (not implementation steps)
- [ ] Get user approval on the plan

Ask: "What should the public interface look like? Which behaviors are most important to test?"

**You can't test everything.** Confirm with the user exactly which behaviors matter most. Focus testing effort on critical paths and complex logic, not every possible edge case.

### 2. Tracer Bullet

Write ONE test that confirms ONE thing about the system:

```
RED:   Write test for first behavior → test fails
GREEN: Write minimal code to pass → test passes
```

This is your tracer bullet - proves the path works end-to-end.

### 3. Incremental Loop

For each remaining behavior:

```
RED:   Write next test → fails
GREEN: Minimal code to pass → passes
```

Rules:

- One test at a time
- Only enough code to pass current test
- Don't anticipate future tests
- Keep tests focused on observable behavior

### 4. Refactor

After all tests pass, look for [refactor candidates](refactoring.md):

- [ ] Extract duplication
- [ ] Deepen modules (move complexity behind simple interfaces)
- [ ] Apply SOLID principles where natural
- [ ] Consider what new code reveals about existing code
- [ ] Run tests after each refactor step

**Never refactor while RED.** Get to GREEN first.

## Validation

After each GREEN, run the narrowest check first and widen (see the validation ladder in `PROJECT.md`): prettier, eslint, `tsc --noEmit`, the focused spec, then `npm test`. Run `npm run test:e2e` when an endpoint, auth or DB behavior changed. Report which commands you ran and which you could not run.

For bugs, write the failing regression test first and confirm it fails for the right reason before touching the fix.

## Checklist Per Cycle

```
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive internal refactor
[ ] Expected values are independent literals, not recomputed from the code
[ ] Code is minimal for this test
[ ] No speculative features added
```

## This repository

- Specs are `src/**/*.spec.ts`, next to the source; e2e specs are `test/**/*.e2e-spec.ts`. Jest runs with `diagnostics: false`, so run `npx tsc --noEmit -p tsconfig.build.json` yourself.
- Use Nest's `Test.createTestingModule` and mock only boundaries: repositories that hit the DB, SFTP, BigQuery, mail, clock. See [mocking.md](mocking.md).
- Look at an existing spec in the same area (for example `src/users/users.repository.spec.ts` or `src/cnab/novo-remessa/service/retorno.service.spec.ts`) before writing a new one, and follow it.
- Tests run in UTC (`test/global-setup.ts`). Do not depend on the machine time zone.
- Policy: new or changed business logic gets a spec; never write tests for SFTP or cron jobs. The 13 failing suites (TD-1) do not have to be fixed to proceed.
- After a new spec passes, run `npm run validate:update-baseline` and commit the baseline. Until it is listed there the gate does not protect the spec.
