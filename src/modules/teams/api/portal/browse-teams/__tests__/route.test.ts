/**
 * Filter tests for `GET /api/teams/portal/browse-teams`.
 *
 * The recruitment filters are raw SQL, and `execute()` inlines placeholders rather than binding
 * them (see `src/lib/db.ts`): a JS array renders as a comma-joined list, so `IN (?)` is right and
 * an EMPTY array renders `IN ()`, which does not parse. These tests pin both halves — that a
 * skills filter is applied at all, and that a blank/garbage one never reaches the database.
 */

const mockGetCustomerAuthFromRequest = jest.fn()
const mockCreateRequestContainer = jest.fn()
const mockRawAll = jest.fn()

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
jest.mock('@/lib/db', () => ({
  rawAll: (...args: unknown[]) => mockRawAll(...args),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require('../route') as typeof import('../route')

const TENANT = '11111111-1111-4111-8111-111111111111'
const COMPETITION = '22222222-2222-4222-8222-222222222222'
const TEAM = '33333333-3333-4333-8333-333333333333'

/** Every `(sql, params)` pair the route handed to `rawAll`, in call order. */
let queries: [string, unknown[]][]

function teamRow(over: Record<string, unknown> = {}) {
  return {
    id: TEAM,
    competition_id: COMPETITION,
    track_id: null,
    name: 'Team One',
    description: null,
    status: 'active',
    is_finalist: false,
    table_number: null,
    table_location: null,
    is_active: true,
    created_at: '2026-09-17T00:00:00.000Z',
    looking_for_members: true,
    needed_skills: [' React ', 'react', 'Postgres'],
    recruitment_note: 'We need a frontend dev.',
    ...over,
  }
}

async function browse(query: string) {
  const res = await GET(new Request(`http://localhost/api/teams/portal/browse-teams?${query}`))
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

/** The team page query is the second `rawAll` call; the first one counts. */
function teamsQuery(): [string, unknown[]] {
  return queries[1]
}

beforeEach(() => {
  jest.clearAllMocks()
  queries = []

  mockGetCustomerAuthFromRequest.mockResolvedValue({ sub: 'user-1', tenantId: TENANT, orgId: 'org-1' })
  mockCreateRequestContainer.mockResolvedValue({
    resolve: (name: string) => {
      if (name !== 'em') throw new Error(`unexpected container token: ${name}`)
      return {} // the route only forwards `em` to the mocked rawAll
    },
  })

  mockRawAll.mockImplementation(async (_em: unknown, sql: string, params: unknown[] = []) => {
    queries.push([sql, params])
    if (/COUNT\(/i.test(sql)) return [{ count: 1 }]
    if (/FROM teams_team t/i.test(sql)) return [teamRow()]
    return [] // member counts and track assignments
  })
})

describe('GET /api/teams/portal/browse-teams — recruitment', () => {
  it('requires a competition id', async () => {
    const { status } = await browse('')
    expect(status).toBe(400)
  })

  it('returns the recruitment posting, normalized', async () => {
    const { status, body } = await browse(`competition_id=${COMPETITION}`)

    expect(status).toBe(200)
    expect((body.items as Record<string, unknown>[])[0]).toMatchObject({
      looking_for_members: true,
      needed_skills: ['React', 'Postgres'],
      recruitment_note: 'We need a frontend dev.',
    })
  })

  it('leaves a row written before this shipped as a closed posting', async () => {
    mockRawAll.mockImplementation(async (_em: unknown, sql: string, params: unknown[] = []) => {
      queries.push([sql, params])
      if (/COUNT\(/i.test(sql)) return [{ count: 1 }]
      if (/FROM teams_team t/i.test(sql)) {
        return [teamRow({ looking_for_members: false, needed_skills: null, recruitment_note: null })]
      }
      return []
    })

    const { body } = await browse(`competition_id=${COMPETITION}`)

    expect((body.items as Record<string, unknown>[])[0]).toMatchObject({
      looking_for_members: false,
      needed_skills: [],
      recruitment_note: null,
    })
  })

  it('does not constrain on recruitment when no filter is asked for', async () => {
    await browse(`competition_id=${COMPETITION}`)

    const [sql] = teamsQuery()
    expect(sql).not.toMatch(/looking_for_members = true/)
    expect(sql).not.toMatch(/jsonb_array_elements_text/)
  })

  it('narrows to open postings with recruiting=true', async () => {
    await browse(`competition_id=${COMPETITION}&recruiting=true`)

    expect(teamsQuery()[0]).toMatch(/t\.looking_for_members = true/)
  })

  it('matches needed skills case-insensitively through an inlined IN list', async () => {
    await browse(`competition_id=${COMPETITION}&skills=${encodeURIComponent('React, postgres')}`)

    const [sql, params] = teamsQuery()
    expect(sql).toMatch(/jsonb_array_elements_text\(t\.needed_skills\)/)
    expect(sql).toMatch(/IN \(\?\)/)
    // Case-folded, so the stored spelling does not have to match what was typed.
    expect(params).toContainEqual(['react', 'postgres'])
  })

  it('ignores a blank skills filter rather than emitting an unparseable IN ()', async () => {
    await browse(`competition_id=${COMPETITION}&skills=${encodeURIComponent(' , ,')}`)

    const [sql, params] = teamsQuery()
    expect(sql).not.toMatch(/jsonb_array_elements_text/)
    expect(params.some((value) => Array.isArray(value) && value.length === 0)).toBe(false)
  })
})

// Keep this file a module so its top-level bindings stay file-scoped: the sibling route tests
// declare the same names, and `yarn typecheck` sees every script-scoped test at once.
export {}
