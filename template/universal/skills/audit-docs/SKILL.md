---
name: audit-docs
description:
  Lint the docs/ tree, ADRs, and the docs index for drift accumulated across PRs. Use after an ADR
  supersession, at the end of a delivery phase, or on demand when drift is suspected. Report-only —
  never edits docs autonomously.
---

# Audit Documentation

Per-PR discipline (handled by `write-docs`) catches local drift. This skill catches drift that
accumulates across PRs — especially after ADR supersessions, large refactors, and milestones.

## When to run

- **After an ADR supersession.** Propagate the supersession through every citation.
- **After a long string of doc-touching PRs**, or a large refactor, when drift is suspected.

## What to check

1. **Supersession propagation.** For each ADR with `Status: Superseded by NNNN`, find every doc that
   cites the old ADR by number. Flag any citation that doesn't also acknowledge the newer ADR.
2. **Mechanical checks.** Run `{{audit_cmd}}` for index freshness, broken relative links, local
   anchors, and volume thresholds. Treat its output as findings, not as an autofix plan.

## Output

Single markdown report. Group findings as `Must fix` / `Should consider` / `Nit`. Skip empty groups.
If no findings, say so explicitly — don't manufacture.

Share the report in chat. For long reports, save to a path the {{maintainer}} can read and reference
it. The {{maintainer}} triages findings; a follow-up PR fixes them, reviewed normally.

## Hard rules

- **Read-only.** Never edit docs autonomously. Mass-rewriting cross-references via LLM is the failure
  mode this discipline exists to avoid. The audit surfaces drift; humans triage.
- **Stop and ask** if the audit surfaces >20 findings — that's a process signal, not a mass-fix
  opportunity.

## Mechanical check script

`scripts/audit-docs.cjs` requires Node and reports:

- `docs/index.md` entries missing actual immediate `docs/` children, or pointing at missing children.
- Broken relative markdown links and local anchors under `docs/` and root markdown files.
- ADRs above 200 lines and feature/package READMEs above 80 lines.

CI runs it with `--strict`: strict mode fails only on `Must fix` findings and skips volume
thresholds, which remain advisory for human triage.
