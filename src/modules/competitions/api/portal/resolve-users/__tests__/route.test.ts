/**
 * Route-handler tests for issue #119 — `GET /api/competitions/portal/resolve-users`.
 *
 * The helper tests in `competitions/lib/__tests__/portalUserVisibility.test.ts` prove that
 * `selectVisibleUserIds` filters correctly. They prove nothing about the route: the whole defect
 * in #119 was that the *route* asked the database for every requested id in the tenant and handed
 * back each one's email address. A helper can be perfect and never be called.
 *
 * So these tests drive the exported `GET` itself, with a fake container / `em` standing in for the
 * database, and assert on the JSON body a client would actually receive:
 *
 *  - a user the caller shares no competition with is ABSENT from `users`
 *  - no resolved user carries an `email` key at all
 *
 * Reverting either half of the fix in `../route.ts` (dropping the competition scoping, or putting
 * `email` back on the response objects) makes these fail.
 *
 * Note this endpoint has no caller anywhere in `src/` — it is reachable only by direct HTTP, which
 * is exactly why nothing else would ever have caught the regression.
 */

const mockGetCustomerAuthFromRequest = jest.fn()
const mockCreateRequestContainer = jest.fn()
const mockFindWithDecryption = jest.fn()

jest.mock(
  '@open-mercato/core/modules/customer_accounts/lib/customerAuth',
  () => ({
    getCustomerAuthFromRequest: (...args: unknown[]) => mockGetCustomerAuthFromRequest(...args),
  }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/shared/lib/di/container',
  () => ({ createRequestContainer: (...args: unknown[]) => mockCreateRequestContainer(...args) }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/shared/lib/encryption/find',
  () => ({ findWithDecryption: (...args: unknown[]) => mockFindWithDecryption(...args) }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/core/modules/customer_accounts/data/entities',
  () => ({ CustomerUser: class CustomerUser {} }),
  { virtual: true },
)
// The entity module pulls in MikroORM decorators; the route only ever uses the class as a token.
jest.mock('../../../../data/entities', () => ({
  CompetitionParticipation: class CompetitionParticipation {},
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require('../route') as typeof import('../route')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CompetitionParticipation } = require('../../../../data/entities') as {
  CompetitionParticipation: unknown
}

const TENANT = '11111111-1111-4111-8111-111111111111'
const HACKATHON = '22222222-2222-4222-8222-222222222222'
const OTHER_EVENT = '33333333-3333-4333-8333-333333333333'

const CALLER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TEAMMATE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const STRANGER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

type ParticipationRow = {
  competitionId: string
  customerUserId: string
  tenantId: string
  deletedAt: Date | null
}

type UserRow = {
  id: string
  displayName: string | null
  email: string | null
  tenantId: string
  deletedAt: Date | null
}

/** Everyone in the tenant. `STRANGER` is in a different competition from `CALLER`. */
const PARTICIPATIONS: ParticipationRow[] = [
  { competitionId: HACKATHON, customerUserId: CALLER, tenantId: TENANT, deletedAt: null },
  { competitionId: HACKATHON, customerUserId: TEAMMATE, tenantId: TENANT, deletedAt: null },
  { competitionId: OTHER_EVENT, customerUserId: STRANGER, tenantId: TENANT, deletedAt: null },
]

const USERS: UserRow[] = [
  { id: CALLER, displayName: 'Ada Caller', email: 'ada@example.com', tenantId: TENANT, deletedAt: null },
  { id: TEAMMATE, displayName: 'Bo Teammate', email: 'bo@example.com', tenantId: TENANT, deletedAt: null },
  { id: STRANGER, displayName: 'Cy Stranger', email: 'cy@example.com', tenantId: TENANT, deletedAt: null },
]

/** Minimal `$in` / equality matcher — enough for the two filters this route builds. */
function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key]
    if (cond && typeof cond === 'object' && '$in' in (cond as Record<string, unknown>)) {
      return ((cond as { $in: unknown[] }).$in ?? []).includes(value)
    }
    return value === cond
  })
}

function request(ids: string[]): Request {
  const qs = ids.length ? `?ids=${encodeURIComponent(ids.join(','))}` : ''
  return new Request(`http://localhost/api/competitions/portal/resolve-users${qs}`)
}

async function callGet(ids: string[]): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await GET(request(ids))
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

let participationQueries: Record<string, unknown>[] = []

beforeEach(() => {
  jest.clearAllMocks()
  participationQueries = []

  mockGetCustomerAuthFromRequest.mockResolvedValue({
    sub: CALLER,
    tenantId: TENANT,
    orgId: 'org-1',
  })

  const em = {
    find: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity !== CompetitionParticipation) throw new Error('unexpected entity in em.find')
      participationQueries.push(where)
      return PARTICIPATIONS.filter((row) => matches(row as unknown as Record<string, unknown>, where))
    }),
  }
  mockCreateRequestContainer.mockResolvedValue({
    resolve: (name: string) => {
      if (name !== 'em') throw new Error(`unexpected container token: ${name}`)
      return em
    },
  })

  // Stands in for the ORM's decrypting read: honours the `id IN (...)` the route asked for.
  mockFindWithDecryption.mockImplementation(
    async (_em: unknown, _entity: unknown, where: Record<string, unknown>) =>
      USERS.filter((row) => matches(row as unknown as Record<string, unknown>, where)),
  )
})

describe('GET /api/competitions/portal/resolve-users — competition scoping (#119)', () => {
  it('omits a user the caller shares no competition with', async () => {
    const { status, body } = await callGet([CALLER, TEAMMATE, STRANGER])

    expect(status).toBe(200)
    const users = body.users as Record<string, { displayName: string }>
    expect(Object.keys(users).sort()).toEqual([CALLER, TEAMMATE].sort())
    expect(users[STRANGER]).toBeUndefined()
    // The stranger must not appear anywhere in the serialised body, under any key.
    expect(JSON.stringify(body)).not.toContain(STRANGER)
    expect(JSON.stringify(body)).not.toContain('Cy Stranger')
  })

  it('returns an empty map when the only requested id is out of scope', async () => {
    const { status, body } = await callGet([STRANGER])
    expect(status).toBe(200)
    expect(body).toEqual({ users: {} })
  })

  it('returns an empty map for a caller who participates in nothing', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue({
      sub: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      tenantId: TENANT,
      orgId: 'org-1',
    })
    const { status, body } = await callGet([CALLER, TEAMMATE, STRANGER])
    expect(status).toBe(200)
    expect(body).toEqual({ users: {} })
  })

  it('still resolves the caller themself and a competition-mate', async () => {
    const { body } = await callGet([CALLER, TEAMMATE])
    const users = body.users as Record<string, { displayName: string }>
    expect(users[CALLER].displayName).toBe('Ada Caller')
    expect(users[TEAMMATE].displayName).toBe('Bo Teammate')
  })

  it('narrows the candidate query by the caller competitions, not just the tenant', async () => {
    await callGet([CALLER, TEAMMATE, STRANGER])
    // Second query = the candidate lookup. It must carry a competition predicate.
    expect(participationQueries.length).toBeGreaterThanOrEqual(2)
    const candidateQuery = participationQueries[1]
    expect(candidateQuery.competitionId).toEqual({ $in: [HACKATHON] })
  })
})

describe('GET /api/competitions/portal/resolve-users — no email in the response (#119)', () => {
  it('carries no email key for anyone, and no address anywhere in the body', async () => {
    const { body } = await callGet([CALLER, TEAMMATE])
    const users = body.users as Record<string, Record<string, unknown>>

    expect(Object.keys(users).length).toBeGreaterThan(0)
    for (const entry of Object.values(users)) {
      expect(Object.keys(entry)).toEqual(['displayName'])
      expect(entry).not.toHaveProperty('email')
    }
    expect(JSON.stringify(body)).not.toContain('@example.com')
  })

  it('falls back to the local part only — never the domain — when a display name is missing', async () => {
    mockFindWithDecryption.mockResolvedValue([
      { id: CALLER, displayName: null, email: 'ada@example.com' },
    ])
    const { body } = await callGet([CALLER])
    const users = body.users as Record<string, { displayName: string }>
    expect(users[CALLER].displayName).toBe('ada')
    expect(JSON.stringify(body)).not.toContain('example.com')
  })
})

describe('GET /api/competitions/portal/resolve-users — preconditions', () => {
  it('answers 401 without a customer session, before touching the container', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(null)
    const res = await GET(request([CALLER]))
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })

  it('answers an empty map for a blank ids parameter without touching the container', async () => {
    const { status, body } = await callGet([])
    expect(status).toBe(200)
    expect(body).toEqual({ users: {} })
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })
})

// Keep this file a module so its top-level `GET` / mock bindings stay file-scoped: the sibling
// route tests declare the same names, and `yarn typecheck` sees every script-scoped test at once.
export {}
