/**
 * Route-handler regression tests for issue #113 — back-office scoring progress leaking across
 * competitions.
 *
 * ## Why these live at the route
 *
 * `judging/lib/__tests__/scoreQuery.test.ts` proves `buildScoreListFilter` puts `competitionId`
 * in the filter. It cannot prove the route *uses* that filter, nor that the endpoint refuses a
 * request that names no competition at all — and "no `competition_id` → the 200 most recent
 * scores of the whole tenant" is exactly what #113 reported.
 *
 * The fake `EntityManager` honours the filter it is handed instead of returning a fixed list, so
 * "no row from another competition is in the response" is a real assertion about the body the
 * back office renders, not a restatement of the helper's unit test.
 */

const mockGetAuthFromCookies = jest.fn()
const mockCreateRequestContainer = jest.fn()
const mockFindWithDecryption = jest.fn()

jest.mock(
  '@open-mercato/shared/lib/auth/server',
  () => ({ getAuthFromCookies: (...args: unknown[]) => mockGetAuthFromCookies(...args) }),
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
jest.mock('../../../data/entities', () => ({
  ProjectScore: class ProjectScore {},
  CriterionScore: class CriterionScore {},
}))
jest.mock('../../../../projects/data/entities', () => ({ Project: class Project {} }))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require('../route') as typeof import('../route')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const entities = require('../../../data/entities') as Record<string, unknown>
// eslint-disable-next-line @typescript-eslint/no-var-requires
const projectEntities = require('../../../../projects/data/entities') as { Project: unknown }

const TENANT = '00000000-0000-4000-8000-0000000000a1'
const ORG = '00000000-0000-4000-8000-0000000000b1'
const COMPETITION_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_COMPETITION_ID = '44444444-4444-4444-8444-444444444444'
const OTHER_TENANT = '00000000-0000-4000-8000-0000000000a2'

type ScoreRow = {
  id: string
  projectId: string
  judgeId: string
  judgePanelId: string
  round: string
  totalScore: number
  comment: string | null
  privateNotes: string | null
  conflictOfInterest: boolean
  isSubmitted: boolean
  submittedAt: Date | null
  competitionId: string
  tenantId: string
  organizationId: string
  createdAt: Date
  updatedAt: Date
}

function score(overrides: Partial<ScoreRow> & Pick<ScoreRow, 'id' | 'competitionId'>): ScoreRow {
  const now = new Date('2026-01-01T00:00:00.000Z')
  return {
    projectId: `project-${overrides.id}`,
    judgeId: `judge-${overrides.id}`,
    judgePanelId: `panel-${overrides.id}`,
    round: 'preliminary',
    totalScore: 80,
    comment: null,
    privateNotes: null,
    conflictOfInterest: false,
    isSubmitted: true,
    submittedAt: now,
    tenantId: TENANT,
    organizationId: ORG,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

const SCORES: ScoreRow[] = [
  score({ id: 'this-competition', competitionId: COMPETITION_ID }),
  score({ id: 'other-competition', competitionId: OTHER_COMPETITION_ID }),
  score({ id: 'other-tenant', competitionId: COMPETITION_ID, tenantId: OTHER_TENANT }),
  score({ id: 'other-org', competitionId: COMPETITION_ID, organizationId: 'org-2' }),
]

const PROJECT_TITLES: Record<string, string> = {
  'project-this-competition': 'Our Competition Project',
  'project-other-competition': 'Other Competition Secret',
  'project-other-tenant': 'Other Tenant Secret',
  'project-other-org': 'Other Org Secret',
}

type Filter = Record<string, unknown>

/** Applies the scalar equality clauses the route passes, so a widened filter widens the body. */
function matches(row: Record<string, unknown>, filter: Filter): boolean {
  return Object.entries(filter).every(([key, value]) => {
    if (value && typeof value === 'object' && '$in' in (value as Record<string, unknown>)) {
      const list = (value as { $in: unknown[] }).$in
      return list.includes(row[key])
    }
    return row[key] === value
  })
}

function makeEm() {
  const find = jest.fn(async (entity: unknown, filter: Filter): Promise<unknown[]> => {
    if (entity === entities.ProjectScore) return SCORES.filter(s => matches(s, filter))
    if (entity === entities.CriterionScore) return []
    if (entity === projectEntities.Project) {
      const ids = (filter.id as { $in?: string[] } | undefined)?.$in ?? []
      return ids.map(id => ({ id, title: PROJECT_TITLES[id] ?? null }))
    }
    return []
  })
  return { find }
}

function container(em: unknown) {
  return { resolve: (key: string) => (key === 'em' ? em : undefined) }
}

function request(query: string): Request {
  return new Request(`http://localhost/api/judging/scores${query}`)
}

type ResponseBody = {
  items: Array<{ id: string; competition_id: string; project_title: string | null }>
  total: number
  error?: string
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetAuthFromCookies.mockResolvedValue({ tenantId: TENANT, orgId: ORG })
  mockFindWithDecryption.mockResolvedValue([])
})

describe('GET /api/judging/scores — competition_id is required (#113)', () => {
  it('answers 400 without competition_id, and never reads any score', async () => {
    mockCreateRequestContainer.mockRejectedValue(new Error('container must not be resolved for invalid input'))

    const res = await GET(request(''))

    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
    expect(res.status).toBe(400)
    const body = await res.json() as ResponseBody
    expect(body.error).toBeTruthy()
    expect(body.items).toBeUndefined()
    expect(body.total).toBeUndefined()
  })

  it.each(['all', 'undefined', '12345', `${COMPETITION_ID}x`])(
    'answers 400 for a non-uuid competition_id %p',
    async (value) => {
      mockCreateRequestContainer.mockRejectedValue(new Error('container must not be resolved for invalid input'))

      const res = await GET(request(`?competition_id=${encodeURIComponent(value)}`))

      expect(mockCreateRequestContainer).not.toHaveBeenCalled()
      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toEqual({ error: 'competition_id must be a valid UUID' })
    },
  )

  it('answers 401 when the session carries no organisation', async () => {
    mockGetAuthFromCookies.mockResolvedValue({ tenantId: TENANT })
    mockCreateRequestContainer.mockRejectedValue(new Error('container must not be resolved without a session'))

    const res = await GET(request(`?competition_id=${COMPETITION_ID}`))

    expect(res.status).toBe(401)
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })
})

describe('GET /api/judging/scores — the response is scoped to one competition (#113)', () => {
  it('returns only rows of the named competition, tenant and organisation', async () => {
    const em = makeEm()
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await GET(request(`?competition_id=${COMPETITION_ID}`))

    expect(res.status).toBe(200)
    const body = await res.json() as ResponseBody
    expect(body.items.map(i => i.id)).toEqual(['this-competition'])
    expect(body.total).toBe(1)
    for (const item of body.items) expect(item.competition_id).toBe(COMPETITION_ID)
    // The body the back office renders must not carry a single foreign row.
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain('other-competition')
    expect(serialized).not.toContain(OTHER_COMPETITION_ID)
    expect(serialized).not.toContain('Other Competition Secret')
    expect(serialized).not.toContain('Other Tenant Secret')
    expect(serialized).not.toContain('Other Org Secret')
  })

  it('asks the database for the competition, tenant and organisation together', async () => {
    const em = makeEm()
    mockCreateRequestContainer.mockResolvedValue(container(em))

    await GET(request(`?competition_id=${COMPETITION_ID}`))

    const scoreCall = em.find.mock.calls.find(([entity]) => entity === entities.ProjectScore)
    expect(scoreCall).toBeDefined()
    expect(scoreCall![1]).toMatchObject({
      competitionId: COMPETITION_ID,
      tenantId: TENANT,
      organizationId: ORG,
    })
  })

  it('narrows further on the optional filters without widening the competition scope', async () => {
    const em = makeEm()
    mockCreateRequestContainer.mockResolvedValue(container(em))

    await GET(request(`?competition_id=${COMPETITION_ID}&round=final`))

    const scoreCall = em.find.mock.calls.find(([entity]) => entity === entities.ProjectScore)
    expect(scoreCall![1]).toMatchObject({ competitionId: COMPETITION_ID, round: 'final' })
  })

  it('serves the other competition its own row when that is what was asked for', async () => {
    const em = makeEm()
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await GET(request(`?competition_id=${OTHER_COMPETITION_ID}`))
    const body = await res.json() as ResponseBody

    // The positive control: the scoping is a filter, not a blanket refusal.
    expect(body.items.map(i => i.id)).toEqual(['other-competition'])
  })
})

// This file uses `require` after the `jest.mock` calls, so it has no top-level import. Without
// an export it would be a global script and its helpers would collide with the other route test
// files under type check.
export {}
