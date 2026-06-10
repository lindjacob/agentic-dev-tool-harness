const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const docsDir = path.join(root, "docs");
const agentDirs = [".cursor", ".claude", ".agents", ".codex"]
  .map((dir) => path.join(root, dir))
  .filter((dir) => fs.existsSync(dir));
const strict = process.argv.includes("--strict");

const findings = {
  mustFix: [],
  shouldConsider: [],
  nit: [],
};

function exists(filePath) {
  return fs.existsSync(filePath);
}

function isMarkdown(filePath) {
  return filePath.endsWith(".md") || filePath.endsWith(".mdc");
}

function relative(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function walk(dir) {
  if (!exists(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  const ignoredDirs = new Set([".git", ".turbo", "build", "coverage", "dist", "node_modules"]);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) continue;
      files.push(...walk(fullPath));
      continue;
    }

    if (entry.isFile() && isMarkdown(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function rootMarkdownFiles() {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(root, entry.name))
    .filter(isMarkdown);
}

function stripCodeFences(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, "");
}

function markdownLinks(markdown) {
  const withoutCode = stripCodeFences(markdown);
  const links = [];
  const inlineLink = /(?<!!)\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const referenceLink = /^\s*\[[^\]]+\]:\s*(\S+)/gm;

  for (const match of withoutCode.matchAll(inlineLink)) {
    links.push(match[1]);
  }

  for (const match of withoutCode.matchAll(referenceLink)) {
    links.push(match[1]);
  }

  return links;
}

function isExternalLink(link) {
  return /^[a-z][a-z0-9+.-]*:/i.test(link);
}

function splitLocalLink(rawLink) {
  const [targetWithQuery, rawAnchor = ""] = rawLink.split("#");
  const target = targetWithQuery.split("?")[0];

  try {
    return {
      target: decodeURIComponent(target),
      anchor: decodeURIComponent(rawAnchor),
    };
  } catch {
    return { target, anchor: rawAnchor };
  }
}

function resolveLocalTarget(sourceFile, target) {
  if (!target) return sourceFile;
  return path.resolve(path.dirname(sourceFile), target);
}

function normalizeHeadingText(text) {
  return text
    .replace(/\s*\{#[A-Za-z0-9_-]+\}\s*$/, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~]/g, "")
    .trim();
}

function headingSlug(text) {
  const normalized = normalizeHeadingText(text)
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return normalized;
}

function markdownAnchors(filePath) {
  const markdown = stripCodeFences(fs.readFileSync(filePath, "utf8"));
  const anchors = new Set();
  const seenSlugs = new Map();
  const heading = /^(#{1,6})\s+(.+)$/gm;
  const explicitAnchor = /<a\s+(?:[^>]*\s)?(?:id|name)=["']([^"']+)["'][^>]*>/gi;
  const headingAnchor = /\s*\{#([A-Za-z0-9_-]+)\}\s*$/;

  for (const match of markdown.matchAll(explicitAnchor)) {
    anchors.add(match[1]);
  }

  for (const match of markdown.matchAll(heading)) {
    const customAnchor = match[2].match(headingAnchor);
    if (customAnchor) {
      anchors.add(customAnchor[1]);
    }

    const baseSlug = headingSlug(match[2]);
    if (!baseSlug) continue;

    const count = seenSlugs.get(baseSlug) ?? 0;
    seenSlugs.set(baseSlug, count + 1);
    anchors.add(count === 0 ? baseSlug : `${baseSlug}-${count}`);
  }

  return anchors;
}

function targetForAnchor(resolved) {
  if (exists(resolved) && fs.statSync(resolved).isDirectory()) {
    const readme = path.join(resolved, "README.md");
    return exists(readme) ? readme : resolved;
  }

  return resolved;
}

function checkBrokenLinks() {
  const files = [...rootMarkdownFiles(), ...walk(docsDir), ...agentDirs.flatMap(walk)];

  for (const file of files) {
    const markdown = fs.readFileSync(file, "utf8");

    for (const rawLink of markdownLinks(markdown)) {
      if (isExternalLink(rawLink)) continue;

      const { target, anchor } = splitLocalLink(rawLink);
      const resolved = resolveLocalTarget(file, target);

      if (!exists(resolved)) {
        findings.mustFix.push(
          `Broken link in \`${relative(file)}\`: \`${rawLink}\` does not resolve.`,
        );
        continue;
      }

      if (!anchor) continue;

      const anchorTarget = targetForAnchor(resolved);
      if (!isMarkdown(anchorTarget)) continue;

      const anchors = markdownAnchors(anchorTarget);
      if (!anchors.has(anchor)) {
        findings.mustFix.push(
          `Broken anchor in \`${relative(file)}\`: \`${rawLink}\` does not match a heading or explicit anchor in \`${relative(anchorTarget)}\`.`,
        );
      }
    }
  }
}

function docsIndexEntries() {
  if (!exists(docsDir)) return new Set();

  return new Set(
    fs
      .readdirSync(docsDir, { withFileTypes: true })
      .filter((entry) => {
        if (entry.name === "index.md") return false;
        return entry.isDirectory() || entry.name.endsWith(".md");
      })
      .map((entry) => entry.name),
  );
}

function linkedDocsIndexEntries() {
  const indexPath = path.join(docsDir, "index.md");
  if (!exists(indexPath)) {
    findings.mustFix.push("`docs/index.md` is missing.");
    return new Set();
  }

  const linked = new Set();
  const markdown = fs.readFileSync(indexPath, "utf8");

  for (const rawLink of markdownLinks(markdown)) {
    if (isExternalLink(rawLink)) continue;

    const { target } = splitLocalLink(rawLink);
    if (!target) continue;

    const resolved = path.resolve(path.dirname(indexPath), target);
    const relToDocs = path.relative(docsDir, resolved).split(path.sep);

    if (relToDocs.length === 1 && relToDocs[0] && !relToDocs[0].startsWith("..")) {
      linked.add(relToDocs[0]);
    }
  }

  return linked;
}

function checkIndexFreshness() {
  const actual = docsIndexEntries();
  const linked = linkedDocsIndexEntries();

  for (const entry of actual) {
    if (!linked.has(entry)) {
      findings.mustFix.push(`\`docs/index.md\` is missing immediate docs child \`${entry}\`.`);
    }
  }

  for (const entry of linked) {
    if (!actual.has(entry)) {
      findings.mustFix.push(`\`docs/index.md\` links to missing immediate docs child \`${entry}\`.`);
    }
  }
}

function lineCount(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  if (content.length === 0) return 0;
  return content.split(/\r?\n/).length;
}

function checkVolume() {
  const adrFiles = exists(path.join(docsDir, "decisions"))
    ? walk(path.join(docsDir, "decisions")).filter((file) => path.basename(file).endsWith(".md"))
    : [];

  for (const file of adrFiles) {
    const lines = lineCount(file);
    if (lines > 200) {
      findings.shouldConsider.push(
        `\`${relative(file)}\` is ${lines} lines; ADRs smell above 200 lines.`,
      );
    }
  }

  const readmes = walk(root).filter((file) => path.basename(file) === "README.md");
  for (const file of readmes) {
    const lines = lineCount(file);
    if (lines > 80) {
      findings.shouldConsider.push(
        `\`${relative(file)}\` is ${lines} lines; feature/package READMEs smell above 80 lines.`,
      );
    }
  }
}

function printGroup(title, items) {
  if (items.length === 0) return;

  console.log(`## ${title}`);
  console.log();

  for (const item of items) {
    console.log(`- ${item}`);
  }

  console.log();
}

checkIndexFreshness();
checkBrokenLinks();
if (!strict) {
  checkVolume();
}

if (
  findings.mustFix.length === 0 &&
  findings.shouldConsider.length === 0 &&
  findings.nit.length === 0
) {
  console.log("No documentation audit findings.");
  process.exit(0);
}

printGroup("Must fix", findings.mustFix);
printGroup("Should consider", findings.shouldConsider);
printGroup("Nit", findings.nit);

if (strict && findings.mustFix.length > 0) {
  process.exit(1);
}
