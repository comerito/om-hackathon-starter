/**
 * Route-handler tests for issue #120 — `GET /api/competitions/portal/search-participants`.
 *
 * `competitions/lib/__tests__/participantSearch.test.ts` proves the matching and masking rules are
 * right. It cannot prove the route applies them — and the defect in #120 was entirely about the
 * route: it accepted a 2-character needle, ILIKE'd `%needle%` against the address (so a shared mail
 * domain enumerated the roster), let anyone search a competition they do not attend, and returned
 * every hit's full email address.
 *
 * These tests drive the exported `GET` with a fake container / `em` and assert on the JSON body the
 * invite form would actually receive. Each one fails when the corresponding part of the fix in
 * `../route.ts` is removed:
 *
 *  - drop the `myParticipation` check          → the 403 tests fail (the outsider gets the roster)
 *  - drop the `parseParticipantSearchQuery` gate → the short-needle test fails
 *  - return `email` instead of `maskEmail(...)` → the masking tests fail
 *  - drop the whole-name arm of `matchesParticipantNamePrefix` → the multi-word test fails
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
  '@open-mercato/shared/lib/encryption/aes',
  // The real helper returns every digest variant an address may be stored under. The fake keeps
  // the same contract — an equality-only lookup key derived from the whole address.
  () => ({ lookupHashCandidates: (email: string) => [`hash:${String(email).toLowerCase()}`] }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/core/modules/customer_accounts/data/entities',
  () => ({ CustomerUser: class CustomerUser {} }),
  { virtual: true },
)
jest.mock('../../../../data/entities', () => ({
  CompetitionParticipation: class CompetitionParticipation {},
  ParticipationRole: { PARTICIPANT: 'participant', MENTOR: 'mentor', JUDGE: 'judge' },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require('../route') as typeof import('../route')

const TENANT = '11111111-1111-4111-8111-111111111111'
const HACKATHON = '22222222-2222-4222-8222-222222222222'

const CALLER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ALPHA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const JUDGE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const OUTSIDER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

type ParticipationRow = {
  competitionId: string
  customerUserId: string
  role: string
  tenantId: string
  deletedAt: Date | null
}

type UserRow = {
  id: string
  displayName: string | null
  email: string | null
  emailHash: string
  tenantId: string
  deletedAt: Date | null
}

const PARTICIPATIONS: ParticipationRow[] = [
  { competitionId: HACKATHON, customerUserId: CALLER, role: 'participant', tenantId: TENANT, deletedAt: null },
  { competitionId: HACKATHON, customerUserId: ALPHA, role: 'participant', tenantId: TENANT, deletedAt: null },
  // A judge of the same competition: on the roster, but never invitable, so never searchable.
  { competitionId: HACKATHON, customerUserId: JUDGE, role: 'judge', tenantId: TENANT, deletedAt: null },
]

/** Everyone shares the `hackon.test` domain — that is what made the roster enumerable in #120. */
const USERS: UserRow[] = [
  {
    id: CALLER,
    displayName: 'Zoe Caller',
    email: 'zoe@hackon.test',
    emailHash: 'hash:zoe@hackon.test',
    tenantId: TENANT,
    deletedAt: null,
  },
  {
    id: ALPHA,
    displayName: 'Alpha Tester',
    email: 'alpha@hackon.test',
    emailHash: 'hash:alpha@hackon.test',
    tenantId: TENANT,
    deletedAt: null,
  },
  {
    id: JUDGE,
    displayName: 'Judy Judge',
    email: 'judy@hackon.test',
    emailHash: 'hash:judy@hackon.test',
    tenantId: TENANT,
    deletedAt: null,
  },
]

/** Minimal `$in` / equality matcher — enough for the filters this route builds. */
function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key]
    if (cond && typeof cond === 'object' && '$in' in (cond as Record<string, unknown>)) {
      return ((cond as { $in: unknown[] }).$in ?? []).includes(value)
    }
    return value === cond
  })
}

type Item = { id: string; displayName: string; maskedEmail: string }

async function search(
  q: string,
  opts: { competitionId?: string; caller?: string } = {},
): Promise<{ status: number; raw: string; body: Record<string, unknown> }> {
  if (opts.caller) {
    mockGetCustomerAuthFromRequest.mockResolvedValue({
      sub: opts.caller,
      tenantId: TENANT,
      orgId: 'org-1',
    })
  }
  const competitionId = opts.competitionId ?? HACKATHON
  const res = await GET(
    new Request(
      `http://localhost/api/competitions/portal/search-participants?competition_id=${competitionId}&q=${encodeURIComponent(q)}`,
    ),
  )
  const raw = await res.text()
  return { status: res.status, raw, body: JSON.parse(raw) as Record<string, unknown> }
}

function itemsOf(body: Record<string, unknown>): Item[] {
  return (body.items ?? []) as Item[]
}

beforeEach(() => {
  jest.clearAllMocks()

  mockGetCustomerAuthFromRequest.mockResolvedValue({ sub: CALLER, tenantId: TENANT, orgId: 'org-1' })

  const em = {
    findOne: jest.fn(async (_entity: unknown, where: Record<string, unknown>) => {
      const row = PARTICIPATIONS.find((p) => matches(p as unknown as Record<string, unknown>, where))
      return row ?? null
    }),
    find: jest.fn(async (_entity: unknown, where: Record<string, unknown>) =>
      PARTICIPATIONS.filter((p) => matches(p as unknown as Record<string, unknown>, where)),
    ),
  }
  mockCreateRequestContainer.mockResolvedValue({
    resolve: (name: string) => {
      if (name !== 'em') throw new Error(`unexpected container token: ${name}`)
      return em
    },
  })

  // Stands in for the ORM's decrypting read: honours whatever filter the route asked for.
  mockFindWithDecryption.mockImplementation(
    async (_em: unknown, _entity: unknown, where: Record<string, unknown>) =>
      USERS.filter((row) => matches(row as unknown as Record<string, unknown>, where)),
  )
})

describe('GET /api/competitions/portal/search-participants — caller must attend (#120)', () => {
  it('answers 403 with no roster in the body for a caller who is not a participant', async () => {
    const { status, raw, body } = await search('alpha', { caller: OUTSIDER })

    expect(status).toBe(403)
    expect(body).toEqual({ error: 'Not a participant in this competition' })
    expect(body.items).toBeUndefined()
    // A 403 whose body still carries the record is not a closed hole.
    expect(raw).not.toContain('Alpha Tester')
    expect(raw).not.toContain('hackon.test')
    expect(raw).not.toContain(ALPHA)
  })

  it('answers 403 for a competition the caller does not attend', async () => {
    const other = '99999999-9999-4999-8999-999999999999'
    const { status, raw } = await search('alpha', { competitionId: other })
    expect(status).toBe(403)
    expect(raw).not.toContain('Alpha Tester')
  })
})

describe('GET /api/competitions/portal/search-participants — needle length (#120)', () => {
  it.each(['a', 'al'])('refuses the %p-character needle without touching the database', async (q) => {
    const { status, body } = await search(q)
    expect(status).toBe(200)
    expect(body).toEqual({ items: [] })
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })

  it('accepts a three-character needle', async () => {
    const { body } = await search('alp')
    expect(itemsOf(body).map((i) => i.id)).toEqual([ALPHA])
  })
})

describe('GET /api/competitions/portal/search-participants — no full address leaves (#120)', () => {
  it('returns a masked address and never the deliverable one', async () => {
    const { raw, body } = await search('alp')
    const items = itemsOf(body)

    expect(items).toHaveLength(1)
    expect(items[0]).toEqual({
      id: ALPHA,
      displayName: 'Alpha Tester',
      maskedEmail: 'a***@hackon.test',
    })
    expect(items[0]).not.toHaveProperty('email')
    expect(raw).not.toContain('alpha@hackon.test')
  })

  it('discloses nothing extra on an exact-address lookup either', async () => {
    const { body, raw } = await search('ALPHA@hackon.test')
    const items = itemsOf(body)
    expect(items.map((i) => i.id)).toEqual([ALPHA])
    expect(items[0].maskedEmail).toBe('a***@hackon.test')
    expect(raw).not.toContain('alpha@hackon.test')
  })

  it('does not enumerate the roster through the shared mail domain', async () => {
    // `%hackon%` matched every attendee before the fix; a prefix match never sees a domain.
    const { body } = await search('hackon')
    expect(itemsOf(body)).toEqual([])
  })

  it('returns nothing for a half-typed address', async () => {
    const { body } = await search('alpha@hack')
    expect(itemsOf(body)).toEqual([])
  })

  it('omits a judge of the same competition — they can never be invited', async () => {
    const { body, raw } = await search('jud')
    expect(itemsOf(body)).toEqual([])
    expect(raw).not.toContain('Judy Judge')
  })
})

describe('GET /api/competitions/portal/search-participants — multi-word needle (#120)', () => {
  it('still matches a full display name once the caller presses space', async () => {
    const { body } = await search('Alpha Tester')
    expect(itemsOf(body).map((i) => i.id)).toEqual([ALPHA])
  })

  it.each(['alpha tes', 'Alpha  Tester', ' alpha tester '])(
    'matches the whole-name needle %p',
    async (q) => {
      const { body } = await search(q)
      expect(itemsOf(body).map((i) => i.id)).toEqual([ALPHA])
    },
  )

  it('still matches a later token on its own', async () => {
    const { body } = await search('tes')
    expect(itemsOf(body).map((i) => i.id)).toEqual([ALPHA])
  })
})

describe('GET /api/competitions/portal/search-participants — preconditions', () => {
  it('answers 401 without a customer session', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(null)
    const { status, body } = await search('alp')
    expect(status).toBe(401)
    expect(body).toEqual({ error: 'Authentication required' })
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })

  it('answers 400 without a competition_id', async () => {
    const res = await GET(
      new Request('http://localhost/api/competitions/portal/search-participants?q=alp'),
    )
    expect(res.status).toBe(400)
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })
})

// Keep this file a module so its top-level `GET` / mock bindings stay file-scoped: the sibling
// route tests declare the same names, and `yarn typecheck` sees every script-scoped test at once.
export {}
