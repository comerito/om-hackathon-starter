// Write-path baseline + fixture builder.
//
// This script IS the write-path half of the golden baseline. It drives the app's
// real HTTP API in a fixed order with fixed payloads, and records every
// request/response pair. Re-running it against an empty database on a different
// framework version must produce the same normalised responses; any difference
// is an upgrade delta.
//
// Determinism rules (do not break these):
//   - no Math.random(), no Date.now(), no new Date() without an explicit literal
//   - fixed payloads, fixed order, fixed iteration counts
//   - server-generated uuids are normalised away by createNormalizer()
//
// Rate limits are real: admin login is 5/60s per email and 20/60s PER IP, and the
// customer login route has its own limiter. Portal sessions are therefore opened
// once each, reused, and paced.
//
//   node .ai/upgrade/harness/seed.mjs --out api-writes.json
//   node .ai/upgrade/harness/seed.mjs --out api-writes-verify.json --compare api-writes.json

import { call, createNormalizer, writeJson, readJson, BASE_URL } from './lib.mjs'
import { login, TENANT_ID, ORG_ID } from './auth.mjs'

const args = process.argv.slice(2)
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const OUT = argOf('--out', 'api-writes.json')
const COMPARE = argOf('--compare', null)

const log = []          // ordered record of every write
const fx = { pathParams: {}, ids: {} }  // fixture manifest for the read sweep

let step = 0
async function W(label, jar, method, path, body) {
  step++
  const res = await call(jar, method, path, body)
  const normalize = createNormalizer()
  log.push({
    step, label, method, path,
    request: normalize(body ?? null),
    status: res.status,
    response: normalize(res.body),
  })
  const flag = res.status >= 400 ? ' <-- ERROR' : ''
  console.error(`  [${String(step).padStart(3)}] ${res.status} ${method} ${path}  ${label}${flag}`)
  if (res.status >= 400) console.error(`        ${JSON.stringify(res.body).slice(0, 300)}`)
  return res
}

/** Customer logins are rate-limited per IP; pace them. */
let lastCustomerLogin = 0
async function portalLogin(email, password) {
  const gap = 1200
  const since = performance.now() - lastCustomerLogin
  if (since < gap) await new Promise((r) => setTimeout(r, gap - since))
  lastCustomerLogin = performance.now()
  const res = await fetch(`${BASE_URL}/api/customer_accounts/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, tenantId: TENANT_ID }),
    redirect: 'manual',
  })
  const { Jar } = await import('./lib.mjs')
  const jar = new Jar()
  jar.absorb(res)
  const body = await res.json().catch(() => ({}))
  if (!body.ok) throw new Error(`portal login failed ${email}: ${res.status} ${JSON.stringify(body)}`)
  return { jar, userId: body.user.id }
}

// ---------------------------------------------------------------- 0. admin
console.error('[seed] admin login')
const admin = (await login('superadmin')).jar

// The app's create commands resolve their org via
//   ctx.selectedOrganizationId ?? ctx.auth?.orgId
// and `ctx.auth.orgId` is NOT populated for superadmin command execution, so
// without this cookie every create returns 400 "Organization context is
// required". `om_selected_org` is the documented selection mechanism
// (core/modules/directory/utils/organizationScope.ts).
admin.cookies.set('om_selected_org', ORG_ID)
admin.cookies.set('om_selected_tenant', TENANT_ID)

const PW = 'Password123!'
const COMP_SLUG = 'upgrade-baseline-hack'

// ------------------------------------------------------- 1. competition
console.error('[seed] competition')
const comp = await W('create competition', admin, 'POST', '/api/competitions/competitions', {
  name: 'Upgrade Baseline Hackathon',
  slug: COMP_SLUG,
  description: 'Fixture competition for the 0.4.8 -> 0.6.7 upgrade baseline.',
  location: 'Sopot',
  starts_at: '2026-09-01T09:00:00.000Z',
  ends_at: '2026-09-03T18:00:00.000Z',
  timezone: 'Europe/Warsaw',
  min_team_size: 1,
  max_team_size: 5,
  max_tracks_per_team: 2,
  allow_track_change: true,
  project_submission_deadline: '2026-09-03T12:00:00.000Z',
  judging_deadline: '2026-09-03T16:00:00.000Z',
  code_of_conduct_url: 'https://example.com/coc',
  rules_url: 'https://example.com/rules',
  privacy_policy_url: 'https://example.com/privacy',
  peer_voting_config: { enabled: true, votesPerPerson: 3, allowVoteChange: false },
  judging_config: { rounds: 1, preliminaryJudgesPerProject: 2, finalistsPerTrack: 2 },
})
const COMP_ID = comp.body?.id
if (!COMP_ID) throw new Error('competition not created; cannot continue')
fx.ids.competitionId = COMP_ID

// ------------------------------------------------------------ 2. tracks
console.error('[seed] tracks')
const TRACKS = []
for (const t of [
  { name: 'AI & Agents', color: '#6366f1', order: 1 },
  { name: 'Developer Tools', color: '#10b981', order: 2 },
  { name: 'Open Track', color: '#f59e0b', order: 3 },
]) {
  const r = await W(`create track ${t.name}`, admin, 'POST', '/api/tracks/tracks', {
    competition_id: COMP_ID,
    name: t.name,
    short_description: `${t.name} short description`,
    description: `Longer description for ${t.name}.`,
    color: t.color,
    order: t.order,
    max_teams: 10,
  })
  if (r.body?.id) TRACKS.push(r.body.id)
}
fx.ids.trackIds = TRACKS
fx.pathParams.trackId = TRACKS[0]

// ---------------------------------------------- 3. customer users
console.error('[seed] customer users')
const PEOPLE = [
  { key: 'dana', email: 'dana.upgrade@example.com', displayName: 'Dana Upgrade', role: 'participant' },
  { key: 'evan', email: 'evan.upgrade@example.com', displayName: 'Evan Upgrade', role: 'participant' },
  { key: 'fiona', email: 'fiona.upgrade@example.com', displayName: 'Fiona Upgrade', role: 'participant' },
  { key: 'gil', email: 'gil.upgrade@example.com', displayName: 'Gil Upgrade', role: 'participant' },
  { key: 'judy', email: 'judy.judge@example.com', displayName: 'Judy Judge', role: 'judge' },
  { key: 'jorge', email: 'jorge.judge@example.com', displayName: 'Jorge Judge', role: 'judge' },
  { key: 'mona', email: 'mona.mentor@example.com', displayName: 'Mona Mentor', role: 'mentor' },
]
// Customer PORTAL roles are what grant `portal.*` features. `POST
// /api/customer_accounts/admin/users` only assigns roles when `roleIds` is passed
// explicitly — it does NOT fall back to the role marked `is_default` (see
// core/modules/customer_accounts/api/admin/users.ts:249). Without this, seeded users
// get ZERO features and every portal page renders "access denied", even though their
// CompetitionParticipation says `participant`. Those are two different notions of
// "role" and only the customer role drives portal authorization.
const roleRes = await call(admin, 'GET', '/api/customer_accounts/admin/roles?pageSize=100')
const roleBySlug = new Map(
  (roleRes.body?.items ?? roleRes.body?.data ?? []).map((r) => [r.slug, r.id]),
)
console.error(`  [---] customer roles: ${[...roleBySlug.keys()].join(', ') || 'NONE FOUND'}`)

const USERS = {}
for (const p of PEOPLE) {
  const roleId = roleBySlug.get(p.role)
  const r = await W(`create user ${p.key}`, admin, 'POST', '/api/customer_accounts/admin/users', {
    email: p.email, password: PW, displayName: p.displayName,
    ...(roleId ? { roleIds: [roleId] } : {}),
  })
  if (r.body?.user?.id) USERS[p.key] = { id: r.body.user.id, ...p }
}
// the three users seeded by `mercato init` join as participants too
const PRESEEDED = {
  alice: { id: null, email: 'alice.johnson@example.com', role: 'participant' },
  bob: { id: null, email: 'bob.smith@example.com', role: 'participant' },
  carol: { id: null, email: 'carol.white@example.com', role: 'participant' },
}
{
  const r = await call(admin, 'GET', '/api/customer_accounts/admin/users?pageSize=100')
  const items = r.body?.items ?? r.body?.data ?? []
  for (const k of Object.keys(PRESEEDED)) {
    const hit = items.find((u) => u.email === PRESEEDED[k].email)
    if (hit) PRESEEDED[k].id = hit.id
  }
  console.error(`  [---] resolved preseeded users: ${Object.entries(PRESEEDED).map(([k, v]) => k + '=' + (v.id ? 'ok' : 'MISSING')).join(' ')}`)
}
const ALL = { ...USERS }
for (const [k, v] of Object.entries(PRESEEDED)) if (v.id) ALL[k] = { id: v.id, ...v, key: k }
fx.ids.userIds = Object.fromEntries(Object.entries(ALL).map(([k, v]) => [k, v.id]))

// ------------------------------------------------- 4. participations
console.error('[seed] participations')
const PARTICIPATION = {}
for (const [key, u] of Object.entries(ALL)) {
  const r = await W(`participation ${key}`, admin, 'POST', '/api/competitions/participations', {
    competition_id: COMP_ID,
    customer_user_id: u.id,
    role: u.role || 'participant',
  })
  if (r.body?.id) PARTICIPATION[key] = r.body.id
}
fx.ids.participationIds = PARTICIPATION

// mark two people as looking for a team -> populates the looking-for-team knex route
for (const key of ['gil', 'carol']) {
  if (!PARTICIPATION[key]) continue
  await W(`participation ${key} looking-for-team`, admin, 'PUT', '/api/competitions/participations', {
    id: PARTICIPATION[key],
    looking_for_team: true,
    looking_for_team_description: `${key} is looking for a team.`,
  })
}
// check one participant in -> populates checked_in paths
if (PARTICIPATION.dana) {
  await W('checkin dana', admin, 'POST', '/api/competitions/checkin', { participation_id: PARTICIPATION.dana })
}

// -------------------------------------------------------- 5. teams
console.error('[seed] teams')
const TEAMS = []
for (const t of [
  { name: 'Team Alpha', tracks: [TRACKS[0]], owner: 'dana', members: ['evan'] },
  { name: 'Team Beta', tracks: [TRACKS[1], TRACKS[2]], owner: 'fiona', members: ['alice'] },
  { name: 'Team Gamma', tracks: [TRACKS[0]], owner: 'bob', members: [] },
]) {
  const r = await W(`create team ${t.name}`, admin, 'POST', '/api/teams/teams', {
    competition_id: COMP_ID,
    name: t.name,
    description: `${t.name} description`,
    track_ids: t.tracks.filter(Boolean),
  })
  if (r.body?.id) TEAMS.push({ id: r.body.id, ...t })
}
fx.ids.teamIds = TEAMS.map((t) => t.id)

console.error('[seed] team members')
for (const t of TEAMS) {
  if (ALL[t.owner]) {
    await W(`member owner ${t.owner}@${t.name}`, admin, 'POST', '/api/teams/members', {
      team_id: t.id, customer_user_id: ALL[t.owner].id, competition_id: COMP_ID, role: 'owner',
    })
  }
  for (const m of t.members) {
    if (!ALL[m]) continue
    await W(`member ${m}@${t.name}`, admin, 'POST', '/api/teams/members', {
      team_id: t.id, customer_user_id: ALL[m].id, competition_id: COMP_ID, role: 'member',
    })
  }
}

// A team invitation fires notify-team-invitation / notify-member-joined, the two
// SUBSCRIBERS that use getKnex(). Nothing else in the baseline exercises them.
if (TEAMS[0] && ALL.gil) {
  await W('team invitation (exercises getKnex subscribers)', admin, 'POST', '/api/teams/invitations', {
    team_id: TEAMS[0].id,
    invitee_id: ALL.gil.id,
    competition_id: COMP_ID,
    expires_at: '2026-09-02T12:00:00.000Z',
    type: 'invite',
    message: 'Join Team Alpha',
  })
}

// ------------------------------------------------------ 6. projects
console.error('[seed] projects')
const PROJECTS = []
for (const [i, t] of TEAMS.entries()) {
  const r = await W(`project for ${t.name}`, admin, 'POST', '/api/projects/projects', {
    team_id: t.id,
    competition_id: COMP_ID,
    track_id: t.tracks[0],
    title: `${t.name} Project`,
    tagline: `A tagline for ${t.name}`,
    description: `Description of the ${t.name} project.`,
    problem_statement: 'The problem being solved.',
    solution: 'The proposed solution.',
    tech_stack: ['typescript', 'postgres', i % 2 === 0 ? 'react' : 'node'],
    demo_url: 'https://example.com/demo',
    repo_url: 'https://example.com/repo',
    uses_preexisting_code: false,
  })
  if (r.body?.id) PROJECTS.push({ id: r.body.id, team: t })
}
fx.ids.projectIds = PROJECTS.map((p) => p.id)
fx.pathParams.projectId = PROJECTS[0]?.id

// --------------------------------------------- 7. judging criteria
console.error('[seed] judging criteria')
const CRITERIA = []
for (const c of [
  { name: 'Innovation', weight: 0.3, max_score: 10, order: 1 },
  { name: 'Execution', weight: 0.3, max_score: 10, order: 2 },
  { name: 'Impact', weight: 0.25, max_score: 10, order: 3 },
  { name: 'Presentation', weight: 0.15, max_score: 5, order: 4 },
]) {
  const r = await W(`criterion ${c.name}`, admin, 'POST', '/api/judging/criteria', {
    competition_id: COMP_ID, name: c.name, weight: c.weight,
    description: `${c.name} criterion`, max_score: c.max_score, order: c.order, round: 'both',
  })
  if (r.body?.id) CRITERIA.push({ id: r.body.id, ...c })
}
fx.ids.criterionIds = CRITERIA.map((c) => c.id)

// ------------------------------------------------ 8. panel + members
console.error('[seed] judging panel')
const panel = await W('create panel', admin, 'POST', '/api/judging/panels', {
  competition_id: COMP_ID, name: 'Preliminary Panel', round: 'preliminary',
})
const PANEL_ID = panel.body?.id
fx.ids.panelId = PANEL_ID
if (PANEL_ID) {
  for (const k of ['judy', 'jorge']) {
    if (!ALL[k]) continue
    await W(`panel judge ${k}`, admin, 'POST', '/api/judging/panel-members', {
      panel_id: PANEL_ID, type: 'judge', judge_id: ALL[k].id,
    })
  }
  for (const tid of TRACKS) {
    await W('panel track', admin, 'POST', '/api/judging/panel-members', {
      panel_id: PANEL_ID, type: 'track', track_id: tid,
    })
  }
}

// ------------------------------------------- 9. scores (judge portal)
console.error('[seed] scores (portal sessions)')
for (const jk of ['judy', 'jorge']) {
  if (!ALL[jk]) continue
  const sess = await portalLogin(ALL[jk].email, PW)
  for (const [pi, p] of PROJECTS.entries()) {
    await W(`score ${jk} -> project#${pi}`, sess.jar, 'POST', '/api/judging/portal/score-project', {
      project_id: p.id,
      judge_panel_id: 'auto',
      competition_id: COMP_ID,
      round: 'preliminary',
      criterion_scores: CRITERIA.map((c, ci) => ({
        criterion_id: c.id,
        // deterministic, varied scores
        score: ((pi * 3 + ci * 2 + (jk === 'judy' ? 1 : 2)) % c.max_score) + 1,
        note: `${jk} note on ${c.name}`,
      })),
      comment: `${jk} overall comment on project ${pi}`,
      private_notes: `${jk} private notes`,
      conflict_of_interest: false,
      is_submitted: true,
    })
  }
}

// ------------------------------------------------ 10. sponsors + prizes
console.error('[seed] sponsors + prizes')
const SPONSORS = []
for (const s of [
  { name: 'Acme Cloud', tier: 'gold', order: 1 },
  { name: 'Globex Tools', tier: 'partner', order: 2 },
]) {
  const r = await W(`sponsor ${s.name}`, admin, 'POST', '/api/sponsors/sponsors', {
    competition_id: COMP_ID, name: s.name, tier: s.tier,
    logo_url: 'https://example.com/logo.png',
    website_url: 'https://example.com',
    description: `${s.name} description`,
    challenge_title: `${s.name} Challenge`,
    challenge_description: 'Build something great.',
    contact_name: 'Contact Person', contact_email: 'contact@example.com',
    order: s.order, is_visible: true,
  })
  if (r.body?.id) SPONSORS.push(r.body.id)
}
fx.ids.sponsorIds = SPONSORS
for (const [i, p] of [
  { name: 'Best Overall', category: 'special_award', rank: 1 },
  { name: 'Best AI Project', category: 'track_placement', rank: 1, track: 0 },
  { name: "People's Choice", category: 'peoples_choice', rank: 1 },
].entries()) {
  await W(`prize ${p.name}`, admin, 'POST', '/api/sponsors/prizes', {
    competition_id: COMP_ID, name: p.name,
    description: `${p.name} description`,
    category: p.category,
    track_id: p.track !== undefined ? TRACKS[p.track] : null,
    sponsor_id: SPONSORS[i % Math.max(SPONSORS.length, 1)] ?? null,
    value: '1000 EUR', rank: p.rank, order: i,
  })
}

// ------------------------------------- 11. peer votes (portal sessions)
console.error('[seed] peer votes (portal sessions)')
// voters must be role=participant and must not vote for their own team
for (const [voterKey, projIdx] of [['dana', 1], ['evan', 2], ['fiona', 0]]) {
  if (!ALL[voterKey] || !PROJECTS[projIdx]) continue
  const sess = await portalLogin(ALL[voterKey].email, PW)
  await W(`vote ${voterKey} -> project#${projIdx}`, sess.jar, 'POST', '/api/sponsors/portal/cast-vote', {
    competition_id: COMP_ID, project_id: PROJECTS[projIdx].id,
  })
}

// ---------------------------------------------------- 12. incidents
console.error('[seed] incidents')
for (const inc of [
  { severity: 'low', description: 'Minor wifi issue in room 2.', anonymous: false },
  { severity: 'high', description: 'Reported code of conduct violation.', anonymous: true },
]) {
  await W(`incident ${inc.severity}`, admin, 'POST', '/api/incidents/incidents', {
    competition_id: COMP_ID, description: inc.description,
    severity: inc.severity, anonymous: inc.anonymous,
  })
}

// -------------------------------------------- 13. chat (both directions)
console.error('[seed] chat (portal sessions)')
if (ALL.dana && ALL.evan) {
  const danaSess = await portalLogin(ALL.dana.email, PW)
  const first = await W('chat dana -> evan', danaSess.jar, 'POST', '/api/competitions/portal/chat', {
    competition_id: COMP_ID, recipient_id: ALL.evan.id, body: 'Hey Evan, want to pair on the API?',
  })
  // response shape is { ok, message: { id, threadId, body, sentAt } }
  const threadId = first.body?.message?.threadId ?? first.body?.message?.thread_id
    ?? first.body?.thread_id ?? first.body?.threadId
  if (threadId) {
    fx.pathParams.threadId = threadId
    fx.ids.threadId = threadId
    const evanSess = await portalLogin(ALL.evan.email, PW)
    await W('chat evan -> dana (reply)', evanSess.jar, 'POST', '/api/competitions/portal/chat', {
      competition_id: COMP_ID, recipient_id: ALL.dana.id, thread_id: threadId,
      body: 'Yes! I am on the frontend now.',
    })
    await W('chat dana -> evan (2)', danaSess.jar, 'POST', '/api/competitions/portal/chat', {
      competition_id: COMP_ID, recipient_id: ALL.evan.id, thread_id: threadId,
      body: 'Great, pushing the schema shortly.',
    })
    // leave the thread UNREAD for dana so unread-count returns non-zero
  } else {
    console.error('  [!!] chat thread id not found in response; unread-count coverage will be weak')
  }
}

// ------------------------------------------------- 14. invitations
// Populates competitions_invitation / customer_user_invitations, which back the
// two HARD knex admin routes (invitations, participant-invitations). The email
// send will fail (no RESEND_API_KEY) but the rows are still written.
console.error('[seed] bulk invite (rows only; email send is expected to fail)')
await W('bulk invite', admin, 'POST', '/api/competitions/admin/bulk-invite', {
  competition_id: COMP_ID,
  org_slug: 'acme-corp',
  invitees: [
    { email: 'invitee.one@example.com', display_name: 'Invitee One', role: 'participant' },
    { email: 'invitee.two@example.com', display_name: 'Invitee Two', role: 'mentor' },
  ],
})

// -------------------------------------------------------- finalise
fx.pathParams.id = COMP_ID   // generic {id} fallback for the read sweep

const errors = log.filter((l) => l.status >= 400)
console.error(`\n[seed] ${log.length} writes, ${errors.length} with status >= 400`)
for (const e of errors) console.error(`  ERROR ${e.status} ${e.method} ${e.path} (${e.label})`)

writeJson('fixtures.json', fx)
writeJson(OUT, { meta: { writes: log.length, errors: errors.length }, log })
console.error(`[seed] wrote ${OUT} and fixtures.json`)

if (COMPARE) {
  const prev = readJson(COMPARE)
  if (!prev) { console.error(`[seed] cannot compare: ${COMPARE} missing`); process.exit(2) }
  const deltas = []
  const n = Math.max(prev.log.length, log.length)
  for (let i = 0; i < n; i++) {
    const a = prev.log[i], b = log[i]
    if (!a || !b) { deltas.push({ step: i + 1, kind: a ? 'removed' : 'added', label: (a || b).label }); continue }
    if (a.label !== b.label) { deltas.push({ step: i + 1, kind: 'reordered', from: a.label, to: b.label }); continue }
    if (a.status !== b.status) { deltas.push({ step: i + 1, kind: 'status', label: a.label, from: a.status, to: b.status }); continue }
    if (JSON.stringify(a.response) !== JSON.stringify(b.response)) {
      deltas.push({ step: i + 1, kind: 'response', label: a.label })
    }
  }
  console.error(`[seed] DELTAS: ${deltas.length} / ${n}`)
  writeJson(OUT.replace('.json', '') + '-deltas.json', deltas)
  for (const d of deltas.slice(0, 40)) console.error('  ', d.kind, `#${d.step}`, d.label || '', d.from ?? '', d.to ?? '')
  process.exit(deltas.length === 0 ? 0 : 1)
}
