---
name: grill-with-docs
description: A relentless interview to sharpen a plan or design, which also creates docs (ADR's and CONTEXT.md) as we go. Use at the start of any feature, refactor or non-trivial bug fix.
---

Before asking anything, read `PROJECT.md` and `CONTEXT.md` (when they exist) and skim the code in the affected area. Never ask what those already answer.

Then run a `/grilling` session, using the `/domain-modeling` skill to record terms in `CONTEXT.md` and decisions in `docs/adr/` as they are resolved.

Finish by stating plainly whether the plan is **ready** or **not ready** for `to-prd`, and list any open questions or assumptions. Write `CONTEXT.md` and ADRs in Brazilian Portuguese.
