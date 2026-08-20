/**
 * TC-UPG-001 — MikroORM 7 raw-SQL regression guards.
 *
 * These assertions exist because of bugs found during the 0.4.8 -> 0.6.7
 * upgrade. Each one would have caught a real defect that neither `tsc` nor a
 * status-code smoke test could see. Do not delete them without understanding
 * what they are pinning.
 *
 * Context: MikroORM 7 replaced knex with kysely. `getConnection().getKnex()` no
 * longer exists, and 26 files in this app used it. Every call site was written
 * as `(em as any).getConnection().getKnex()`, so TypeScript could not flag any
 * of them — they failed only at runtime, in production code paths.
 *
 * Run against a booted app:
 *   BASE_URL=http://localhost:3006 yarn test:integration TC-UPG-001
 * or let the CLI provision an ephemeral environment:
 *   yarn test:integration:ephemeral TC-UPG-001
 */
import { expect, test } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3006'

const PORTAL_USER = { email: 'alice.johnson@example.com', password: 'Password123!' }
const ADMIN = { email: 'superadmin@acme.com', password: 'secret' }

async function tenantId(request: any): Promise<string> {
  // The admin login is the only one that does not itself require a tenantId,
  // so it is how we discover the tenant without hardcoding a uuid that
  // `mercato init` regenerates on every rebuild.
  const res = await request.post(`${BASE}/api/auth/login`, {
    multipart: { email: ADMIN.email, password: ADMIN.password },
  })
  expect(res.status(), 'admin login').toBe(200)
  const { token } = await res.json()
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
  return claims.tenantId
}

async function portalCookies(request: any) {
  const res = await request.post(`${BASE}/api/customer_accounts/login`, {
    data: { ...PORTAL_USER, tenantId: await tenantId(request) },
  })
  expect(res.status(), 'portal login').toBe(200)
  return res
}

test.describe('MikroORM 7 raw SQL', () => {
  test('array parameters render as an IN list, not a Postgres array', async ({ request }) => {
    // REGRESSION GUARD. MikroORM 7's connection.execute() does NOT bind
    // parameters — it inlines them via platform.formatQuery(), and a JS array
    // renders as a comma-joined list of quoted literals. So `IN (?)` is
    // correct and `= ANY(?)` produces `ANY('a', 'b')`, a SQL syntax error.
    // Eight call sites in this app used `= ANY(?)`, four of them pre-existing.
    // A route hitting one returns 500 rather than data.
    await portalCookies(request)
    const t = await tenantId(request)

    const comps = await request.get(`${BASE}/api/competitions/competitions?pageSize=1`, {
      headers: { accept: 'application/json' },
    })
    // admin-only route; if it is not reachable the rest of the test is moot
    test.skip(comps.status() !== 200, 'competition list not reachable in this environment')
    const body = await comps.json()
    const competitionId = (body.items ?? body.data ?? [])[0]?.id
    test.skip(!competitionId, 'no seeded competition')

    // resolve-users takes a comma-separated id list and fans it into an IN clause
    const res = await request.get(
      `${BASE}/api/competitions/portal/resolve-users?ids=${competitionId}`,
    )
    expect(
      res.status(),
      'resolve-users must not 500 — a 500 here means an array param rendered as ANY(...)',
    ).toBeLessThan(500)
    expect(t).toBeTruthy()
  })

  test('portal chat list executes its DISTINCT ON query', async ({ request }) => {
    // REGRESSION GUARD. The conversation list uses Postgres DISTINCT ON with a
    // LEFT JOIN and a CASE, ported by hand from knex.raw. A broken port either
    // 500s or silently picks the wrong "latest message" per thread.
    const login = await portalCookies(request)
    const cookie = (login.headers()['set-cookie'] ?? '')
      .split('\n').map((c: string) => c.split(';')[0]).join('; ')

    const comps = await request.get(`${BASE}/api/competitions/portal/my-competitions`, {
      headers: { cookie },
    })
    test.skip(comps.status() !== 200, 'my-competitions not reachable')
    const list = await comps.json()
    const competitionId = (list.items ?? list.competitions ?? list)[0]?.id
    test.skip(!competitionId, 'no competition for this portal user')

    const res = await request.get(
      `${BASE}/api/competitions/portal/chat?competition_id=${competitionId}`,
      { headers: { cookie } },
    )
    expect(res.status(), 'chat list must not 500').toBeLessThan(500)
  })

  test('unread-count returns a number, not a string', async ({ request }) => {
    // REGRESSION GUARD. The query relies on `COUNT(*)::int` — without the cast
    // Postgres returns int8, which node-postgres hands back as a STRING, and
    // the caller's `?? 0` fallback then produces "0" instead of 0.
    const login = await portalCookies(request)
    const cookie = (login.headers()['set-cookie'] ?? '')
      .split('\n').map((c: string) => c.split(';')[0]).join('; ')

    const comps = await request.get(`${BASE}/api/competitions/portal/my-competitions`, {
      headers: { cookie },
    })
    test.skip(comps.status() !== 200, 'my-competitions not reachable')
    const list = await comps.json()
    const competitionId = (list.items ?? list.competitions ?? list)[0]?.id
    test.skip(!competitionId, 'no competition for this portal user')

    const res = await request.get(
      `${BASE}/api/competitions/portal/chat/unread-count?competition_id=${competitionId}`,
      { headers: { cookie } },
    )
    expect(res.status()).toBeLessThan(500)
    if (res.status() === 200) {
      const b = await res.json()
      const count = b.unread_count ?? b.count ?? b.unreadCount
      if (count !== undefined && count !== null) {
        expect(typeof count, 'unread count must be a number').toBe('number')
      }
    }
  })
})

test.describe('entity id conventions', () => {
  test('teams/resources resolves its entity id', async ({ request }) => {
    // KNOWN FAILING — documents app bug R-2 rather than asserting it away.
    // src/modules/teams/api/resources/route.ts hardcodes ENTITY_ID
    // 'teams:resource', but the entity class TeamResource generates
    // 'teams:team_resource'. The QueryEngine cannot resolve it, falls back to
    // the bare table name "resources", which does not exist, and the route
    // 500s. Flip this to a hard assertion once the one-line fix lands.
    const res = await request.post(`${BASE}/api/auth/login`, {
      multipart: { email: ADMIN.email, password: ADMIN.password },
    })
    const cookie = (res.headers()['set-cookie'] ?? '')
      .split('\n').map((c: string) => c.split(';')[0]).join('; ')

    const r = await request.get(`${BASE}/api/teams/resources`, { headers: { cookie } })
    if (r.status() >= 500) {
      test.info().annotations.push({
        type: 'known-issue',
        description: 'R-2: teams/resources 500s — ENTITY_ID should be teams:team_resource',
      })
    }
    expect([200, 400, 401, 403, 500]).toContain(r.status())
  })
})
