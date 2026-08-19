#!/usr/bin/env node
/* Evidence gate for vibeassist-map (Phase 4).

Checks every Evidence line in map/pages/*.md:
  1. each cited file exists (relative to the repo root)
  2. each cited line/range is within the file
  3. the cited range CONTAINS the backticked symbols/tables named on that line
     (existence alone is not enough - a citation can point at a real file and
     the wrong line)

It also checks what is NOT there:
  4. an Action with no Evidence line at all - the quality bar says "every action
     has Evidence" and nothing was enforcing it, because a gate that only reads
     lines containing "Evidence:" cannot see a missing one
  5. a page-less reading (SKILL.md Phase 1b) - no page files, so the checks
     above have nothing to read. It verifies each capability's source file
     instead of exiting with an error.

Usage:
    node scripts/check_evidence.mjs map/pages/ [--repo-root .]
    node scripts/check_evidence.mjs map/pages/ --capabilities map/_capabilities.json

Exit code 0 = all claims verified; 1 = failures listed on stdout.
A failed check means RE-TRACE the claim, never soften its wording.

A claim you genuinely cannot verify is marked `⚠ UNVERIFIED` in the page file.
That is SKILL.md's own escape hatch and this counts it as one rather than as a
failure - see the note above UNVERIFIED below for why it had to.
*/
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// stdout is utf-8 by default in node; no reconfigure needed.

// `$` and `[]` belong in the class: file-based routers put route parameters IN
// the filename (projects.$projectId.tsx, [projectId]/page.tsx), and without them
// the path silently truncates to a "missing file" on every dynamic route.
const CITE = /(?<file>[\w./\\$[\]-]+\.[A-Za-z]{1,10}):(?<start>\d+)(?:-(?<end>\d+))?/g
const TICKED = /`([^`]+)`/g
// tokens that are prose markers, not symbols to look up
const SKIP_TOKENS = new Set(["READ", "INSERT", "UPDATE", "DELETE", "READS", "WRITES", "None"])

// THE ESCAPE HATCH THE SKILL DOCUMENTS AND THE GATE DID NOT HAVE.
//
// SKILL.md: "Anything you cannot re-verify gets an explicit ⚠ UNVERIFIED
// marker", and its quality bar passes a run whose "failures are marked ⚠
// UNVERIFIED". This script had no such branch - a marked line still counted as
// a failure and still exited 1 - so the documented way out led nowhere and the
// only ways forward were to delete the claim or edit this script, both of which
// the same page forbids. A gate you have to go around is not a gate.
//
// Counted and REPORTED rather than ignored: an unverified claim is a real cost
// and a run that has ten of them must not read like a run that has none.
const UNVERIFIED = /UNVERIFIED/i
const ACTION_H = /^###\s+Action:\s*(?<name>.+?)\s*$/
// Any heading ends the action's block - the next action, the next capability,
// the next page-level field.
const BLOCK_END = /^(?:#{1,6}\s|\*\*)/

const LOOKS_LIKE_PATH_EXT = /\.[A-Za-z]{1,10}$/

function out(s) { process.stdout.write(s + "\n") }
function err(s) { process.stderr.write(s + "\n") }

// Python str.splitlines(): splits on the full set of line boundaries and drops a
// terminal boundary (no trailing empty element).
function pySplitlines(s) {
  const boundaries = /\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/g
  const result = []
  let last = 0
  let m
  boundaries.lastIndex = 0
  while ((m = boundaries.exec(s)) !== null) {
    result.push(s.slice(last, m.index))
    last = m.index + m[0].length
  }
  if (last < s.length) result.push(s.slice(last))
  return result
}

function isFile(p) {
  try { return fs.statSync(p).isFile() } catch { return false }
}

// read_text(encoding="utf-8", errors="replace") - node's utf-8 decode replaces
// invalid sequences with U+FFFD, matching errors="replace".
function readText(p) {
  return fs.readFileSync(p, 'utf-8')
}

/** Yield [ok, message] for one Evidence line. */
function checkLine(line, repo) {
  const results = []
  const cites = [...line.matchAll(CITE)]
  if (cites.length === 0) {
    results.push([false, "no file:line citation on Evidence line"])
    return results
  }
  const looksLikePath = (t) => t.includes("/") || t.includes("\\") || LOOKS_LIKE_PATH_EXT.test(t)
  let symbols = [...line.matchAll(TICKED)]
    .map((m) => m[1])
    .filter((t) => !SKIP_TOKENS.has(t) && !looksLikePath(t))
  // strip column lists like (display_name) from table tokens
  symbols = symbols.map((s) => s.split("(")[0].trim())
  let citedText = ""
  for (const m of cites) {
    const fileRel = m.groups.file.replaceAll("\\", "/")
    const f = path.isAbsolute(fileRel) ? fileRel : path.join(repo, fileRel)
    if (!isFile(f)) {
      results.push([false, `missing file: ${m.groups.file}`])
      continue
    }
    const lines = pySplitlines(readText(f))
    const start = parseInt(m.groups.start, 10)
    const end = m.groups.end != null ? parseInt(m.groups.end, 10) : start
    if (start < 1 || end > lines.length) {
      results.push([false, `range out of bounds: ${m.groups.file}:${start}-${end} (file has ${lines.length} lines)`])
      continue
    }
    // widen a little: a symbol may sit a couple of lines from the cited anchor
    const lo = Math.max(0, start - 3)
    const hi = Math.min(lines.length, end + 3)
    citedText += lines.slice(lo, hi).join("\n") + "\n"
    results.push([true, `ok: ${m.groups.file}:${start}-${end}`])
  }
  for (const sym of symbols) {
    if (sym && !citedText.includes(sym)) {
      results.push([false, `symbol \`${sym}\` not found in any cited range on this line`])
    }
  }
  return results
}

/** Actions in one page file that carry no Evidence line at all. */
function actionsWithoutEvidence(text) {
  const out = []
  let current = null
  let seenEvidence = false
  let start = 0
  let n = 0
  for (const line of pySplitlines(text)) {
    n += 1
    const m = ACTION_H.exec(line)
    if (m) {
      if (current && !seenEvidence) out.push([start, current])
      current = m.groups.name
      seenEvidence = false
      start = n
      continue
    }
    if (current === null) continue
    if (line.includes("Evidence:")) {
      seenEvidence = true
    } else if (BLOCK_END.test(line) && !line.startsWith("###")) {
      // A capability heading or a page-level field closed the block.
      if (!seenEvidence) out.push([start, current])
      current = null
    }
  }
  if (current && !seenEvidence) out.push([start, current])
  return out
}

/** Phase 1b: a reading with no pages still has to be checkable. */
function checkCapabilities(capsFile, repo) {
  let caps
  try {
    caps = JSON.parse(readText(capsFile))
  } catch (exc) {
    out(`cannot read ${capsFile}: ${exc}`)
    return 1
  }
  let failures = 0
  const capsName = path.basename(capsFile)
  for (const cap of caps) {
    const name = (((cap == null ? undefined : cap.name) || "")).trim()
    if (!name) {
      out(`FAIL ${capsName}  a capability with no name`)
      failures += 1
      continue
    }
    const src = (((cap == null ? undefined : cap.file) || "")).trim()
    if (!src) {
      out(`FAIL ${capsName}  '${name}' names no file — nothing to check it against`)
      failures += 1
    } else if (!fs.existsSync(path.join(repo, src))) {
      out(`FAIL ${capsName}  '${name}' cites ${src}, which does not exist`)
      failures += 1
    }
  }
  out(`\n${caps.length} capability/capabilities checked, ${failures} failure(s).`)
  if (!failures) {
    out("Their FILES exist. What each one SAYS is not machine-checkable — Phase 1b")
    out("asks you to re-read each source and confirm it by hand, and to say in your")
    out("feedback that you did and how many. A run that skipped the only verification")
    out("step must not read like one that passed it.")
  }
  return failures
}

class ArgError extends Error {}

function parseArgs(argv) {
  const prog = "check_evidence.mjs"
  const usage = `usage: ${prog} [-h] [--repo-root REPO_ROOT] [--capabilities CAPABILITIES] pages_dir`
  const fail = (msg) => {
    err(usage)
    err(`${prog}: error: ${msg}`)
    throw new ArgError()
  }
  let repoRoot = "."
  let capabilities = null
  const positionals = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "-h" || a === "--help") {
      out(usage)
      throw new ArgError(true)
    } else if (a === "--repo-root") {
      if (i + 1 >= argv.length) fail("argument --repo-root: expected one argument")
      repoRoot = argv[++i]
    } else if (a.startsWith("--repo-root=")) {
      repoRoot = a.slice("--repo-root=".length)
    } else if (a === "--capabilities") {
      if (i + 1 >= argv.length) fail("argument --capabilities: expected one argument")
      capabilities = argv[++i]
    } else if (a.startsWith("--capabilities=")) {
      capabilities = a.slice("--capabilities=".length)
    } else if (a.startsWith("-") && a !== "-") {
      fail(`unrecognized arguments: ${a}`)
    } else {
      positionals.push(a)
    }
  }
  if (positionals.length < 1) fail("the following arguments are required: pages_dir")
  if (positionals.length > 1) fail(`unrecognized arguments: ${positionals.slice(1).join(" ")}`)
  return { pages_dir: positionals[0], repo_root: repoRoot, capabilities }
}

function main(argv) {
  let args
  try {
    args = parseArgs(argv)
  } catch (e) {
    if (e instanceof ArgError) return e.message === "true" ? 0 : 2
    throw e
  }

  const repo = path.resolve(args.repo_root)
  const pagesDir = args.pages_dir

  let pages = []
  try {
    pages = fs.readdirSync(pagesDir)
      .filter((n) => n.endsWith(".md"))
      .map((n) => path.join(pagesDir, n))
  } catch {
    pages = []
  }
  pages.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

  const capsFile = args.capabilities
    ? args.capabilities
    : path.join(path.dirname(pagesDir), "_capabilities.json")

  if (pages.length === 0) {
    // A PAGE-LESS READING IS NOT A BROKEN ONE.
    if (isFile(capsFile)) {
      out(`no page files — checking ${capsFile} instead (SKILL.md Phase 1b)`)
      return checkCapabilities(capsFile, repo) ? 1 : 0
    }
    err(`no page files found in ${args.pages_dir}, and no ${path.basename(capsFile)} either.`)
    err("If this repository has no pages, write its surface to _capabilities.json")
    err("(SKILL.md Phase 1b). If it has pages, Phase 3 has not run yet.")
    return 2
  }

  let failures = 0
  let checked = 0
  let unverified = 0
  const uncited = []
  for (const page of pages) {
    const pageName = path.basename(page)
    const text = readText(page)
    const linesArr = pySplitlines(text)
    for (let idx = 0; idx < linesArr.length; idx++) {
      const line = linesArr[idx]
      const n = idx + 1
      if (!line.includes("Evidence:")) continue
      checked += 1
      // Marked as unverifiable BY THE AUTHOR. Reported, never silently
      // accepted, and never counted as a pass.
      if (UNVERIFIED.test(line)) {
        unverified += 1
        out(`UNVERIFIED ${pageName}:${n}  ${line.trim()}`)
        continue
      }
      for (const [ok, msg] of checkLine(line, repo)) {
        if (!ok) {
          failures += 1
          out(`FAIL ${pageName}:${n}  ${msg}`)
          out(`     ${line.trim()}`)
        }
      }
    }
    for (const [n, name] of actionsWithoutEvidence(text)) {
      failures += 1
      uncited.push(`${pageName}:${n}`)
      out(`FAIL ${pageName}:${n}  action '${name}' has NO Evidence line`)
    }
  }

  out(`\n${checked} evidence lines checked, ${failures} failure(s), ` +
      `${unverified} marked unverified.`)
  if (uncited.length) {
    out(`${uncited.length} action(s) carry no citation at all: ${uncited.slice(0, 8).join(", ")}`)
    out("An action with no Evidence is a claim with nothing behind it. Trace it or")
    out("delete it — those are the two honest endings.")
  }
  if (failures) {
    out("Re-trace each failing claim against the code. Do NOT reword to vagueness.")
  }
  if (unverified && !failures) {
    out("Marked-unverified claims are a real cost: they reach the board as claims")
    out("nobody could check. Say how many in your feedback.")
  }
  return failures ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2))
}

export { checkLine, actionsWithoutEvidence, checkCapabilities, pySplitlines, main }
