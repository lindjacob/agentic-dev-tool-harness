# 0004 — Language- and package-manager-agnostic workflow layer

- **Status:** Accepted
- **Date:** 2026-06-03
- **Deciders:** Maintainer

## Decision

The workflow layer assumes neither a language nor a package manager. Two distinct concerns are
separated:

- **Verb invocation** — how `workon` / `done` / etc. are run. Configured by `task_runner`; defaults
  to direct script execution (`./scripts/workon`). A Make/just/npm/pnpm/yarn shim is emitted only if
  requested, and skills reference the resolved token.
- **Verification** — `verify_cmd` is whatever the project uses (`pnpm lint && …`, `cargo test`,
  `pytest`, `make check`).

No "use pnpm exclusively" style rule ships; that is a per-project choice.

## Why

The scripts are pure `bash` + `git` + the provider CLI; the package-manager wrapper is incidental.
Baking in a JS package manager would silently restrict the harness to the Node ecosystem, defeating
"any new project."

The one residual is `audit-docs`, a Node script. Rather than rewrite it (no runtime is universal),
Node is documented as **harness tooling**, independent of the project's language, and the feature is
opt-out via `features.docs_audit`.
