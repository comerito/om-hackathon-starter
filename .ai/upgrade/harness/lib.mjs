// Shared helpers for the 0.4.8 -> 0.6.7 upgrade baseline harness.
//
// The harness has to produce byte-comparable output across two runs against two
// different framework versions and two freshly-seeded databases. Anything that
// varies per run (uuids, timestamps, durations, ports) is normalised away here.
// Everything else is preserved exactly, because the whole point is to notice
// when a rewritten query returns different ROWS.

import fs from 'node:fs'
import path from 'node:path'

export const BASE_URL = process.env.OM_BASE_URL || 'http://localhost:3006'
export const ORG_SLUG = process.env.OM_ORG_SLUG || 'acme-corp'
export const OUT_DIR = path.resolve('.ai/upgrade/baseline')

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi
// Two timestamp dialects reach the client and BOTH must be normalised:
//   ISO-8601 from JSON serialisation  -> 2026-08-20T20:46:22.987Z
//   Postgres text from raw SQL routes -> 2026-08-20 20:46:22.987+00
// The raw-SQL routes are exactly the knex/kysely sites under scrutiny, so
// missing the second form made every one of them look like a diff. Offsets may
// be `Z`, `+00`, `+0000` or `+00:00`, and the fractional part is optional.
const TS_RE = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}(?::?\d{2})?)?/g
const DATE_RE = /\d{4}-\d{2}-\d{2}(?![\dT ])/g

/**
 * Stable UUID aliasing.
 *
 * A plain `<uuid>` replacement would hide row-identity bugs: two different rows
 * collapsing to the same placeholder looks identical to the correct result.
 * Instead each distinct uuid gets a stable alias in first-encounter order
 * (`<id:1>`, `<id:2>`, ...), so the *relationships* between ids survive
 * normalisation while the random values do not.
 *
 * The map is per-snapshot, not global, so ordering differences inside one
 * response still show up as a diff.
 */
export function createNormalizer() {
  const seen = new Map()
  const alias = (u) => {
    const k = u.toLowerCase()
    if (!seen.has(k)) seen.set(k, `<id:${seen.size + 1}>`)
    return seen.get(k)
  }
  return function normalize(value) {
    if (value === null || value === undefined) return value
    if (typeof value === 'string') {
      // timestamps first: a uuid alias could otherwise be injected mid-timestamp
      return value
        .replace(TS_RE, '<ts>')
        .replace(UUID_RE, alias)
        .replace(DATE_RE, '<date>')
    }
    if (typeof value === 'number' || typeof value === 'boolean') return value
    if (Array.isArray(value)) return value.map(normalize)
    if (typeof value === 'object') {
      const out = {}
      // sort keys so object key ordering never causes a false diff
      for (const k of Object.keys(value).sort()) {
        if (VOLATILE_KEYS.has(k)) { out[k] = '<volatile>'; continue }
        out[normalize(k)] = normalize(value[k])
      }
      return out
    }
    return value
  }
}

// Fields that legitimately differ between runs and carry no correctness signal.
//
// NOTE `server_time` / `serverTime`: these are epoch MILLISECONDS as a NUMBER,
// not a string, so the timestamp regex above cannot reach them — numbers are
// returned untouched by the normaliser. They have to be masked by key.
// Found the hard way: /api/judging/portal/current-demo reported a body delta on
// every run purely because of `server_time`.
const VOLATILE_KEYS = new Set([
  'took', 'duration', 'durationMs', 'elapsed', 'elapsedMs',
  'requestId', 'traceId', 'correlationId', 'etag', 'lastModified',
  'generatedAt', 'timestamp', 'now', 'serverTime', 'server_time', 'cacheKey',
  'generated_at', 'last_modified', 'request_id',
])

/** Cookie jar that survives redirects, keyed per principal. */
export class Jar {
  constructor() { this.cookies = new Map() }
  absorb(res) {
    const raw = res.headers.getSetCookie?.() ?? []
    for (const c of raw) {
      const [pair] = c.split(';')
      const idx = pair.indexOf('=')
      if (idx > 0) this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim())
    }
  }
  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  }
  get size() { return this.cookies.size }
}

/**
 * Endpoints that stream and never close the response body. Reading `.text()` on
 * these blocks forever — this is not hypothetical, it hung the first sweep at
 * /api/events/stream. They are recorded as deliberately-skipped rather than
 * silently dropped, so the baseline stays honest about its own coverage gap.
 */
export const STREAMING_PATHS = new Set([
  '/api/events/stream',
])

export const REQUEST_TIMEOUT_MS = Number(process.env.OM_HARNESS_TIMEOUT_MS || 15000)

export async function call(jar, method, urlPath, body, extraHeaders = {}) {
  const headers = { accept: 'application/json', ...extraHeaders }
  if (jar?.size) headers.cookie = jar.header()
  if (body !== undefined) headers['content-type'] = 'application/json'
  let res, text
  // Belt and braces: even with the skip list above, any route that starts
  // streaming must not be able to wedge the whole run.
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS)
  try {
    res = await fetch(BASE_URL + urlPath, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
      signal: ac.signal,
    })
    text = await res.text()
  } catch (err) {
    const aborted = ac.signal.aborted
    return {
      status: 0,
      error: aborted ? `TIMEOUT after ${REQUEST_TIMEOUT_MS}ms` : String(err?.message || err),
      body: null,
    }
  } finally {
    clearTimeout(timer)
  }
  if (jar) jar.absorb(res)
  let parsed = null
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    try { parsed = JSON.parse(text) } catch { parsed = { __unparseable: text.slice(0, 400) } }
  } else {
    parsed = { __contentType: ct, __len: text.length }
  }
  return {
    status: res.status,
    location: res.headers.get('location') || undefined,
    body: parsed,
    rawLength: text.length,
  }
}

export function writeJson(file, data) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const p = path.join(OUT_DIR, file)
  fs.writeFileSync(p, JSON.stringify(data, null, 1) + '\n')
  return p
}

export function readJson(file) {
  const p = path.join(OUT_DIR, file)
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}
