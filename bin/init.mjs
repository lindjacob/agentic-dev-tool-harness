#!/usr/bin/env node
// Deterministic scaffolder for agentic-dev-tool-harness. Reads an answers file, substitutes the
// parameterization seam, and emits only the selected tool targets and provider. See README.md and
// answers.schema.json.
//
// Zero runtime dependencies: clone the harness and run with Node alone, no install step.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TEMPLATE = path.join(HARNESS_ROOT, "template");

const SKILL_DIRS = {
  cursor: ".cursor/skills",
  claude: ".claude/skills",
  codex: ".agents/skills",
};

const UNIVERSAL_SKILLS = ["write-adr", "write-docs", "audit-docs"];
const PROJECT_SKILLS = ["work-on-issue", "write-issue", "review-pr"];

const notices = [];
const conflicts = [];

// ---------------------------------------------------------------------------------------- args
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--answers") out.answers = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "-h" || a === "--help") out.help = true;
  }
  return out;
}

// ------------------------------------------------------------------------------------ defaults
function withDefaults(a) {
  const d = a || {};
  return {
    harness_version: d.harness_version ?? "0.1.0",
    project: {
      name: d.project?.name ?? "Your Project",
      description: d.project?.description ?? "",
      repo: d.project?.repo ?? "owner/name",
    },
    roles: { maintainer: d.roles?.maintainer ?? "human maintainer" },
    workflow: {
      task_runner: d.workflow?.task_runner ?? "direct",
      verify_cmd: d.workflow?.verify_cmd ?? "echo 'set workflow.verify_cmd'",
      monorepo: d.workflow?.monorepo ?? false,
    },
    provider: {
      name: d.provider?.name ?? "github",
      dependency_tracking: d.provider?.dependency_tracking ?? true,
    },
    targets: d.targets ?? ["cursor", "claude", "codex"],
    features: {
      docs_audit: d.features?.docs_audit ?? true,
      enforcement: d.features?.enforcement ?? true,
    },
    docs: { areas: d.docs?.areas ?? [] },
    policy: d.policy ?? [
      {
        command: "gh pr merge",
        decision: "forbidden",
        why: "The maintainer owns merges; agents stop at the open PR.",
      },
      {
        command: "git push --force",
        decision: "prompt",
        why: "Force-push is destructive; confirm before rewriting remote history.",
      },
    ],
  };
}

// --------------------------------------------------------------------------------- verb tokens
function verbToken(runner, verb) {
  switch (runner) {
    case "direct":
      return `./scripts/${verb}`;
    case "just":
      return `just ${verb}`;
    case "make":
      return `make ${verb}`;
    case "npm":
      return `npm run ${verb}`;
    case "pnpm":
      return `pnpm ${verb}`;
    case "yarn":
      return `yarn ${verb}`;
    case "cargo-make":
      return `cargo make ${verb}`;
    default:
      return `${runner} ${verb}`;
  }
}

// ------------------------------------------------------------------------------ template engine
function get(ctx, dottedPath) {
  return dottedPath.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), ctx);
}

function renderStr(tpl, ctx) {
  let out = tpl;
  out = out.replace(/\{\{#each ([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_m, p, body) => {
    const arr = get(ctx, p);
    if (!Array.isArray(arr)) return "";
    return arr.map((item) => body.replace(/\{\{this\}\}/g, String(item))).join("");
  });
  out = out.replace(/\{\{#if ([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_m, p, body) =>
    get(ctx, p) ? body : "",
  );
  out = out.replace(/\{\{#unless ([\w.]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (_m, p, body) =>
    get(ctx, p) ? "" : body,
  );
  // Scalar tokens: {{word}} / {{a.b}}. GitHub Actions `${{ ... }}` has spaces, so it is untouched.
  out = out.replace(/\{\{([\w.]+)\}\}/g, (m, p) => {
    const v = get(ctx, p);
    return v == null ? m : String(v);
  });
  return out;
}

// ----------------------------------------------------------------------------------- fs helpers
// Never destructive: identical existing files are skipped (re-runs are idempotent); differing
// existing files are kept and the rendered version lands alongside as `<file>.harness-new` for a
// human or agent to merge (see skills/install-harness). Returns the path actually written, or
// null when skipped.
function writeOut(destAbs, content) {
  if (fs.existsSync(destAbs)) {
    if (fs.readFileSync(destAbs, "utf8") === content) return null;
    const alt = `${destAbs}.harness-new`;
    fs.writeFileSync(alt, content);
    conflicts.push(destAbs);
    return alt;
  }
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });
  fs.writeFileSync(destAbs, content);
  return destAbs;
}

function emitFile(srcAbs, destAbs, ctx, { collapseBlank = false } = {}) {
  const raw = fs.readFileSync(srcAbs, "utf8");
  let rendered = renderStr(raw, ctx);
  // Conditional blocks can leave doubled blank lines; tidy prose context files.
  if (collapseBlank) rendered = rendered.replace(/\n{3,}/g, "\n\n");
  const written = writeOut(destAbs, rendered);
  if (written && rendered.startsWith("#!")) fs.chmodSync(written, 0o755);
  return written;
}

function emitText(content, destAbs) {
  return writeOut(destAbs, content);
}

function renderCopyTree(srcDir, destDir, ctx, skip = () => false) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    if (skip(src)) continue;
    if (entry.isDirectory()) {
      renderCopyTree(src, path.join(destDir, entry.name), ctx, skip);
    } else {
      const name = entry.name.endsWith(".tmpl") ? entry.name.slice(0, -5) : entry.name;
      emitFile(src, path.join(destDir, name), ctx);
    }
  }
}

// ----------------------------------------------------------------------------- policy compilers
function shSingleQuote(s) {
  return `'${String(s).replace(/'/g, "'\\''")}'`;
}

function cursorHookScript(policy) {
  // The case pattern's literal part must be double-quoted so embedded spaces aren't word-split.
  const caseLine = (command, json) => {
    const pattern = `*"${command.replace(/"/g, '\\"')}"*`;
    return `case "$input" in ${pattern}) printf '%s' ${shSingleQuote(json)}; exit 0;; esac`;
  };
  const lines = ["#!/bin/sh", "# Generated by the agent harness. Blocks commands per policy.", "input=$(cat)"];
  for (const p of policy.filter((e) => e.decision === "forbidden")) {
    lines.push(caseLine(p.command, JSON.stringify({ permission: "deny", agent_message: `Blocked by harness policy: ${p.why}` })));
  }
  for (const p of policy.filter((e) => e.decision === "prompt")) {
    lines.push(caseLine(p.command, JSON.stringify({ permission: "ask", user_message: p.why })));
  }
  lines.push(`printf '%s' '{"permission":"allow"}'`, "");
  return lines.join("\n");
}

function cursorHooksJson() {
  return `${JSON.stringify(
    {
      version: 1,
      hooks: {
        beforeShellExecution: [{ command: ".cursor/hooks/harness-policy.sh", failClosed: true }],
      },
    },
    null,
    2,
  )}\n`;
}

function claudeSettings(policy) {
  const deny = policy.filter((p) => p.decision === "forbidden").map((p) => `Bash(${p.command}:*)`);
  const ask = policy.filter((p) => p.decision === "prompt").map((p) => `Bash(${p.command}:*)`);
  return `${JSON.stringify({ permissions: { deny, ask } }, null, 2)}\n`;
}

function codexRules(policy) {
  return `${policy
    .map((p) => {
      const pattern = p.command.trim().split(/\s+/).map((t) => JSON.stringify(t)).join(", ");
      const decision = p.decision === "forbidden" ? "forbidden" : "prompt";
      return `prefix_rule(\n    pattern = [${pattern}],\n    decision = ${JSON.stringify(decision)},\n    justification = ${JSON.stringify(p.why)},\n)`;
    })
    .join("\n\n")}\n`;
}

// ------------------------------------------------------------------------------------ main
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.answers || !args.out) {
    console.log("Usage: node bin/init.mjs --answers <answers.json> --out <target-repo>");
    process.exit(args.help ? 0 : 1);
  }

  const a = withDefaults(JSON.parse(fs.readFileSync(args.answers, "utf8")));
  const out = path.resolve(args.out);

  if (a.provider.name !== "github") {
    console.error(`provider "${a.provider.name}" is not implemented (only "github").`);
    process.exit(1);
  }

  const runner = a.workflow.task_runner;
  const [repoOwner, repoName] = a.project.repo.split("/");
  const ctx = {
    project: a.project,
    maintainer: a.roles.maintainer,
    workon: verbToken(runner, "workon"),
    done: verbToken(runner, "done"),
    land: verbToken(runner, "land"),
    create_item: verbToken(runner, "create-item"),
    review: verbToken(runner, "review"),
    comment_review: verbToken(runner, "comment-review"),
    verify_cmd: a.workflow.verify_cmd,
    audit_cmd: "node scripts/audit-docs.cjs",
    repo_owner: repoOwner ?? "owner",
    repo_name: repoName ?? "name",
    monorepo: a.workflow.monorepo,
    docs_audit: a.features.docs_audit,
    dependency_tracking: a.provider.dependency_tracking,
    docs: { areas: a.docs.areas },
  };

  // Skills, per selected target.
  const skillSpecs = [
    ...UNIVERSAL_SKILLS.filter((s) => s !== "audit-docs" || a.features.docs_audit).map((name) => ({
      base: path.join(TEMPLATE, "universal", "skills"),
      name,
    })),
    ...PROJECT_SKILLS.map((name) => ({ base: path.join(TEMPLATE, "project", "skills"), name })),
  ];
  const skipBlockedBy = (src) =>
    !a.provider.dependency_tracking && src.replace(/\\/g, "/").endsWith("write-issue/references/blocked-by.md");

  for (const target of a.targets) {
    const skillsDir = path.join(out, SKILL_DIRS[target]);
    for (const spec of skillSpecs) {
      renderCopyTree(path.join(spec.base, spec.name), path.join(skillsDir, spec.name), ctx, skipBlockedBy);
    }
  }

  // Agent context. AGENTS.md is the substrate; Claude gets an import shim.
  emitFile(path.join(TEMPLATE, "project", "AGENTS.md.tmpl"), path.join(out, "AGENTS.md"), ctx, { collapseBlank: true });
  if (a.targets.includes("claude")) {
    emitText("@AGENTS.md\n", path.join(out, "CLAUDE.md"));
  }

  // Docs skeleton.
  emitFile(path.join(TEMPLATE, "project", "docs", "index.md.tmpl"), path.join(out, "docs", "index.md"), ctx, { collapseBlank: true });
  emitText("", path.join(out, "docs", "decisions", ".gitkeep"));
  for (const area of a.docs.areas) {
    emitText(`# ${area}\n\n_Document ${area} here. See the \`write-docs\` skill._\n`, path.join(out, "docs", area, "README.md"));
  }

  // Shared tooling.
  if (a.features.docs_audit) {
    emitFile(path.join(TEMPLATE, "shared", "scripts", "audit-docs.cjs"), path.join(out, "scripts", "audit-docs.cjs"), ctx);
  }

  // GitHub provider.
  const providerDir = path.join(TEMPLATE, "providers", "github");
  renderCopyTree(path.join(providerDir, "scripts"), path.join(out, "scripts"), ctx);
  renderCopyTree(path.join(providerDir, "github"), path.join(out, ".github"), ctx);
  if (a.targets.includes("cursor")) {
    emitText(
      `${JSON.stringify(
        {
          networkPolicy: {
            default: "deny",
            allow: ["api.github.com", "github.com", "codeload.github.com", "uploads.github.com", "objects.githubusercontent.com", "*.githubusercontent.com"],
          },
        },
        null,
        2,
      )}\n`,
      path.join(out, ".cursor", "sandbox.json"),
    );
  }

  // Enforcement.
  if (a.features.enforcement) {
    if (a.targets.includes("cursor")) {
      emitText(cursorHooksJson(), path.join(out, ".cursor", "hooks.json"));
      const hook = emitText(cursorHookScript(a.policy), path.join(out, ".cursor", "hooks", "harness-policy.sh"));
      if (hook) fs.chmodSync(hook, 0o755);
    }
    if (a.targets.includes("claude")) {
      emitText(claudeSettings(a.policy), path.join(out, ".claude", "settings.json"));
    }
    if (a.targets.includes("codex")) {
      emitText(codexRules(a.policy), path.join(out, ".codex", "rules", "harness.rules"));
    }
  }

  // Task-runner shim.
  if (runner === "just") {
    const verbs = ["workon", "done", "land", "create-item", "review", "comment-review"];
    emitText(`${verbs.map((v) => `${v} *args:\n    ./scripts/${v} {{args}}\n`).join("\n")}`, path.join(out, "justfile"));
  } else if (runner !== "direct") {
    notices.push(
      `task_runner "${runner}" selected: wire these verbs to ./scripts/<verb> in your ${runner} config — workon, done, land, create-item, review, comment-review. (The scaffolder does not edit your existing manifest.)`,
    );
  }

  console.log(`Scaffolded ${a.project.name} into ${out}`);
  console.log(`  targets: ${a.targets.join(", ")} | provider: ${a.provider.name} | runner: ${runner}`);
  for (const n of notices) console.log(`  NOTE: ${n}`);
  if (conflicts.length > 0) {
    console.log(
      `  ${conflicts.length} conflict(s) — existing files were kept; rendered versions written alongside as *.harness-new. Merge each (see skills/install-harness), then delete the .harness-new file:`,
    );
    for (const c of conflicts) console.log(`  CONFLICT: ${path.relative(out, c)}`);
  }
}

main();
