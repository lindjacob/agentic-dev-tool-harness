# 0007 — Configurable maintainer role

- **Status:** Accepted
- **Date:** 2026-06-03
- **Deciders:** Maintainer

## Decision

The authority who owns merges and sign-off is a single configurable role, `roles.maintainer`,
defaulting to `"human maintainer"`. It is substituted everywhere the origin repo said "Founder".

## Why

The origin used a project-specific role name throughout. A single parameter generalizes it without
restructuring, and "human maintainer" names the human-in-the-loop explicitly — useful in an agent
context where the contrast is agent vs. human. Teams that want "Lead", "Owner", or a personal name
set one value.
