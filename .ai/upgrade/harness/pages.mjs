// Page-render baseline.
//
// Covers the 31 portal pages plus the backend shell. HTML is far too volatile to
// diff byte-for-byte (build ids, chunk hashes, RSC payloads), so instead of the
// body we pin the SIGNALS that actually indicate breakage:
//
//   - HTTP status and redirect target
//   - whether Next rendered an error boundary / digest
//   - whether the page produced a server-side exception
//   - a coarse content fingerprint (length bucket + presence of known markers)
//
// The precise row-level assertions live in the API read sweep; this file exists
// to catch "the page 500s now" and "the page silently redirects to login now",
// which the API sweep cannot see.
//
//   node .ai/upgrade/harness/pages.mjs --out pages.json
//   node .ai/upgrade/harness/pages.mjs --out pages-verify.json --compare pages.json

import fs from 'node:fs'
import { BASE_URL, writeJson, readJson } from './lib.mjs'
import { loginAll } from './auth.mjs'

const args = process.argv.slice(2)
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const OUT = argOf('--out', 'pages.json')
const COMPARE = argOf('--compare', null)

const PRINCIPALS = ['admin', 'alice', 'bob', 'anon']

const fixtures = fs.existsSync('.ai/upgrade/baseline/fixtures.json')
  ? JSON.parse(fs.readFileSync('.ai/upgrade/baseline/fixtures.json', 'utf8'))
  : {}
const SENTINEL = '00000000-0000-4000-8000-000000000000'

const PORTAL = fs.readFileSync(new URL('./portal-paths.txt', import.meta.url), 'utf8')
  .split('\n').map((s) => s.trim()).filter(Boolean)

const BACKEND = [
  '/backend', '/backend/competitions', '/backend/tracks', '/backend/teams',
  '/backend/projects', '/backend/judging', '/backend/sponsors', '/backend/bounties',
  '/backend/incidents',
]

// Keep the TEMPLATE as the result key and the FILLED path as what we request.
// Keying on the filled path made every run produce different keys (fixture uuids
// are minted fresh each seed), which showed up as 16 phantom added/removed deltas.
const paths = [...PORTAL, ...BACKEND].map((template) => ({
  template,
  url: template.replace(/\[(\w+)\]/g, (_, name) => fixtures.pathParams?.[name] ?? SENTINEL),
}))

// Markers that indicate a broken render regardless of status code.
//
// These were CHOSEN EMPIRICALLY, not guessed. In dev mode Next inlines its whole
// client bundle into every page, so the obvious strings ("This page could not be
// found", "Something went wrong", "digest:", "error-boundary") appear on healthy
// pages too — an earlier version of this file used them and flagged 160/160
// renders as broken. Verified counts on a known-good vs known-404 page:
//
//   marker                     good  bad
//   __next_error__                0    1   <- discriminates
//   NEXT_HTTP_ERROR_FALLBACK      0    2   <- discriminates
//   This page could not be found  1    2   x  bundle noise
//   Something went wrong          1    1   x  bundle noise
//   digest                        1    2   x  bundle noise
//
// Re-verify these if the Next.js major version changes.
const ERROR_MARKERS = [
  '__next_error__',
  'NEXT_HTTP_ERROR_FALLBACK',
]

console.error(`[pages] ${paths.length} paths x ${PRINCIPALS.length} principals`)
const sessions = await loginAll(PRINCIPALS)

const results = {}
for (const { template, url: p } of paths) {
  for (const principal of PRINCIPALS) {
    const jar = sessions[principal].jar
    const headers = { accept: 'text/html' }
    if (jar.size) headers.cookie = jar.header()
    let status = 0, location, html = '', err
    try {
      const res = await fetch(BASE_URL + p, { headers, redirect: 'manual' })
      status = res.status
      location = res.headers.get('location') || undefined
      html = await res.text()
    } catch (e) { err = String(e?.message || e) }

    // Only meaningful on a body that was actually rendered. A 3xx auth redirect
    // carries Next's internal redirect payload, which contains `__next_error__`
    // without anything being wrong — flagging those buried the real signal.
    const markers = status >= 200 && status < 300
      ? ERROR_MARKERS.filter((m) => html.includes(m))
      : []
    results[`${template} :: ${principal}`] = {
      status,
      // normalise the redirect target: strip volatile query params
      location: location ? location.replace(/([?&])(next|callback|redirect)=[^&]*/g, '$1$2=<path>') : undefined,
      errorMarkers: markers,
      // coarse bucket, so cosmetic HTML churn does not create false deltas but a
      // page collapsing from full render to an error stub does
      sizeBucket: err ? 'error' : bucket(html.length),
      fetchError: err,
    }
  }
}

function bucket(n) {
  if (n < 500) return '<0.5k'
  if (n < 2000) return '0.5-2k'
  if (n < 10000) return '2-10k'
  if (n < 50000) return '10-50k'
  if (n < 200000) return '50-200k'
  return '>200k'
}

const broken = Object.entries(results).filter(([, v]) => v.status >= 500 || v.errorMarkers.length || v.fetchError)
console.error(`[pages] ${Object.keys(results).length} renders, ${broken.length} with error signals`)
for (const [k, v] of broken.slice(0, 30)) console.error('  BROKEN', k, v.status, v.errorMarkers.join('|'), v.fetchError || '')

writeJson(OUT, { meta: { paths: paths.length, principals: PRINCIPALS, brokenCount: broken.length }, results })
console.error(`[pages] wrote ${OUT}`)

if (COMPARE) {
  const prev = readJson(COMPARE)
  if (!prev) { console.error(`[pages] cannot compare: ${COMPARE} missing`); process.exit(2) }
  const deltas = []
  const keys = new Set([...Object.keys(prev.results), ...Object.keys(results)])
  for (const k of keys) {
    const a = prev.results[k], b = results[k]
    if (!a || !b) { deltas.push({ key: k, kind: a ? 'removed' : 'added' }); continue }
    if (JSON.stringify(a) !== JSON.stringify(b)) deltas.push({ key: k, kind: 'changed', from: a, to: b })
  }
  console.error(`[pages] DELTAS: ${deltas.length} / ${keys.size}`)
  writeJson(OUT.replace('.json', '') + '-deltas.json', deltas)
  for (const d of deltas.slice(0, 30)) console.error('  ', d.kind, d.key)
  process.exit(deltas.length === 0 ? 0 : 1)
}
