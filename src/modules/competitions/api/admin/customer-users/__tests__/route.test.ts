/**
 * Route-handler tests for `GET /api/competitions/admin/customer-users`.
 *
 * The defect these pin down: the Add Participant combobox used to call core's
 * `/api/customer_accounts/admin/users?displayName=<query>`, and that endpoint has no
 * `displayName` parameter. The filter was dropped, the newest 20 accounts came back for every
 * keystroke, and `ComboboxInput` then narrowed *that page* client-side — so an account outside
 * the newest 20 was unreachable no matter what the operator typed.
 *
 * So the assertions below are about the *query the route builds*, not just its output: a name
 * query must reach the database as an id restriction derived from the search index, and an
 * `ids=` lookup must reach it as those exact ids. A route that quietly returns "the first page"
 * for either would fail here, which is precisely the bug that shipped.
 *
 * The search tokenizer is NOT mocked — the hashes the route looks up have to be the same hashes
 * the indexer writes, and a mock would assert that against itself.
 */

const mockGetAuthFromRequest = jest.fn()
const mockCreateRequestContainer = jest.fn()
const mockResolveOrganizationScopeForRequest = jest.fn()
const mockFindWithDecryption = jest.fn()
const mockLookupHashCandidates = jest.fn()

jest.mock(
  '@open-mercato/shared/lib/auth/server',
  () => ({ getAuthFromRequest: (...args: unknown[]) => mockGetAuthFromRequest(...args) }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/shared/lib/di/container',
  () => ({ createRequestContainer: (...args: unknown[]) => mockCreateRequestContainer(...args) }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/core/modules/directory/utils/organizationScope',
  () => ({
    resolveOrganizationScopeForRequest: (...args: unknown[]) =>
      mockResolveOrganizationScopeForRequest(...args),
  }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/shared/lib/encryption/find',
  () => ({ findWithDecryption: (...args: unknown[]) => mockFindWithDecryption(...args) }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/shared/lib/encryption/aes',
  () => ({ lookupHashCandidates: (...args: unknown[]) => mockLookupHashCandidates(...args) }),
  { virtual: true },
)
// The entity module pulls in MikroORM decorators; the route only uses the class as a token.
jest.mock(
  '@open-mercato/core/modules/customer_accounts/data/entities',
  () => ({ CustomerUser: class CustomerUser {} }),
  { virtual: true },
)

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require('../route') as typeof import('../route')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { tokenizeText } = require('@open-mercato/shared/lib/search/tokenize') as {
  tokenizeText: (text: string) => { tokens: string[]; hashes: string[] }
}

const TENANT = '11111111-1111-4111-8111-111111111111'
const ORG = '22222222-2222-4222-8222-222222222222'
const STAFF = '33333333-3333-4333-8333-333333333333'

const TOMASZ = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const MACIEJ = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const NEWEST = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

type UserRow = {
  id: string
  displayName: string
  email: string
  tenantId: string
  organizationId: string
  deletedAt: Date | null
}

/** Ordered newest-first, the way the route asks the database to order them. */
const USERS: UserRow[] = [
  { id: NEWEST, displayName: 'Zoe Newest', email: 'zoe@example.com', tenantId: TENANT, organizationId: ORG, deletedAt: null },
  { id: TOMASZ, displayName: 'Tomasz Nocon', email: 'tom.nocon20@example.com', tenantId: TENANT, organizationId: ORG, deletedAt: null },
  { id: MACIEJ, displayName: 'Maciej Kowalski', email: 'maciej@example.com', tenantId: TENANT, organizationId: ORG, deletedAt: null },
]

/** What the indexer would have written to `search_tokens` for those three accounts. */
const TOKEN_INDEX: Array<{ entityId: string; hash: string }> = USERS.flatMap((user) =>
  tokenizeText(`${user.displayName} ${user.email}`).hashes.map((hash) => ({ entityId: user.id, hash })),
)

type Condition = Record<string, unknown>

function matchesCondition(row: Record<string, unknown>, where: Condition): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === '$or') {
      return (cond as Condition[]).some((branch) => matchesCondition(row, branch))
    }
    const value = row[key]
    if (cond && typeof cond === 'object' && '$in' in (cond as Condition)) {
      return ((cond as { $in: unknown[] }).$in ?? []).includes(value)
    }
    return value === cond
  })
}

let capturedWhere: Condition | null = null
let capturedOptions: Record<string, unknown> | null = null
let executedSql: Array<{ sql: string; params: unknown[] }> = []

/**
 * Stands in for Postgres for the one statement the route runs itself: the `search_tokens`
 * roll-up. Implements the `HAVING count(distinct token_hash) >= n` semantics for real, so a
 * multi-token query genuinely has to match every token.
 */
function runTokenQuery(params: unknown[]): Array<{ entity_id: string }> {
  const [, hashes, , required] = params as [string, string[], string, number]
  const perEntity = new Map<string, Set<string>>()
  for (const entry of TOKEN_INDEX) {
    if (!hashes.includes(entry.hash)) continue
    const bucket = perEntity.get(entry.entityId) ?? new Set<string>()
    bucket.add(entry.hash)
    perEntity.set(entry.entityId, bucket)
  }
  return [...perEntity.entries()]
    .filter(([, matched]) => matched.size >= required)
    .map(([entityId]) => ({ entity_id: entityId }))
}

function request(query: string): Request {
  return new Request(`http://localhost/api/competitions/admin/customer-users${query}`)
}

async function callGet(query: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await GET(request(query))
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

function itemIds(body: Record<string, unknown>): string[] {
  return (body.items as Array<{ id: string }>).map((item) => item.id)
}

beforeEach(() => {
  jest.clearAllMocks()
  capturedWhere = null
  capturedOptions = null
  executedSql = []

  process.env.OM_SEARCH_ENABLED = 'true'
  process.env.OM_SEARCH_MIN_LEN = '3'
  process.env.OM_SEARCH_ENABLE_PARTIAL = 'true'
  delete process.env.OM_SEARCH_HASH_ALGO

  mockGetAuthFromRequest.mockResolvedValue({ sub: STAFF, tenantId: TENANT, orgId: ORG })
  mockResolveOrganizationScopeForRequest.mockResolvedValue({
    selectedId: ORG,
    filterIds: [ORG],
    allowedIds: [ORG],
    tenantId: TENANT,
  })
  mockLookupHashCandidates.mockImplementation((email: string) => [`hash:${email.toLowerCase()}`])

  const em = {
    getConnection: () => ({
      execute: jest.fn(async (sql: string, params: unknown[]) => {
        executedSql.push({ sql, params })
        return runTokenQuery(params)
      }),
    }),
  }
  mockCreateRequestContainer.mockResolvedValue({
    resolve: (name: string) => {
      if (name !== 'em') throw new Error(`unexpected container token: ${name}`)
      return em
    },
  })

  mockFindWithDecryption.mockImplementation(
    async (_em: unknown, _entity: unknown, where: Condition, options: Record<string, unknown>) => {
      capturedWhere = where
      capturedOptions = options
      const matched = USERS.filter((row) => matchesCondition(row as unknown as Record<string, unknown>, where))
      const limit = typeof options?.limit === 'number' ? options.limit : matched.length
      return matched.slice(0, limit)
    },
  )
})

describe('GET /api/competitions/admin/customer-users — name search', () => {
  it('finds an account by a name prefix, even though it is not the newest row', async () => {
    const { status, body } = await callGet('?search=tom&pageSize=20')

    expect(status).toBe(200)
    expect(itemIds(body)).toEqual([TOMASZ])
  })

  it('restricts the database query to the ids the index matched, instead of paging', async () => {
    await callGet('?search=maciej')

    const or = (capturedWhere as unknown as Condition).$or as Condition[]
    expect(or).toHaveLength(1)
    expect(or[0]).toEqual({ id: { $in: [MACIEJ] } })
  })

  it('requires every token of a multi-word query to match', async () => {
    const both = await callGet('?search=tomasz%20nocon')
    expect(itemIds(both.body)).toEqual([TOMASZ])

    const mismatched = await callGet('?search=tomasz%20kowalski')
    expect(itemIds(mismatched.body)).toEqual([])
  })

  it('returns nothing — not the newest accounts — when the name matches nobody', async () => {
    const { body } = await callGet('?search=przemyslaw')

    expect(body).toEqual({ items: [] })
    // The pre-fix behaviour: an unrecognised filter fell through to "the newest page".
    expect(itemIds(body)).not.toContain(NEWEST)
  })

  it('looks an email-shaped query up by its hash, not the token index', async () => {
    const { body } = await callGet('?search=maciej%40example.com')

    expect(mockLookupHashCandidates).toHaveBeenCalledWith('maciej@example.com')
    const or = (capturedWhere as unknown as Condition).$or as Condition[]
    expect(or).toContainEqual({ emailHash: { $in: ['hash:maciej@example.com'] } })
    expect(body.items).toBeDefined()
  })

  it('scopes the token lookup to the caller tenant', async () => {
    await callGet('?search=tom')

    expect(executedSql).toHaveLength(1)
    expect(executedSql[0].sql).toContain('search_tokens')
    expect(executedSql[0].params[0]).toBe('customer_accounts:customer_user')
    expect(executedSql[0].params[2]).toBe(TENANT)
  })
})

describe('GET /api/competitions/admin/customer-users — short queries', () => {
  it('falls back to the first page rather than a blank dropdown below the token minimum', async () => {
    const { status, body } = await callGet('?search=to&pageSize=2')

    expect(status).toBe(200)
    // No index lookup is possible for a 2-character query …
    expect(executedSql).toHaveLength(0)
    expect((capturedWhere as unknown as Condition).$or).toBeUndefined()
    // … so the caller gets a page to filter client-side, capped by pageSize.
    expect(itemIds(body)).toEqual([NEWEST, TOMASZ])
  })

  it('falls back the same way when the search index is switched off', async () => {
    process.env.OM_SEARCH_ENABLED = 'false'

    const { body } = await callGet('?search=tomasz&pageSize=1')

    expect(executedSql).toHaveLength(0)
    expect(itemIds(body)).toEqual([NEWEST])
  })
})

describe('GET /api/competitions/admin/customer-users — ids lookup', () => {
  it('returns the requested account, not the most recently created one', async () => {
    const { status, body } = await callGet(`?ids=${MACIEJ}&pageSize=1`)

    expect(status).toBe(200)
    expect(itemIds(body)).toEqual([MACIEJ])
    expect((capturedWhere as unknown as Condition).id).toEqual({ $in: [MACIEJ] })
  })

  it('resolves a batch of ids without being capped by pageSize', async () => {
    const { body } = await callGet(`?ids=${TOMASZ},${MACIEJ}&pageSize=1`)

    expect(itemIds(body).sort()).toEqual([MACIEJ, TOMASZ].sort())
    expect(capturedOptions?.limit).toBe(2)
  })

  it('ignores a `search=` that arrives alongside `ids=`', async () => {
    await callGet(`?ids=${MACIEJ}&search=tom`)

    expect(executedSql).toHaveLength(0)
    expect((capturedWhere as unknown as Condition).$or).toBeUndefined()
  })

  it('treats an ids parameter with no usable id as an empty selection', async () => {
    const { body } = await callGet('?ids=not-a-uuid')

    expect(body).toEqual({ items: [] })
    expect(mockFindWithDecryption).not.toHaveBeenCalled()
  })
})

describe('GET /api/competitions/admin/customer-users — scoping', () => {
  it('always filters by tenant and by the resolved organization scope', async () => {
    await callGet('?search=tom')

    expect(capturedWhere).toMatchObject({
      tenantId: TENANT,
      deletedAt: null,
      organizationId: { $in: [ORG] },
    })
  })

  it('falls back to tenant-only scoping when the caller may read every organization', async () => {
    mockResolveOrganizationScopeForRequest.mockResolvedValue({
      selectedId: null,
      filterIds: null,
      allowedIds: null,
      tenantId: TENANT,
    })

    await callGet('?search=tom')

    expect((capturedWhere as unknown as Condition).tenantId).toBe(TENANT)
    expect((capturedWhere as unknown as Condition).organizationId).toBeUndefined()
  })

  it('answers 401 without a session, before touching the container', async () => {
    mockGetAuthFromRequest.mockResolvedValue(null)

    const res = await GET(request('?search=tom'))

    expect(res.status).toBe(401)
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })
})

// Keep this file a module so its top-level bindings stay file-scoped: sibling route tests
// declare the same names, and `yarn typecheck` sees every script-scoped test at once.
export {}
