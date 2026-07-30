#!/usr/bin/env python3
"""Evidence harvester for vibeassist-map (run once before Phase 3).

For each route in map/_routes.json, resolves the route file plus its imports
two levels deep - relative imports AND path aliases (read from tsconfig.json /
jsconfig.json compilerOptions.paths, falling back to @/ -> src/ and ~/ -> src/),
including `export ... from` re-exports and dynamic import(...) - then extracts
with line numbers:
  - interactive elements (onClick, onSubmit, type="submit", form controls)
  - server function declarations (createServerFn, exported functions)
  - database calls tagged READ / INSERT / UPDATE / DELETE, via a DETECTED data
    layer (Supabase/Knex, Prisma, Drizzle, Firestore, Mongoose, raw SQL) rather
    than one assumed idiom; storage buckets, .rpc() and functions.invoke() are
    recorded separately and NEVER as tables
  - the real table list, read from the schema where one exists
    (schema.prisma, Drizzle pgTable schema, supabase/migrations/*.sql)

If controls are found but the data layer is unrecognised, the harvester REFUSES
(exit 3) instead of emitting a map that would falsely claim no page touches data.

Writes map/_harvest.json. Phase 3 writes user language FROM this file, so the
line number is in front of you before you write the sentence.

Regex-based on purpose: fast, dependency-free, good enough to anchor citations.
It will miss unusual patterns — anything found by reading, cite normally.

Usage:
    python scripts/harvest.py map/_routes.json --repo-root . -o map/_harvest.json
"""
import argparse
import json
import pathlib
import re
import sys

# Windows terminals default to cp1252; keep output ASCII-safe AND reconfigure.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

IMPORT_SPECS = [
    # import x from "spec" / import "spec"
    re.compile(r"""^\s*import\s+(?:type\s+)?(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]""", re.M),
    # export ... from "spec" (re-exports)
    re.compile(r"""^\s*export\s+(?:type\s+)?[^'"]*?\s+from\s+['"]([^'"]+)['"]""", re.M),
    # dynamic import("spec")
    re.compile(r"""\bimport\(\s*['"]([^'"]+)['"]\s*\)"""),
]


def load_aliases(repo: pathlib.Path):
    """Read compilerOptions.paths from tsconfig/jsconfig (tolerant of comments
    and trailing commas). Returns list of (prefix, [target dirs])."""
    aliases = []
    for name in ("tsconfig.json", "jsconfig.json"):
        cfg = repo / name
        if not cfg.is_file():
            continue
        raw = cfg.read_text(encoding="utf-8", errors="replace")
        raw = re.sub(r"//[^\n]*", "", raw)
        raw = re.sub(r"/\*.*?\*/", "", raw, flags=re.S)
        raw = re.sub(r",\s*([}\]])", r"\1", raw)
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        opts = data.get("compilerOptions", {})
        base = repo / opts.get("baseUrl", ".")
        for pat, targets in opts.get("paths", {}).items():
            prefix = pat[:-1] if pat.endswith("*") else pat
            dirs = [(base / (t[:-1] if t.endswith("*") else t)).resolve() for t in targets]
            aliases.append((prefix, dirs))
    if not aliases:  # scaffold defaults (Vite / Next / TanStack)
        aliases = [("@/", [(repo / "src").resolve()]), ("~/", [(repo / "src").resolve()])]
    # longest prefix first so "@/lib/" style aliases win over "@/"
    aliases.sort(key=lambda a: -len(a[0]))
    return aliases


def find_imports(text: str):
    specs = []
    for pat in IMPORT_SPECS:
        specs.extend(pat.findall(text))
    return specs
INTERACTIVE = re.compile(
    r"onClick=|onSubmit=|onChange=|type=[\"']submit[\"']|<button\b|<form\b|<input\b|<select\b|<textarea\b|role=[\"']button[\"']"
)
# Only genuine server-side handlers: createServerFn assignments, exported async
# functions, or (in a "use server" file) any exported function. Plain React
# component exports must NOT land here - the field promises server functions.
SERVER_FN_STRICT = re.compile(r"export\s+const\s+(\w+)\s*=\s*createServerFn|export\s+async\s+function\s+(\w+)")
SERVER_FN_USE_SERVER = re.compile(r"export\s+(?:async\s+)?function\s+(\w+)|export\s+const\s+(\w+)\s*=")
# ---------------- data layer engine (Fix 1) ----------------
# Schema-qualified names allowed: [\w.]+ not \w+ (public.users would truncate).
STORAGE_FROM = re.compile(r"""\.storage\s*\.\s*from\(\s*['"]([\w.-]+)['"]""")
DB_FROM = re.compile(r"""\.from\(\s*['"]([\w.]+)['"]\s*\)""")
DB_FROM_IDENT = re.compile(r"""\.from\(\s*([A-Za-z_]\w*)\s*\)""")  # drizzle: table object
RPC_CALL = re.compile(r"""\.rpc\(\s*['"]([\w.]+)['"]""")
FN_INVOKE = re.compile(r"""functions\s*\.\s*invoke\(\s*['"]([\w.-]+)['"]""")
OP_HINTS = [
    (re.compile(r"\.insert\s*\("), "INSERT"),
    (re.compile(r"\.upsert\s*\("), "INSERT/UPDATE"),
    (re.compile(r"\.update\s*\("), "UPDATE"),
    (re.compile(r"\.delete\s*\("), "DELETE"),
    (re.compile(r"\.select\s*\("), "READ"),
]
RAW_SQL = re.compile(r"\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+", re.I)
PRISMA_CALL = re.compile(r"\b(?:prisma|db|client)\.(\w+)\.(findMany|findUnique|findUniqueOrThrow|findFirst|findFirstOrThrow|count|aggregate|groupBy|create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany)\b")
PRISMA_READ_OPS = {"findMany", "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "count", "aggregate", "groupBy"}
DRIZZLE_WRITE = re.compile(r"\bdb\.(insert|update|delete)\(\s*([A-Za-z_]\w*)\s*\)")
FIRE_COLLECTION = re.compile(r"""\b(?:collection|collectionGroup|doc)\(\s*\w+\s*,\s*['"]([\w/-]+)['"]""")
FIRE_OPS = [
    (re.compile(r"\b(?:setDoc|addDoc)\b"), "INSERT"),
    (re.compile(r"\bupdateDoc\b"), "UPDATE"),
    (re.compile(r"\bdeleteDoc\b"), "DELETE"),
    (re.compile(r"\b(?:getDocs?|onSnapshot)\b"), "READ"),
]
MONGO_CALL = re.compile(r"\b([A-Z]\w+)\.(find|findOne|findById|aggregate|countDocuments|create|insertMany|updateOne|updateMany|findByIdAndUpdate|deleteOne|deleteMany|findByIdAndDelete)\b")
MONGO_READ_OPS = {"find", "findOne", "findById", "aggregate", "countDocuments"}


def read_json_tolerant(p: pathlib.Path):
    raw = p.read_text(encoding="utf-8", errors="replace")
    raw = re.sub(r"//[^\n]*", "", raw)
    raw = re.sub(r"/\*.*?\*/", "", raw, flags=re.S)
    raw = re.sub(r",\s*([}\]])", r"\1", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def detect_data_layers(repo: pathlib.Path):
    """Fix 1a: pick data strategies from EVIDENCE - deps and schema files."""
    layers = []
    deps = {}
    pkg = repo / "package.json"
    if pkg.is_file():
        data = read_json_tolerant(pkg)
        for k in ("dependencies", "devDependencies"):
            deps.update(data.get(k, {}))
    prisma_schemas = list(repo.glob("prisma/schema.prisma")) + list(repo.glob("**/schema.prisma"))
    prisma_schemas = [p for p in prisma_schemas if "node_modules" not in p.parts][:3]
    if "@supabase/supabase-js" in deps:
        layers.append("supabase")
    if prisma_schemas or "@prisma/client" in deps or "prisma" in deps:
        layers.append("prisma")
    if "drizzle-orm" in deps:
        layers.append("drizzle")
    if "firebase" in deps or "firebase-admin" in deps:
        layers.append("firestore")
    if "mongoose" in deps:
        layers.append("mongo")
    if any(d in deps for d in ("knex", "pg", "postgres", "mysql2", "better-sqlite3", "sqlite3")):
        layers.append("sql")
    if not layers:
        # no-package.json apps (script-tag Supabase) and monorepo roots: source sniff
        for f in list(repo.glob("*.html")) + list(repo.glob("src/**/*.ts"))[:50] + list(repo.glob("src/**/*.js"))[:50]:
            try:
                t = f.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            if "supabase" in t and ("createClient" in t or ".from(" in t):
                layers.append("supabase")
                break
    return layers, prisma_schemas


def read_schema_tables(repo: pathlib.Path, layers, prisma_schemas):
    """Fix 1b: the REAL table list, read from schema files where they exist.
    Returns (tables:set, drizzle_ident_map:{identifier->table}, prisma_model_map:{model_lower->table})."""
    tables, drizzle_map, prisma_map = set(), {}, {}
    if "prisma" in layers:
        model = re.compile(r"^model\s+(\w+)\s*\{", re.M)
        mapped = re.compile(r"@@map\(\s*['\"]([\w.]+)['\"]\s*\)")
        for sf in prisma_schemas:
            text = sf.read_text(encoding="utf-8", errors="replace")
            for m in model.finditer(text):
                name = m.group(1)
                block = text[m.end(): text.find("}", m.end())]
                mm = mapped.search(block)
                table = mm.group(1) if mm else name
                tables.add(table)
                prisma_map[name.lower()] = table
    if "drizzle" in layers:
        decl = re.compile(r"(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:pgTable|mysqlTable|sqliteTable)\(\s*['\"]([\w.]+)['\"]")
        cands = [p for p in repo.glob("**/*.ts") if "node_modules" not in p.parts and "schema" in p.name.lower()]
        cands += [p for p in repo.glob("**/db/schema/**/*.ts") if "node_modules" not in p.parts]
        for sf in cands[:40]:
            text = sf.read_text(encoding="utf-8", errors="replace")
            for ident, table in decl.findall(text):
                drizzle_map[ident] = table
                tables.add(table)
    if "supabase" in layers:
        ct = re.compile(r"create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?\"?(\w+)\"?", re.I)
        for sf in list(repo.glob("supabase/migrations/*.sql"))[:200]:
            for m in ct.finditer(sf.read_text(encoding="utf-8", errors="replace")):
                tables.add(m.group(1))
    return tables, drizzle_map, prisma_map
EXTS = [".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts", "/index.jsx", "/index.js"]


def resolve_import(base: pathlib.Path, spec: str, repo: pathlib.Path, aliases):
    targets = []
    if spec.startswith("."):
        targets = [(base.parent / spec).resolve()]
    else:
        for prefix, dirs in aliases:
            if spec.startswith(prefix):
                rest = spec[len(prefix):]
                targets = [(d / rest).resolve() for d in dirs]
                break
        else:
            return None  # bare package import (node_modules) - skip
    for target in targets:
        cands = [target] if target.suffix else []
        cands += [pathlib.Path(str(target) + e) for e in EXTS]
        for c in cands:
            if c.is_file() and (repo == c or repo in c.parents):
                return c
    return None


def collect_files(entry_file: pathlib.Path, repo: pathlib.Path, aliases, depth: int = 2):
    seen, frontier = {entry_file}, [entry_file]
    for _ in range(depth):
        nxt = []
        for f in frontier:
            try:
                text = f.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            for spec in find_imports(text):
                r = resolve_import(f, spec, repo, aliases)
                if r and r not in seen:
                    seen.add(r)
                    nxt.append(r)
        frontier = nxt
    return sorted(seen)


def tag_op(lines, i):
    """Look on the .from() line and the next few for the verb."""
    window = " ".join(lines[i : i + 5])
    for pat, op in OP_HINTS:
        if pat.search(window):
            return op
    return "READ?"  # .from() with no visible verb nearby


def harvest_file(f: pathlib.Path, repo: pathlib.Path, layers=("supabase", "sql"), drizzle_map=None, prisma_map=None):
    rel = str(f.relative_to(repo)).replace("\\", "/")
    drizzle_map = drizzle_map or {}
    prisma_map = prisma_map or {}
    out = {"interactive": [], "server_fns": [], "db": [], "raw_sql": [], "storage": [], "rpc": [], "edge_fns": []}
    try:
        text = f.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return out
    lines = text.splitlines()
    use_server = '"use server"' in text[:400] or "'use server'" in text[:400]
    for i, line in enumerate(lines):
        n = i + 1
        if INTERACTIVE.search(line):
            out["interactive"].append({"file": rel, "line": n, "snippet": line.strip()[:160]})
        m = SERVER_FN_STRICT.search(line)
        name = None
        if m:
            name = m.group(1) or m.group(2)
        elif use_server:
            m2 = SERVER_FN_USE_SERVER.search(line)
            if m2:
                name = m2.group(1) or m2.group(2)
        if name:
            out["server_fns"].append({"file": rel, "line": n, "name": name})
        # storage buckets FIRST, and never as tables (Fix 1d)
        consumed_spans = []
        for m in STORAGE_FROM.finditer(line):
            out["storage"].append({"file": rel, "line": n, "bucket": m.group(1)})
            consumed_spans.append(m.span())
        for m in RPC_CALL.finditer(line):
            out["rpc"].append({"file": rel, "line": n, "fn": m.group(1)})
        for m in FN_INVOKE.finditer(line):
            out["edge_fns"].append({"file": rel, "line": n, "fn": m.group(1)})
        if "supabase" in layers or "sql" in layers:
            for m in DB_FROM.finditer(line):
                if any(a <= m.start() < b + 20 for a, b in consumed_spans):
                    continue  # this .from() belongs to storage
                out["db"].append({"file": rel, "line": n, "table": m.group(1), "op": tag_op(lines, i), "layer": "supabase/sql"})
        if "drizzle" in layers:
            for m in DRIZZLE_WRITE.finditer(line):
                ident = m.group(2)
                out["db"].append({"file": rel, "line": n, "table": drizzle_map.get(ident, ident),
                                  "op": {"insert": "INSERT", "update": "UPDATE", "delete": "DELETE"}[m.group(1)],
                                  "layer": "drizzle", "resolved": ident in drizzle_map})
            if ".select(" in line or "db.select" in line:
                for m in DB_FROM_IDENT.finditer(line):
                    ident = m.group(1)
                    out["db"].append({"file": rel, "line": n, "table": drizzle_map.get(ident, ident),
                                      "op": "READ", "layer": "drizzle", "resolved": ident in drizzle_map})
        if "prisma" in layers:
            for m in PRISMA_CALL.finditer(line):
                model, op = m.group(1), m.group(2)
                if model in ("storage", "auth", "functions"):
                    continue
                out["db"].append({"file": rel, "line": n, "table": prisma_map.get(model.lower(), model),
                                  "op": "READ" if op in PRISMA_READ_OPS else op.upper().replace("MANY", "").replace("ANDRETURN", ""),
                                  "layer": "prisma"})
        if "firestore" in layers:
            for m in FIRE_COLLECTION.finditer(line):
                op = "READ"
                window = " ".join(lines[max(0, i - 2): i + 3])
                for pat, o in FIRE_OPS:
                    if pat.search(window):
                        op = o
                        break
                out["db"].append({"file": rel, "line": n, "table": m.group(1), "op": op, "layer": "firestore"})
        if "mongo" in layers:
            for m in MONGO_CALL.finditer(line):
                out["db"].append({"file": rel, "line": n, "table": m.group(1),
                                  "op": "READ" if m.group(2) in MONGO_READ_OPS else "WRITE", "layer": "mongo"})
        if RAW_SQL.search(line) and ("`" in line or '"' in line or "'" in line):
            # kept OUT of "db" so it never pollutes distinct-table counts
            out["raw_sql"].append({"file": rel, "line": n, "verb": RAW_SQL.search(line).group(1).upper(), "snippet": line.strip()[:160]})
    return out


RLS_ENABLE = re.compile(r"alter\s+table\s+(?:public\.)?\"?(\w+)\"?\s+enable\s+row\s+level\s+security", re.I)
RLS_POLICY = re.compile(r"create\s+policy\s+\"?([^\"\n]+?)\"?\s+on\s+(?:public\.)?\"?(\w+)\"?(?:\s+as\s+\w+)?(?:\s+for\s+(select|insert|update|delete|all))?(?:\s+to\s+([\w ,]+?))?\s+(?:using|with)", re.I | re.S)
ENV_VAR = re.compile(r"process\.env\.(\w+)|import\.meta\.env\.(\w+)|Deno\.env\.get\(\s*['\"](\w+)['\"]")
CONFIRM_PATTERN = re.compile(r"window\.confirm|\bconfirm\(|<AlertDialog|ConfirmDialog|useConfirm|\bAreYouSure")
SERVICE_DEPS = {  # package.json dependency -> human name (Keys & services list)
    "stripe": "Stripe (payments)", "@stripe/stripe-js": "Stripe (payments)",
    "resend": "Resend (email)", "@sendgrid/mail": "SendGrid (email)", "nodemailer": "SMTP email (nodemailer)",
    "twilio": "Twilio (SMS/voice)", "openai": "OpenAI API", "@anthropic-ai/sdk": "Anthropic API",
    "@supabase/supabase-js": "Supabase (database/auth/storage)", "firebase": "Firebase",
    "@aws-sdk/client-s3": "AWS S3 (file storage)", "aws-sdk": "AWS",
    "posthog-js": "PostHog (analytics)", "@sentry/react": "Sentry (error tracking)", "@sentry/node": "Sentry (error tracking)",
    "algoliasearch": "Algolia (search)", "pusher-js": "Pusher (realtime)",
}
EMAIL_DEPS = {"resend", "@sendgrid/mail", "nodemailer"}
PAYMENT_DEPS = {"stripe", "@stripe/stripe-js"}


def collect_permissions(repo: pathlib.Path):
    """Who's allowed to do what: RLS enables + policies from supabase migrations."""
    enabled, policies = set(), []
    for sf in sorted(repo.glob("supabase/migrations/*.sql"))[:300]:
        text = sf.read_text(encoding="utf-8", errors="replace")
        rel = str(sf.relative_to(repo)).replace("\\", "/")
        for m in RLS_ENABLE.finditer(text):
            enabled.add(m.group(1))
        for m in RLS_POLICY.finditer(text):
            policies.append({"table": m.group(2), "policy": m.group(1).strip(),
                             "action": (m.group(3) or "all").lower(),
                             "roles": (m.group(4) or "public").strip(),
                             "file": rel, "line": text[:m.start()].count("\n") + 1})
    return sorted(enabled), policies


def collect_env_and_services(repo: pathlib.Path, deps: dict):
    env = {}
    scan = [p for pat in ("src/**/*.ts", "src/**/*.tsx", "src/**/*.js", "src/**/*.jsx", "supabase/functions/**/*.ts")
            for p in repo.glob(pat) if "node_modules" not in p.parts][:800]
    for f in scan:
        try:
            text = f.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        rel = str(f.relative_to(repo)).replace("\\", "/")
        for m in ENV_VAR.finditer(text):
            name = m.group(1) or m.group(2) or m.group(3)
            if name and name not in env and not name.startswith(("NODE_", "MODE", "DEV", "PROD", "BASE_URL", "SSR")):
                env[name] = {"file": rel, "line": text[:m.start()].count("\n") + 1}
    services = sorted({v for k, v in SERVICE_DEPS.items() if k in deps})
    return env, services


def dangerous_flags(agg: dict, deps: dict, files_text: str):
    """Dangerous-buttons audit inputs: irreversible/expensive calls on this page's path."""
    flags = []
    for d in agg.get("db", []):
        if d["op"] == "DELETE":
            flags.append({"kind": "delete data", "table": d["table"], "file": d["file"], "line": d["line"]})
    if any(k in deps for k in PAYMENT_DEPS) and ("stripe" in files_text.lower() or "checkout" in files_text.lower()):
        flags.append({"kind": "take payment"})
    if any(k in deps for k in EMAIL_DEPS) and re.search(r"send|mail", files_text, re.I):
        flags.append({"kind": "send email"})
    for e in agg.get("edge_fns", []):
        if re.search(r"send|mail|charge|pay|delete|purge", e["fn"], re.I):
            flags.append({"kind": f"run the server action '{e['fn']}'", "file": e["file"], "line": e["line"]})
    return flags


def route_slug(path: str) -> str:
    """Canonical page-file slug shared with assemble.py: strip the leading
    slash, replace / with -, drop parameter markers. '/' -> 'index'."""
    s = path.strip("/")
    s = re.sub(r"[:$\[\]]", "", s)
    return s.replace("/", "-") or "index"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("routes_json")
    ap.add_argument("--repo-root", default=".")
    ap.add_argument("-o", "--out", default="map/_harvest.json")
    ap.add_argument("--depth", type=int, default=2)
    args = ap.parse_args()
    repo = pathlib.Path(args.repo_root).resolve()
    aliases = load_aliases(repo)
    layers, prisma_schemas = detect_data_layers(repo)
    pkg_deps = {}
    if (repo / "package.json").is_file():
        _p = read_json_tolerant(repo / "package.json")
        for _k in ("dependencies", "devDependencies"):
            pkg_deps.update(_p.get(_k, {}))
    schema_tables, drizzle_map, prisma_map = read_schema_tables(repo, layers, prisma_schemas)
    print(f"data layer(s) detected: {', '.join(layers) if layers else 'NONE'}"
          + (f"; schema tables found: {len(schema_tables)}" if schema_tables else ""))
    extract_layers = layers if layers else ["supabase", "sql"]  # generic quoted idiom as last resort
    routes = json.loads(pathlib.Path(args.routes_json).read_text(encoding="utf-8"))
    if isinstance(routes, dict):
        routes = routes.get("routes", [])

    result = {}
    for r in routes:
        src = r.get("source_file")
        if not src:
            continue
        entry = (repo / src).resolve()
        if not entry.is_file():
            result[r["path"]] = {"error": f"source file not found: {src}"}
            continue
        files = collect_files(entry, repo, aliases, args.depth)
        agg = {"slug": route_slug(r["path"]), "files": [str(f.relative_to(repo)).replace("\\", "/") for f in files],
               "interactive": [], "server_fns": [], "db": [], "raw_sql": [], "storage": [], "rpc": [], "edge_fns": []}
        for f in files:
            h = harvest_file(f, repo, extract_layers, drizzle_map, prisma_map)
            for k in ("interactive", "server_fns", "db", "raw_sql", "storage", "rpc", "edge_fns"):
                agg[k].extend(h[k])
        files_text = ""
        for f in files[:60]:
            try:
                files_text += f.read_text(encoding="utf-8", errors="replace")
            except OSError:
                pass
        agg["dangerous"] = dangerous_flags(agg, pkg_deps, files_text)
        agg["has_confirm_pattern"] = bool(CONFIRM_PATTERN.search(files_text))
        result[r["path"]] = agg

    rls_enabled, rls_policies = collect_permissions(repo)
    env_vars, services = collect_env_and_services(repo, pkg_deps)
    touched = {d["table"] for v in result.values() if isinstance(v, dict) for d in v.get("db", [])}
    orphan_tables = sorted(t for t in schema_tables if t not in touched)
    result["_meta"] = {"data_layers": layers, "schema_tables": sorted(schema_tables),
                       "drizzle_idents": len(drizzle_map), "prisma_models": len(prisma_map),
                       "rls_enabled": rls_enabled, "rls_policies": rls_policies,
                       "tables_without_rls": sorted(t for t in schema_tables if t not in rls_enabled),
                       "orphan_tables": orphan_tables,
                       "env_vars": env_vars, "services": services}
    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    pages = {k: v for k, v in result.items() if not k.startswith("_")}
    npages = len(pages)
    ndb = sum(len(v.get("db", [])) for v in pages.values() if isinstance(v, dict))
    nfns = sum(len(v.get("server_fns", [])) for v in pages.values() if isinstance(v, dict))
    nctl = sum(len(v.get("interactive", [])) for v in pages.values() if isinstance(v, dict))
    print(f"harvested {npages} routes -> {out} ({nfns} server fns, {ndb} db call sites, {nctl} controls)")
    if nctl > 0 and ndb == 0 and not layers:
        # Fix 1c: the SILENT failure. Controls exist, no data found, layer unknown -> refuse.
        print("")
        print("REFUSING to bless this harvest: I found your pages and their controls,")
        print("but I do not recognise how this app talks to its database. Writing the")
        print("map now would claim nothing touches any data, which would be false.")
        print("Tell me the data layer, or add an adapter. (exit 3)")
        sys.exit(3)
    if nctl > 0 and ndb == 0 and layers:
        print(f"WARNING: layer(s) {layers} detected but ZERO data call sites matched.")
        print("The idiom in this codebase may differ - inspect one data file by hand")
        print("before writing any page, or the map will falsely claim no data is touched.")
    if nfns == 0 and ndb == 0 and nctl == 0:
        print("WARNING: harvest is empty everywhere - probably an unresolved path alias.")
        print("Fix that before Phase 3 - do not write pages from an empty harvest.")


if __name__ == "__main__":
    main()
