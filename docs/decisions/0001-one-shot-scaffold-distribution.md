# 0001 — One-shot scaffold distribution

- **Status:** Accepted
- **Date:** 2026-06-03
- **Deciders:** Maintainer

## Decision

Distribute the harness by **scaffolding once** into a consumer repo, not as a runtime dependency or
an auto-updating template. The origin repo stays authoritative; improvements are re-exported
manually (see `EXPORT.md`). Add update machinery (e.g. Copier-style) only when a second consumer
proves it is needed.

## Why

Agent tools discover skills, rules, and `AGENTS.md` by reading files in the working tree — there is
no `node_modules`-style resolution for agent context. So the content must be vendored regardless;
the only real choice is one-shot vs. updatable. One-shot is the smallest thing that works and
matches the "fork and modify freely" intent: consumers are expected to diverge.

Rejected alternatives: *runtime dependency* — not how agent context loads. *Copier/updatable
template from day one* — speculative generality for an audience of one consumer; the metadata and
merge cost are not yet justified. The cost we accept: the origin and the harness diverge until a
manual re-export, so "source of truth" is only true at export time.
