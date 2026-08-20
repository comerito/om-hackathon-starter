// Read-path baseline sweep.
//
// Drives every GET operation in .mercato/generated/openapi.generated.json against
// every principal, and records the NORMALISED full response body for each.
//
// Why full bodies and not shape hashes: the MikroORM 6->7 port rewrites ~40 raw
// SQL / query-builder call sites that are all behind `as any`. A wrong-but-
// well-formed 200 is exactly the failure mode, and a shape hash cannot see it.
//
//   node .ai/upgrade/harness/sweep.mjs --out api-reads.json
//   node .ai/upgrade/harness/sweep.mjs --out api-reads-verify.json --compare api-reads.json

import fs from 'node:fs'
import { call, createNormalizer, writeJson, readJson, OUT_DIR, STREAMING_PATHS } from './lib.mjs'
import { loginAll } from './auth.mjs'

const args = process.argv.slice(2)
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const OUT = argOf('--out', 'api-reads.json')
const COMPARE = argOf('--compare', null)

const PRINCIPALS = ['admin', 'alice', 'bob', 'carol', 'anon']

const spec = JSON.parse(fs.readFileSync('.mercato/generated/openapi.generated.json', 'utf8'))
const fixtures = fs.existsSync(`${OUT_DIR}/fixtures.json`)
  ? JSON.parse(fs.readFileSync(`${OUT_DIR}/fixtures.json`, 'utf8'))
  : {}

/**
 * Path params are substituted from the fixtures manifest produced by seed.mjs.
 * A path whose param we cannot fill is still swept with a fixed sentinel so we
 * capture its not-found behaviour (which is itself a contract worth pinning).
 */
const PARAM_SENTINEL = '00000000-0000-4000-8000-000000000000'
function fillPath(p) {
  const used = []
  const filled = p.replace(/\{([^}]+)\}/g, (_, name) => {
    const v = fixtures.pathParams?.[name] ?? fixtures.pathParams?.[name.replace(/Id$/, '')] ?? null
    used.push({ name, value: v ? 'fixture' : 'sentinel' })
    return v ?? PARAM_SENTINEL
  })
  return { filled, used, parameterised: used.length > 0 }
}

// Query strings that materially change what a read route returns. Swept in
// addition to the bare path so pagination/filter/sort code paths are covered.
const QUERY_VARIANTS = {
  default: '',
  paged: '?page=1&pageSize=5',
  sorted: '?page=1&pageSize=5&sortDir=asc',
}

/**
 * REQUIRED query parameters, supplied from the seeded fixture.
 *
 * Without these, most app-module routes reject with 400 ("competition_id is
 * required") BEFORE reaching any SQL — which silently made the S2 knex-port
 * verification near-worthless: 17 of 22 rewritten routes were never executed
 * at all. Each entry below produces an extra `fixture` variant so the rewritten
 * SQL actually runs against real rows.
 *
 * Keep this map in sync with seed.mjs's fixture manifest.
 */
const F = () => fixtures.ids ?? {}
const first = (a) => (Array.isArray(a) && a.length ? a[0] : null)
const FIXTURE_PARAMS = {
  '/api/competitions/portal/competition-stats': () => `?competition_id=${F().competitionId}`,
  '/api/competitions/portal/competition-data': () => `?competition_id=${F().competitionId}`,
  '/api/competitions/portal/my-participation': () => `?competition_id=${F().competitionId}`,
  '/api/competitions/portal/participants': () => `?competition_id=${F().competitionId}`,
  '/api/competitions/portal/looking-for-team': () => `?competition_id=${F().competitionId}`,
  '/api/competitions/portal/search-participants': () => `?competition_id=${F().competitionId}&q=up`,
  '/api/competitions/portal/resolve-users': () => `?ids=${Object.values(F().userIds ?? {}).slice(0, 3).join(',')}`,
  '/api/competitions/portal/chat': () => `?competition_id=${F().competitionId}`,
  '/api/competitions/portal/chat/unread-count': () => `?competition_id=${F().competitionId}`,
  '/api/competitions/portal/chat/find-thread': () => `?competition_id=${F().competitionId}&user_id=${(F().userIds ?? {}).evan}`,
  '/api/competitions/portal/chat/{threadId}': () => `?competition_id=${F().competitionId}`,
  '/api/competitions/admin/invitations': () => `?competition_id=${F().competitionId}`,
  '/api/competitions/admin/participant-invitations': () => `?competition_id=${F().competitionId}&customer_user_id=${(F().userIds ?? {}).dana}`,
  '/api/competitions/participations': () => `?competition_id=${F().competitionId}`,
  '/api/competitions/checkin': () => `?competition_id=${F().competitionId}`,

  '/api/teams/portal/browse-teams': () => `?competition_id=${F().competitionId}`,
  '/api/teams/portal/my-invitations': () => `?competition_id=${F().competitionId}`,
  '/api/teams/portal/my-membership': () => `?competition_id=${F().competitionId}`,
  '/api/teams/portal/my-team-membership': () => `?competition_id=${F().competitionId}`,
  '/api/teams/portal/my-tracks': () => `?competition_id=${F().competitionId}`,

  '/api/judging/portal/export-results': () => `?competition_id=${F().competitionId}`,
  '/api/judging/portal/my-assignments': () => `?competition_id=${F().competitionId}`,
  '/api/judging/portal/current-demo': () => `?competition_id=${F().competitionId}`,
  '/api/judging/portal/score-project': () => `?competition_id=${F().competitionId}&project_id=${first(F().projectIds)}`,
  '/api/judging/panel-members': () => `?panel_id=${F().panelId}`,
  '/api/judging/leaderboard': () => `?competition_id=${F().competitionId}`,

  '/api/tracks/portal/track-detail': () => `?track_id=${first(F().trackIds)}`,
  '/api/projects/portal/my-project': () => `?competition_id=${F().competitionId}`,
  '/api/sponsors/portal/sponsors-view': () => `?competition_id=${F().competitionId}`,
  '/api/sponsors/portal/my-votes': () => `?competition_id=${F().competitionId}`,
  '/api/bounties/leaderboard': () => `?competition_id=${F().competitionId}`,
  '/api/bounties/activity': () => `?competition_id=${F().competitionId}`,
  '/api/bounties/portal/judge/prs': () => `?competition_id=${F().competitionId}`,
  '/api/incidents/portal/my-reports': () => `?competition_id=${F().competitionId}`,
}

const gets = []
const skipped = []
for (const [p, ops] of Object.entries(spec.paths)) {
  if (!ops.get) continue
  if (STREAMING_PATHS.has(p)) { skipped.push(p); continue }
  const { filled, parameterised } = fillPath(p)
  gets.push({ template: p, path: filled, parameterised })
}
gets.sort((a, b) => a.template.localeCompare(b.template))

console.error(`[sweep] ${gets.length} GET operations x ${PRINCIPALS.length} principals`)
if (skipped.length) console.error(`[sweep] SKIPPED (streaming, never closes): ${skipped.join(', ')}`)

const sessions = await loginAll(PRINCIPALS)
console.error('[sweep] logged in:', Object.keys(sessions).join(', '))

// Build the full work list up front so it can be executed with bounded
// concurrency. Results are keyed, not appended, so completion order is
// irrelevant to the recorded output.
const work = []
for (const g of gets) {
  for (const principal of PRINCIPALS) {
    for (const [variant, qs] of Object.entries(QUERY_VARIANTS)) {
      // only sweep query variants for collection-ish routes; detail routes get default only
      if (variant !== 'default' && g.parameterised) continue
      work.push({ g, principal, variant, qs })
    }
    // extra variant supplying this route's REQUIRED params from the fixture, so
    // the handler actually reaches its SQL instead of short-circuiting on a 400
    const fp = FIXTURE_PARAMS[g.template]
    if (fp) {
      const qs = fp()
      if (qs && !qs.includes('undefined') && !qs.includes('null')) {
        work.push({ g, principal, variant: 'fixture', qs })
      }
    }
  }
}

const results = {}
let n = 0
// SEQUENTIAL BY DEFAULT — deliberately.
//
// At concurrency 4 the sweep was not reproducible: /api/dashboards/layout,
// /api/customers/pipeline-stages and /api/search/index intermittently returned
// 500 with an empty body. Hitting each of them 12 times SEQUENTIALLY on the same
// build returned 200 every time, so those are genuine cold-start races in the
// app under concurrent load, not harness artifacts (recorded as findings in
// STATE.md). A baseline that randomly contains 500s cannot be diffed, so the
// sweep trades ~10 minutes of wall clock for a result that means something.
// Override only for a quick exploratory pass, never to record a baseline.
const CONCURRENCY = Number(process.env.OM_HARNESS_CONCURRENCY || 1)

async function runWorker() {
  while (work.length) {
    const item = work.pop()
    if (!item) break
    const { g, principal, variant, qs } = item
    const key = `GET ${g.template} :: ${principal} :: ${variant}`
    const res = await call(sessions[principal].jar, 'GET', g.path + qs)
    // each snapshot gets its own alias map so id relationships are compared
    // within a response, never accidentally across responses
    const normalize = createNormalizer()
    results[key] = {
      status: res.status,
      location: res.location,
      error: res.error,
      body: normalize(res.body),
    }
    n++
    if (n % 250 === 0) console.error(`[sweep] ${n} calls...`)
  }
}

const total = work.length
await Promise.all(Array.from({ length: CONCURRENCY }, runWorker))
console.error(`[sweep] ${n}/${total} calls complete`)

for (const p of skipped) {
  results[`GET ${p} :: * :: SKIPPED`] = { status: 'skipped', reason: 'streaming endpoint (response never closes)' }
}

const timeouts = Object.entries(results).filter(([, v]) => typeof v.error === 'string' && v.error.startsWith('TIMEOUT'))
if (timeouts.length) {
  console.error(`[sweep] WARNING: ${timeouts.length} timed out — these are unreliable baseline entries:`)
  for (const [k] of timeouts.slice(0, 20)) console.error('   ', k)
}

const summary = {}
for (const [k, v] of Object.entries(results)) {
  summary[v.status] = (summary[v.status] || 0) + 1
}
console.error('[sweep] status distribution:', JSON.stringify(summary))

const payload = { meta: { calls: n, gets: gets.length, principals: PRINCIPALS, statusDistribution: summary }, results }
const p = writeJson(OUT, payload)
console.error(`[sweep] wrote ${p}`)

/**
 * Routes whose responses are legitimately not reproducible across two identical
 * runs. They are still RECORDED (so a change is visible on inspection) but are
 * excluded from the pass/fail delta count, because otherwise every verify run
 * fails for reasons that have nothing to do with the upgrade.
 *
 * Each entry must state why. Do not add to this list to silence a real diff.
 */
const QUARANTINE = [
  {
    // Audit logs record the harness's own HTTP traffic, so the contents differ
    // by construction on every run. Nothing here can be pinned.
    match: (k) => k.startsWith('GET /api/audit_logs/audit-logs/access'),
    reason: 'audit log records the harness\'s own requests; nondeterministic by construction',
  },
  {
    // Response is an OBJECT KEYED BY USER UUID. The normaliser aliases uuids in
    // sorted-raw-uuid order, and the raw uuids are freshly generated by every
    // seed run, so which user becomes <id:1> is random per run even when the
    // data is byte-identical. Verified three times across S2 and S3: the same
    // three users with the same display names and emails, only the key order
    // differs. The underlying query has no ORDER BY and never did.
    match: (k) => k.startsWith('GET /api/competitions/portal/resolve-users'),
    reason: 'uuid-keyed map; alias numbering is unstable across seeds. Data verified identical.',
  },
]
const quarantined = (k) => QUARANTINE.find((q) => q.match(k))

if (COMPARE) {
  const prev = readJson(COMPARE)
  if (!prev) { console.error(`[sweep] cannot compare: ${COMPARE} missing`); process.exit(2) }
  const deltas = []
  const ignored = []
  const keys = new Set([...Object.keys(prev.results), ...Object.keys(results)])
  for (const k of keys) {
    const q = quarantined(k)
    if (q) { ignored.push({ key: k, reason: q.reason }); continue }
    const a = prev.results[k], b = results[k]
    if (!a) { deltas.push({ key: k, kind: 'added' }); continue }
    if (!b) { deltas.push({ key: k, kind: 'removed' }); continue }
    if (a.status !== b.status) { deltas.push({ key: k, kind: 'status', from: a.status, to: b.status }); continue }
    const as = JSON.stringify(a.body), bs = JSON.stringify(b.body)
    if (as !== bs) deltas.push({ key: k, kind: 'body', fromLen: as.length, toLen: bs.length })
  }
  console.error(`[sweep] DELTAS: ${deltas.length} / ${keys.size} compared (${ignored.length} quarantined, not compared)`)
  writeJson(OUT.replace('.json', '') + '-deltas.json', { deltas, quarantined: ignored })
  for (const d of deltas.slice(0, 40)) console.error('  ', d.kind, d.key, d.from ?? '', d.to ?? '')
  process.exit(deltas.length === 0 ? 0 : 1)
}
