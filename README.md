# agentic-dev-tool-harness

> Scaffold an agent-ready repo in one shot.

A one-shot scaffolder that gives a new repository the same agent-operable structure as a mature
one: issue → branch → PR → review → human-owned merge, with documentation treated as agent memory
and task skills that work across Cursor, Claude Code, and Codex.

This is **an opinionated starting point, meant to be forked and freely modified.** It ships working
defaults; nothing here is sacred. If a convention does not fit your project, change it.

## Why use this

- **Agent-ready, not agent-dependent.** Files are vendored into your repo. No runtime package to
  install or keep in sync — run the scaffolder once and own the result.
- **Cross-tool from one config.** A single `answers.json` renders skills and context for Cursor,
  Claude Code, and Codex. Pick the targets you use; skip the rest.
- **A real delivery workflow.** Issue → branch → PR → review, with the **human maintainer owning
  merge**. Agents stop at the open PR; enforcement blocks dangerous commands (e.g. `gh pr merge`).
- **Docs as agent memory.** ADR skeleton, reference discipline, and an optional docs-audit skill so
  documentation stays useful instead of rotting.
- **Stack-agnostic.** Your language, package manager, and test runner are configured via
  `verify_cmd` and the task runner — not baked in.
- **Zero install to run.** Clone and run with Node alone; the scaffolder has no dependencies.

## What you get

- **Skills** (`SKILL.md`) for the recurring work an agent does: implement an issue, review a PR,
  write an issue, write/amend an ADR, decide what to document, audit docs for drift.
- **Workflow scripts** behind a small provider-agnostic verb contract (`workon` / `done` / `land` /
  …). The only implementation today is **GitHub**, but skills never call the forge directly, so a
  second provider can be added without editing a skill.
- **Agent context** rendered to whichever tools you select: `AGENTS.md` (Cursor, Codex),
  `CLAUDE.md` (Claude Code), and per-tool skills directories.
- **Enforcement**, not just guidance: command-level prohibitions (e.g. never let an agent merge a
  PR) compiled into each tool's native blocking mechanism.
- A **docs skeleton** (`docs/index.md` + `docs/decisions/` for ADRs) and the documentation
  discipline that keeps it from rotting.

## Opinionated decisions

These are deliberate. Each has a backing ADR in [`docs/decisions/`](docs/decisions/).

1. **One unit of work = one issue = one branch = one PR.** Branches are `<id>-<slug>`. The **human
   maintainer owns the merge step**; agents stop at the open PR.
2. **Orchestration is the default workflow, with escape hatches.** A parent agent plans, delegates
   implementation to a worker subagent, reviews the diff, verifies, and opens the PR. Single-file /
   docs-only changes use a direct workflow; pure-logic work uses a TDD workflow. Delegation always
   *ships*; it is not always *invoked*.
3. **Documentation is agent memory.** Docs are intent, not mechanism, and obey a one-way reference
   rule (specific cites general; never the reverse; only indexes point down). ADRs capture
   irreversible decisions.
4. **A verification gate** (`verify_cmd`) must pass before a task is "done," and documentation the
   change makes necessary lands in the **same** PR.
5. **Guidance vs. enforcement are separated.** Soft rules live in skills/AGENTS context; hard
   prohibitions are compiled into tool enforcement. Only command-level rules can be enforced; role
   and process rules remain guidance.

## Hard dependencies

- `git` and a **POSIX shell** (`bash`). On Windows: WSL or Git Bash.
- **GitHub + authenticated `gh`** — the only forge/tracker provider implemented today. The workflow
  layer (scripts, `work-on-issue`, `write-issue`, `review-pr`, issue form, CI) assumes it. The
  methodology layer (`write-adr`, `write-docs`, `audit-docs`, the doc discipline) is forge-agnostic.
- **Node** — only for the `audit-docs` feature and the scaffolder itself. Independent of your
  project's own language/toolchain. Turn `features.docs_audit` off to drop the runtime need at use
  time.
- At least one supported **agent tool**: Cursor, Claude Code, or Codex.

Your project's package manager, language, and test runner are **not** assumed: the verb runner and
the verification command are both configured in `answers.json`.

The scaffolder itself has **zero runtime dependencies** — clone the repo and run it with Node alone,
no `npm install` step.

## Use it

1. Copy `answers.example.json` to `answers.json` and fill it in. `answers.schema.json` documents
   every field and gives editors validation/autocomplete (the example references it via `$schema`).
2. Run the scaffolder against your target repo:

   ```bash
   git clone https://github.com/lindjacob/agentic-dev-tool-harness.git
   cd agentic-dev-tool-harness
   node bin/init.mjs --answers answers.json --out /path/to/your/repo
   ```

3. The scaffolder emits only the tool targets and provider you selected. Init runs from this repo;
   your target repo gets the generated files and nothing else to uninstall.

## Repository layout

```text
template/universal/   methodology skills, independent of stack/forge/layout (carry at most the
                      global {{maintainer}} token)
template/project/     skills + AGENTS context coupled to workflow/provider/structure
template/providers/   per-provider verb implementations (github/ today) + provider artifacts
bin/init.mjs          deterministic scaffolder: substitute, select targets/provider, compile policy
docs/decisions/       this project's own ADRs (the decisions above)
answers.schema.json   the parameterization seam (JSON Schema: docs + editor support)
docs/contributing.md  how to harvest improvements from a real project back into the harness
```
