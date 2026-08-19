#!/usr/bin/env node
// The version has to move when the plugin does.
//
// Faithful port of check_plugin_version.py. Two invariants:
//   MARKERS — every SKILL.md's `vibeassist-skill-version` marker equals the
//             version in plugin.json (always runs).
//   MOVED   — if anything under plugins/ changed against the base branch, the
//             version in plugin.json must differ from the base's (needs --base).
//
// Exit 0 = every invariant it could check held. Exit 1 = a real disagreement.
// Exit 2 = the check could not run (bad ref, unreadable manifest).

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT = fs.realpathSync(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(path.dirname(SCRIPT));
const PLUGIN_DIR = "plugins/vibeassist";
const MANIFEST = PLUGIN_DIR + "/.claude-plugin/plugin.json";

// The marker each packaged SKILL.md carries. Captured so a mismatch can name
// both numbers rather than just saying "wrong".
const MARKER = /<!--\s*vibeassist-skill-version:\s*([0-9][0-9.]*)/;

// Files under the plugin that do NOT change what an installed copy does.
const IGNORED = new Set([MANIFEST]);

function print(s) {
  process.stdout.write(s + "\n");
}

function fail(msg) {
  print(`FAIL  ${msg}`);
}

function runGit(args) {
  const p = spawnSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
  const code = p.status === null ? 1 : p.status;
  return [code, (p.stdout || "") + (p.stderr || "")];
}

function versionOf(text, where) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    fail(`${where} is not valid JSON: ${e.message}`);
    return null;
  }
  const v = obj == null ? undefined : obj.version;
  if (typeof v !== "string" || v.trim() === "") {
    fail(`${where} has no \`version\` string.`);
    return null;
  }
  return v.trim();
}

// PurePosixPath ordering: compare path segment tuples lexicographically,
// element by element; a prefix tuple sorts before its extension.
function comparePosix(a, b) {
  const pa = a.split("/");
  const pb = b.split("/");
  const n = Math.min(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return pa.length - pb.length;
}

// Emulate sorted((REPO_ROOT/PLUGIN_DIR/"skills").glob("*/SKILL.md")).
function findSkillMarkers() {
  const skillsRoot = path.join(REPO_ROOT, PLUGIN_DIR, "skills");
  let entries;
  try {
    entries = fs.readdirSync(skillsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const found = [];
  for (const ent of entries) {
    // pathlib glob "*/" matches any entry (including hidden) that is a
    // directory (or a symlink to one).
    let isDir = ent.isDirectory();
    if (!isDir && ent.isSymbolicLink()) {
      try {
        isDir = fs.statSync(path.join(skillsRoot, ent.name)).isDirectory();
      } catch {
        isDir = false;
      }
    }
    if (!isDir) continue;
    const skillMd = path.join(skillsRoot, ent.name, "SKILL.md");
    if (fs.existsSync(skillMd)) found.push(skillMd);
  }
  found.sort(comparePosix);
  return found;
}

function relToRoot(abs) {
  return path.relative(REPO_ROOT, abs).split(path.sep).join("/");
}

function checkMarkers(version) {
  const skills = findSkillMarkers();
  if (skills.length === 0) {
    fail(`no SKILL.md found under ${PLUGIN_DIR}/skills — has the layout moved?`);
    return false;
  }

  let ok = true;
  for (const p of skills) {
    const rel = relToRoot(p);
    const text = fs.readFileSync(p, "utf-8");
    const m = MARKER.exec(text);
    if (!m) {
      fail(
        `${rel} carries no \`vibeassist-skill-version\` marker, so an installed ` +
          `copy cannot tell the app which version it is running.`
      );
      ok = false;
      continue;
    }
    const found = m[1];
    if (found !== version) {
      fail(
        `${rel} says ${found}, but ${MANIFEST} says ${version}. ` +
          `One of them is lying to whoever installed it.`
      );
      ok = false;
    }
  }
  if (ok) {
    print(`ok    ${skills.length} SKILL.md marker(s) agree with ${MANIFEST}: ${version}`);
  }
  return ok;
}

function checkMoved(base, version) {
  let [code, out] = runGit(["rev-parse", "--verify", `${base}^{commit}`]);
  if (code !== 0) {
    fail(`cannot resolve base ref ${pyRepr(base)} — nothing to compare against.\n${out.trim()}`);
    process.exit(2);
  }

  [code, out] = runGit(["diff", "--name-only", `${base}...HEAD`, "--", PLUGIN_DIR]);
  if (code !== 0) {
    fail(`could not diff against ${base}.\n${out.trim()}`);
    process.exit(2);
  }

  const changed = out.split("\n").filter((line) => line.trim() !== "");
  const material = changed.filter((p) => !IGNORED.has(p));
  if (material.length === 0) {
    print(`ok    nothing under ${PLUGIN_DIR} changed against ${base} — no bump needed`);
    return true;
  }

  let baseManifest;
  [code, baseManifest] = runGit(["show", `${base}:${MANIFEST}`]);
  if (code !== 0) {
    // The manifest not existing on the base is a new plugin, not a stalled
    // version. Nothing to compare, nothing to complain about.
    print(`ok    ${MANIFEST} is new against ${base} — no previous version to move from`);
    return true;
  }

  const was = versionOf(baseManifest, `${MANIFEST} at ${base}`);
  if (was === null) {
    process.exit(2);
  }

  if (was === version) {
    const listing = material.map((p) => `        ${p}`).join("\n");
    fail(
      `${material.length} file(s) under ${PLUGIN_DIR} changed, but the version is still ` +
        `${version}:\n${listing}\n` +
        `        Anyone already on ${version} keeps a different ${version} and ` +
        `\`/plugin update vibeassist\` has nothing to move to.\n` +
        `        Bump \`version\` in ${MANIFEST} and the marker in every SKILL.md.`
    );
    return false;
  }

  print(`ok    ${material.length} file(s) changed under ${PLUGIN_DIR}, and ${was} -> ${version}`);
  return true;
}

// Python repr() of a str for the one place the source interpolates {base!r}.
function pyRepr(s) {
  const hasSingle = s.includes("'");
  const hasDouble = s.includes('"');
  const quote = hasSingle && !hasDouble ? '"' : "'";
  let body = "";
  for (const ch of s) {
    if (ch === "\\") body += "\\\\";
    else if (ch === quote) body += "\\" + ch;
    else if (ch === "\n") body += "\\n";
    else if (ch === "\r") body += "\\r";
    else if (ch === "\t") body += "\\t";
    else body += ch;
  }
  return quote + body + quote;
}

function parseArgs(argv) {
  // Minimal faithful handling of `--base` (the only real option). Argparse
  // error/help formatting is not byte-parity matched (prog name differs).
  let base = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base") {
      if (i + 1 >= argv.length) {
        process.stderr.write("error: argument --base: expected one argument\n");
        process.exit(2);
      }
      base = argv[++i];
    } else if (a.startsWith("--base=")) {
      base = a.slice("--base=".length);
    } else if (a === "-h" || a === "--help") {
      print("usage: check_plugin_version.py [-h] [--base BASE]");
      process.exit(0);
    } else {
      process.stderr.write(`error: unrecognized arguments: ${a}\n`);
      process.exit(2);
    }
  }
  return { base };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const manifest = path.join(REPO_ROOT, MANIFEST);
  if (!fs.existsSync(manifest)) {
    fail(`${MANIFEST} not found.`);
    return 2;
  }
  const version = versionOf(fs.readFileSync(manifest, "utf-8"), MANIFEST);
  if (version === null) {
    return 2;
  }

  let ok = checkMarkers(version);
  if (args.base) {
    ok = checkMoved(args.base, version) && ok;
  } else {
    print("skip  version-moved check (no --base given, so there is nothing to compare)");
  }

  print(ok ? "\nall checks passed" : "\nchecks failed");
  return ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  process.exit(main());
}
