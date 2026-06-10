# 0003 — Forge/tracker behind a verb contract

- **Status:** Accepted
- **Date:** 2026-06-03
- **Deciders:** Maintainer

## Decision

Skills speak only in provider-agnostic **verbs** (`workon`, `done`, `land`, `read-item`,
`create-item`, `review-diff`, `review-checks`, `comment-review`). The forge/tracker is an
implementation of that contract under `template/providers/<name>/`. **GitHub is the only
implementation today.** No raw `gh` call appears in any skill. A second provider (Linear, …) is
added by implementing the verbs, with no skill edits.

Milestone-style grouping is the most tracker-divergent concept and is **excluded** from skills. The
only seam is an optional `group` argument on `create-item`, which a provider maps to its native
concept (GitHub milestone, Linear cycle, …) or ignores.

## Why

The goal is to switch trackers without editing skills. That requires zero tracker vocabulary in
skills. A `use_milestones` flag was rejected: it would re-introduce GitHub-shaped vocabulary into
skills — the exact coupling the contract removes — for a feature not on the core path. Building a
second provider now is rejected as speculative (ADR `0001`); only the seam is built.
