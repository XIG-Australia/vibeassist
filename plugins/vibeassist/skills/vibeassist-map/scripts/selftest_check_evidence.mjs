#!/usr/bin/env node
/* Self-test for check_evidence.mjs — the gate.

    node selftest_check_evidence.mjs

Exits 0 on pass, 1 with the failing assertions on fail. No pytest, no deps, for
the same reason as selftest_emit_map_json: this repo has no test harness and
one dependency would be a reason not to run it.

WHY THIS EXISTS. The gate is the thing standing between "I traced this" and "I
remember this", and nothing was checking the gate. Two holes went unnoticed
because they are both about what the gate CANNOT SEE:

  * it only read lines containing "Evidence:", so an action with no citation at
    all was invisible to it — while the quality bar said "every action has
    Evidence";
  * SKILL.md documents `⚠ UNVERIFIED` as the way to record a claim you could
    not check, and the gate failed those lines anyway, so the documented way out
    led nowhere.

Both are absences. A test that only feeds it good and bad citations passes
against a gate with either hole in it.
*/
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { dumpsCompact } from './_pyjson.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const GATE = path.join(HERE, "check_evidence.mjs")

const failures = []

function check(label, cond, detail = "") {
  if (cond) {
    console.log(`  ok   ${label}`)
  } else {
    console.log(`  FAIL ${label} ${detail}`)
    failures.push(label)
  }
}

function run(tmp, pages, source = null, caps = null, extra = []) {
  // Write a fixture repo and run the gate over it.
  const repo = path.join(tmp, "repo")
  fs.mkdirSync(path.join(repo, "map", "pages"), { recursive: true })
  fs.mkdirSync(path.join(repo, "src"), { recursive: true })
  const defaultSrc = Array.from({ length: 9 }, (_, i) => `line ${i + 1}`).join("\n") + "\n"
  fs.writeFileSync(path.join(repo, "src", "account.ts"), source || defaultSrc, "utf-8")
  for (const [name, body] of Object.entries(pages)) {
    fs.writeFileSync(path.join(repo, "map", "pages", name), body, "utf-8")
  }
  if (caps !== null) {
    fs.writeFileSync(path.join(repo, "map", "_capabilities.json"), dumpsCompact(caps), "utf-8")
  }
  const r = spawnSync(
    "node",
    [GATE, path.join(repo, "map", "pages"), "--repo-root", repo, ...extra],
    { encoding: "utf-8" },
  )
  return { returncode: r.status, stdout: r.stdout, stderr: r.stderr }
}

const SOURCE = `export function updateProfile() {
  return supabase.from('profiles').update({})
}
`

const GOOD = `# /account — Account

## Capability: Manage your account
### Action: Update your username
- What happens: You type a new name and save.
- Evidence: src/account.ts:1 → \`updateProfile\` → UPDATE \`profiles\`
`

function main() {
  const td = fs.mkdtempSync(path.join(os.tmpdir(), "selftest-check-evidence-"))
  try {
    const tmp = td

    console.log("a citation that checks out passes")
    let r = run(path.join(tmp, "a"), { "account.md": GOOD }, SOURCE)
    check("exit 0", r.returncode === 0, r.stdout)
    check("counts what it checked", r.stdout.includes("1 evidence lines checked"), r.stdout)

    console.log("a citation pointing at the wrong line fails")
    r = run(path.join(tmp, "b"), { "account.md": GOOD.replace("src/account.ts:1", "src/account.ts:99") },
      SOURCE)
    check("exit 1", r.returncode === 1)
    check("says out of bounds", r.stdout.includes("out of bounds"), r.stdout)

    console.log("a symbol that is not in the cited range fails")
    r = run(path.join(tmp, "c"), { "account.md": GOOD.replace("`updateProfile`", "`deleteEverything`") },
      SOURCE)
    check("exit 1", r.returncode === 1)
    check("names the symbol", r.stdout.includes("deleteEverything"), r.stdout)

    // THE HOLE THE GATE COULD NOT SEE — an absence, not a bad citation.
    console.log("an action with NO Evidence line fails")
    const no_ev = `# /account — Account

## Capability: Manage your account
### Action: Update your username
- What happens: You type a new name and save.
- Trigger: "Save" button
`
    r = run(path.join(tmp, "d"), { "account.md": no_ev }, SOURCE)
    check("exit 1", r.returncode === 1, r.stdout)
    check("names the action", r.stdout.includes("Update your username"), r.stdout)
    check("says what is missing", r.stdout.includes("NO Evidence line"), r.stdout)

    console.log("the last action in a file is checked too")
    // The block-end scan has to close the final action at end-of-file, or the
    // one place a citation is most often forgotten is the one place unchecked.
    r = run(path.join(tmp, "e"), { "account.md": GOOD + "\n### Action: Close your account\n" +
      "- What happens: it closes.\n" },
      SOURCE)
    check("exit 1", r.returncode === 1, r.stdout)
    check("names the last action", r.stdout.includes("Close your account"), r.stdout)

    // SKILL.md's own escape hatch, which the gate used to fail anyway.
    console.log("a claim marked UNVERIFIED is reported, not failed")
    const unver = GOOD.replace(
      "- Evidence: src/account.ts:1 → `updateProfile` → UPDATE `profiles`",
      "- Evidence: ⚠ UNVERIFIED — the handler is generated at build time")
    r = run(path.join(tmp, "f"), { "account.md": unver }, SOURCE)
    check("exit 0", r.returncode === 0, r.stdout)
    check("said out loud", r.stdout.includes("UNVERIFIED"), r.stdout)
    check("counted", r.stdout.includes("1 marked unverified"), r.stdout)
    check("and the cost is stated", r.stdout.includes("a real cost"), r.stdout)

    console.log("a page-less reading checks its capabilities instead of erroring")
    const caps = [{ name: "Map a repository", purpose: "Read a codebase.",
      file: "src/account.ts" }]
    r = run(path.join(tmp, "g"), {}, SOURCE, caps)
    check("exit 0", r.returncode === 0, r.stdout + r.stderr)
    check("says which gate it ran", r.stdout.includes("Phase 1b"), r.stdout)
    check("still demands the hand pass", r.stdout.includes("by hand"), r.stdout)

    console.log("a capability citing nothing, or nothing real, fails")
    r = run(path.join(tmp, "h"), {}, SOURCE,
      [{ name: "Map a repository", file: "src/does-not-exist.ts" }])
    check("exit 1", r.returncode === 1, r.stdout)
    check("says what is missing", r.stdout.includes("does not exist"), r.stdout)
    r = run(path.join(tmp, "i"), {}, SOURCE, [{ name: "Map a repository" }])
    check("a capability with no file at all fails", r.returncode === 1, r.stdout)

    console.log("no pages and no capabilities is still an error")
    r = run(path.join(tmp, "j"), {}, SOURCE)
    check("exit 2", r.returncode === 2, r.stdout + r.stderr)
    check("says what to do", r.stderr.includes("_capabilities.json"), r.stderr)
  } finally {
    fs.rmSync(td, { recursive: true, force: true })
  }

  console.log()
  if (failures.length) {
    console.log(`FAILED: ${failures.length} — ${failures.join(", ")}`)
    return 1
  }
  console.log("all checks passed")
  return 0
}

process.exitCode = main()
