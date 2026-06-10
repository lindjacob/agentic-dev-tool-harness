# 0005 — Guidance vs. enforcement

- **Status:** Accepted
- **Date:** 2026-06-03
- **Deciders:** Maintainer

## Decision

Separate soft guidance from hard enforcement. Guidance lives in skills and `AGENTS.md` context.
Hard, command-level prohibitions are declared once in `policy` and compiled into each target's
native blocking mechanism:

- Cursor — `.cursor/hooks.json` `beforeShellExecution` hook (`failClosed: true`)
- Claude Code — `.claude/settings.json` `permissions.deny`
- Codex — `.codex/rules/harness.rules` `prefix_rule(decision="forbidden")`

Each policy entry records which targets actually enforce it; the rest is guidance-only.

## Why

Context is not enforcement — a model can ignore prose like "never merge." For irreversible actions
(merging a PR, force-pushing main) that gap matters, and all three tools expose a real blocking
hook, so we use them. Enforcement scopes to the **agent's** command execution, not the maintainer's
own terminal, so forbidding `gh pr merge` blocks agents while a human's interactive `land` is
unaffected.

Limit, stated honestly: only command-level rules are mechanically enforceable. Role-scoped rules
("a worker never commits") and process rules ("new dependency needs an ADR") cannot be expressed as
a static command policy and remain guidance.
