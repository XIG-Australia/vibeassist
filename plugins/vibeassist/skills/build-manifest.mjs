// What is in each skill, written down so something other than a filesystem can
// find it.
//
// A cloud session cannot install this plugin, so the skills have to reach it
// some other way — and the only channel that reaches a customer's cloud session
// is the VibeAssist connector. The connector runs on a server with no checkout
// and no filesystem; it fetches these files over https instead. To do that it
// has to know what exists, and GitHub's contents API is rate-limited hard enough
// to be unusable for it. Hence a manifest, committed beside what it describes.
//
// Run after adding, removing or renaming any skill file:
//   node plugins/vibeassist/skills/build-manifest.mjs
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

/** The `description:` line of a skill's frontmatter — the skill saying when it
 *  applies, in its own words rather than ours. */
const describedBy = (text) => {
  const fence = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const line = fence && /^description:\s*([\s\S]*?)(?=\r?\n[a-z-]+:|$)/m.exec(fence[1]);
  return line ? line[1].trim().replace(/\s+/g, " ").replace(/^["']|["']$/g, "") : "";
};

const skills = readdirSync(HERE)
  .filter((name) => statSync(join(HERE, name)).isDirectory())
  .sort()
  .map((name) => {
    const root = join(HERE, name);
    const files = walk(root)
      .map((f) => relative(root, f).split("\\").join("/"))
      .sort();
    const skillMd = files.includes("SKILL.md") ? readFileSync(join(root, "SKILL.md"), "utf8") : "";
    return { name, whenToUse: describedBy(skillMd), files };
  })
  .filter((s) => s.files.includes("SKILL.md"));

writeFileSync(
  join(HERE, "manifest.json"),
  JSON.stringify({ version: 1, skills }, null, 2) + "\n",
  "utf8",
);
console.log(`manifest.json: ${skills.length} skills, ${skills.reduce((n, s) => n + s.files.length, 0)} files`);
