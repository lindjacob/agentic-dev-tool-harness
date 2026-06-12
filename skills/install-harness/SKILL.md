---
name: install-harness
description:
  Install the harness into a destination repo — inspect the repo, propose answers, run the
  deterministic scaffolder, and merge conflicts with the user. Use when the user asks to install,
  scaffold, or adopt the harness into a repository (empty or brownfield).
---

# Install the harness

Agentic front-end, deterministic core. You gather and propose the answers and you resolve merge
conflicts — but **file emission is always `bin/init.mjs`**. Never write template output by hand:
the rendered files (especially the compiled enforcement policy) must come from the scaffolder so
they are reproducible and re-runnable. If generated output is wrong, fix `answers.json` and re-run;
the scaffolder is idempotent (identical files are skipped, differing ones become `*.harness-new`).

## Phase 1 — Inspect the destination repo

Propose answers from evidence before asking anything. Map findings to `answers.schema.json` fields:

| Evidence in destination | Answers field |
| --- | --- |
| `git remote get-url origin` | `project.repo` (owner/name) |
| README / package manifest description | `project.name`, `project.description` (propose; confirm) |
| Manifest + lockfile (`package.json`/`pnpm-lock.yaml`/`Cargo.toml`/`Makefile`/`justfile`…) | `workflow.task_runner` |
| Existing lint/typecheck/test scripts or CI steps | `workflow.verify_cmd` candidate |
| `apps/` + `packages/` (or similar) layout | `workflow.monorepo` |
| Existing `.cursor/`, `.claude/`/`CLAUDE.md`, `.codex/`/`.agents/` directories | `targets` |
| Existing `AGENTS.md`, CI workflows, hooks, settings | expect conflicts in Phase 4 |

Verify the `verify_cmd` candidate by running it in the destination before proposing it. A
verification gate that fails on a clean checkout is worse than none.

## Phase 2 — Interview, then sign-off

Ask the user only what inspection could not settle — typically: which `targets` they actually use,
the `roles.maintainer` label, extra `policy` entries beyond the defaults, and `docs.areas`. Do not
ask questions the repo already answers.

Then write `answers.json` in the harness checkout, show it to the user in full, and get explicit
sign-off before scaffolding. The answers file is the contract and audit trail of the install.

## Phase 3 — Run the scaffolder

```bash
node bin/init.mjs --answers answers.json --out /path/to/destination
```

- Run from the harness checkout; `--out` must never point at the harness repo itself.
- Read the output: `NOTE:` lines need Phase 5 wiring; `CONFLICT:` lines drive Phase 4.

## Phase 4 — Resolve conflicts with the user

The scaffolder never overwrites: each conflicting file keeps the destination's version and writes
the rendered version alongside as `<file>.harness-new`. Find them all (`**/*.harness-new`), then
for each one: read both versions, propose a merged file, show the user the diff, apply on
approval, and delete the `.harness-new`. The phase is done when no `*.harness-new` remains.

How to judge the merge depends on the kind of file:

### Documentation and agent context — use the `write-docs` skill

For `AGENTS.md` (root or nested), `CLAUDE.md`, and anything under `docs/`: read and apply
[`template/universal/skills/write-docs/SKILL.md`](../../template/universal/skills/write-docs/SKILL.md)
— reference direction, one source of truth per fact, volume budget, intent-not-mechanism. (It is a
template; read `{{maintainer}}` as the answers' `roles.maintainer`.) Concretely: preserve the
destination's project-specific content, adopt the harness's commands / skills / hard-rules
sections, and resolve duplicated facts by keeping one statement and pointing at it.

### Tool config — mechanical merges

| File | Merge rule |
| --- | --- |
| `.claude/settings.json` | Union the `permissions.deny` / `permissions.ask` arrays into the existing file; keep all other existing keys. |
| `.cursor/hooks.json` | Append the harness's `beforeShellExecution` entry to the existing hooks; keep existing entries. |
| `.cursor/hooks/harness-policy.sh` | Never hand-merge the script body. Keep an existing user hook as its own entry in `hooks.json` and install the harness script unmodified beside it. If the policy itself is wrong, change `answers.json` and re-run the scaffolder. |
| `.codex/rules/harness.rules` | Concatenate the harness rules onto the existing rules. |
| `.github/workflows/ci.yml` | Do not rewrite an existing workflow. Add the harness's steps as a separate workflow file (e.g. `harness-ci.yml`) or a separate job, with the user's approval. |
| `justfile` / manifest scripts | Add the verb recipes alongside existing recipes; never rename or remove existing ones. |
| `.cursor/sandbox.json` | Union the `allow` lists; keep the stricter `default`. |

## Phase 5 — Wire and verify

1. If the scaffolder printed a task-runner `NOTE`, wire the six verbs (`workon`, `done`, `land`,
   `create-item`, `review`, `comment-review`) to `./scripts/<verb>` in the destination's manifest,
   with the user.
2. Verify the install:
   - Run `verify_cmd` in the destination; it must pass.
   - Behavior-test the enforcement hook: pipe a forbidden command through it and expect deny —
     `printf '%s' '{"command":"gh pr merge 1"}' | sh .cursor/hooks/harness-policy.sh` →
     `"permission":"deny"`; an allowed command must return `"permission":"allow"`.
   - `gh auth status` succeeds, since the GitHub provider scripts assume it.
3. Summarize what was installed, merged, and skipped. Leave reviewing and committing the result to
   the maintainer unless they explicitly ask you to commit.

## Stop and ask

- The destination already encodes a conflicting workflow philosophy (e.g. agents merge their own
  PRs, trunk-based pushes to main) — surface the contradiction; do not silently impose the harness.
- `verify_cmd` fails and the fix is not obvious.
- A merge would delete destination content you cannot confidently classify as superseded.
