# Contributing to the harness

The harness is a living template — it should grow as real-world usage reveals better patterns.
The intended flow is: **improvements are made in a real project first**, then harvested back here.
This keeps the harness grounded in practice rather than speculation.

Re-exporting is a manual step by design (see ADR `0001`).

## Bucket rules

When harvesting content from an origin project, assign every candidate file to a bucket:

| Bucket | Rule | Destination |
| --- | --- | --- |
| **A — keep verbatim** | No project-specific facts. Works as-is for any consumer. | `template/universal/` |
| **B — parameterize** | Contains project facts that become `{{placeholders}}` or conditional blocks. | `template/project/` or `template/providers/<provider>/` |
| **C — strip** | Domain content: product logic, business rules, stack-specific architecture. Never export. | — |
| **DISSOLVE — redistribute** | Content that lived in the wrong place upstream; split it to its correct homes before exporting. | Varies |

See `answers.schema.json` for the full set of available template variables.

## Process

1. For each candidate file, decide its bucket. The only real judgement call is distinguishing A from B — when in doubt, parameterize.
2. Apply the bucket transformation (copy verbatim / extract placeholders / strip / redistribute).
3. Treat DISSOLVE items as their own reviewed change — do not bundle them with bulk exports, as they are the most error-prone step.
4. Update `answers.example.json` if new template variables were introduced.
