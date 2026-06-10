# 0002 — Multi-tool rendering from a single source

- **Status:** Accepted
- **Date:** 2026-06-03
- **Deciders:** Maintainer

## Decision

Author each skill, rule, and context file **once** and render it deterministically to the agent
tools the consumer selects (`targets`). `AGENTS.md` is the portable substrate: Cursor and Codex read
it natively; Claude Code gets a `CLAUDE.md` that imports it. Skills (`SKILL.md`, `name`+`description`
frontmatter) render to `.cursor/skills/`, `.claude/skills/`, and `.agents/skills/`. Scoped rules
render `globs` (Cursor) / `paths` (Claude); Codex has no glob-scoped rule mechanism, so such rules
fold into nested `AGENTS.md`.

## Why

The three tools converge on the same formats, so a single authored source maps to each target with a
destination change plus a one-key frontmatter rename. Emission is done by a deterministic scaffolder
rather than an agent, because emitting identical content to N targets is exactly where a probabilistic
author drifts — and some content (e.g. the worker prompt) must be passed verbatim.

Codex's skills live in `.agents/skills/`, **not** `.codex/skills/`; several third-party packages get
this wrong. Glob-scoped *instruction* rules cannot be represented in Codex — a scoping limitation, not
a content one; content always reaches the model.
