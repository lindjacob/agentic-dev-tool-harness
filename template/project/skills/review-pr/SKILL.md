---
name: review-pr
description:
  Independent fresh-eyes review of a pull request. Use when the user asks to review a PR, when given
  a PR number or URL to look at, or when checking a PR for correctness, conventions, and
  architectural fit before merge.
---

# Review a PR

You are not the implementer. Fresh eyes. The {{maintainer}} runs the merge step — your job is to
surface anything that should change first.

## At session start, read

- `AGENTS.md` at the repo root and any nested `AGENTS.md` for directories the PR touches
- The linked issue body in full (the issue the PR closes)
- The PR body in full, especially `## Plan` and `## Deviations` if present
- The full diff and CI/status checks: `{{review}} <pr-number>`
- Any rules matching changed files
- Any ADRs the PR claims to follow or extend

## What you check

- **Acceptance criteria.** Each AC item from the issue body — met or not?
- **Coding conventions.** Conventions and patterns for the touched domain — respected?
- **Architectural drift.** Any change that contradicts or implicitly extends an ADR without one
  being added or amended?
- **Bug surfaces.** Nullability, error paths, race conditions, secrets, authz for data changes,
  input validation.
- **Test coverage.** Are the new code paths covered? Are tests meaningful or just present?
- **CI/status evidence.** Are all required checks green? If a check failed, read its logs before
  deciding whether the failure is related.
- **Future-readability.** Stale comments, dead code, unclear naming, missing doc updates that would
  slow a future agent.
- **Deviations.** If the PR has a `## Deviations` section — is each deviation justified, or scope
  creep?

## Output

Single PR comment, signed `Reviewer`. Group findings as `Must fix` / `Should consider` / `Nit`. Skip
empty groups. If no findings, say so explicitly — don't manufacture issues.

Post via `{{comment_review}} <pr-number> --body-file <path>`. Use `--body-file`; multi-line bodies via
inline `--body "..."` will eat your escaping.

## Hard rules

- Never push commits.
- Never approve, never request changes via the forge's review system, never merge.
- Never merge a PR (the forge's merge command, or the `{{land}}` verb) under any flag combination.
