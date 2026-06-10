# 0006 — Docs reference direction (not an inheritance tree)

- **Status:** Accepted
- **Date:** 2026-06-03
- **Deciders:** Maintainer

## Decision

Documentation relationships are governed by **reference direction**, not by a containment hierarchy.
Docs are ordered by generality/stability (principles · ADRs · cross-area specs → package & feature
READMEs → code comments), but `docs/architecture/` and `docs/decisions/` are **siblings**, not
parent and child. The rule:

- A document may reference more-general / more-stable documents.
- A document must not reference more-specific / less-stable ones.
- **Index files are the sole exception** — they exist to point down to their children.

Application READMEs may reference `docs/` (upward) but explain code at their level; they do not
restate project-wide principles.

## Why

The one-way rule is what lets docs scale without auto-maintenance: nothing general needs editing
when something specific changes. The earlier "inheritance tree" framing implied a false parent/child
containment between sibling doc folders; this corrects it while keeping the original (correct)
rationale. No `principles.md` is scaffolded — it is one optional general doc among siblings, not the
root of a tree.
