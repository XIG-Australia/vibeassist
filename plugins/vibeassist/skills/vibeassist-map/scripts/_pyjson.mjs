// Python-compatible JSON: json.dumps(obj, indent=2) with ensure_ascii=True,
// and json.dumps(obj) compact form (separators (', ', ': ')). Node's
// JSON.stringify differs only in (a) not escaping non-ASCII and (b) compact
// separators, so we fix exactly those.

function escapeNonAscii(s) {
  let out = ''
  for (const ch of s) {
    const cp = ch.codePointAt(0)
    if (cp < 0x80) { out += ch; continue }
    if (cp > 0xffff) {
      const c = cp - 0x10000
      const hi = 0xd800 + (c >> 10)
      const lo = 0xdc00 + (c & 0x3ff)
      out += '\\u' + hi.toString(16).padStart(4, '0') + '\\u' + lo.toString(16).padStart(4, '0')
    } else {
      out += '\\u' + cp.toString(16).padStart(4, '0')
    }
  }
  return out
}

/** json.dumps(obj, indent=2) — ensure_ascii=True. */
export function dumps(obj, indent = 2) {
  const s = JSON.stringify(obj, null, indent)
  return escapeNonAscii(s)
}

/** json.dumps(obj) — compact, Python default separators (', ', ': '). */
export function dumpsCompact(obj) {
  const s = JSON.stringify(obj)
    .replace(/","/g, '", "')   // not robust for all cases; compact form is rarely used — see note
  // Build compact form faithfully via a custom walker instead of regex:
  return escapeNonAscii(compact(obj))
}

function compact(o) {
  if (o === null) return 'null'
  if (typeof o === 'number') return Number.isInteger(o) ? String(o) : JSON.stringify(o)
  if (typeof o === 'boolean') return o ? 'true' : 'false'
  if (typeof o === 'string') return JSON.stringify(o)
  if (Array.isArray(o)) return '[' + o.map(compact).join(', ') + ']'
  const parts = []
  for (const k of Object.keys(o)) parts.push(JSON.stringify(k) + ': ' + compact(o[k]))
  return '{' + parts.join(', ') + '}'
}
