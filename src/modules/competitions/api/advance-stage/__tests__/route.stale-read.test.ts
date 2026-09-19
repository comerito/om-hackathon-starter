/**
 * Route-handler tests for `POST /api/competitions/advance-stage`, stale-read path.
 *
 * The back-office edit page reads the competition's stage from the cached CRUD list GET.
 * Once that cached row falls behind the real stage, the page offers a transition the
 * competition has already made — and the route's "target must be later" guard returned
 * before the success path's cache invalidation, so nothing ever evicted the stale entry
 * (production writes cache entries with no TTL). Every retry failed identically and the
 * organiser was stuck. These tests pin the two halves of the escape hatch: the guard now
 * flushes the cached row, and it hands the caller the real stage so the page can recover.
 */

const mockGetAuthFromCookies = jest.fn()
const mockCreateRequestContainer = jest.fn()
const mockInvalidateCrudCache = jest.fn()
const mockEmitCrudSideEffects = jest.fn()

jest.mock(
  '@open-mercato/shared/lib/di/container',
  () => ({ createRequestContainer: (...args: unknown[]) => mockCreateRequestContainer(...args) }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/shared/lib/auth/server',
  () => ({ getAuthFromCookies: (...args: unknown[]) => mockGetAuthFromCookies(...args) }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/shared/lib/crud/cache',
  () => ({ invalidateCrudCache: (...args: unknown[]) => mockInvalidateCrudCache(...args) }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/shared/lib/commands/helpers',
  () => ({ emitCrudSideEffects: (...args: unknown[]) => mockEmitCrudSideEffects(...args) }),
  { virtual: true },
)
jest.mock('../../../data/entities', () => {
  const CompetitionStage = {
    DRAFT: 'draft',
    OPEN: 'open',
    TEAM_FORMATION: 'team_formation',
    TRACK_SELECTION: 'track_selection',
    HACKING: 'hacking',
    DEMOS: 'demos',
    DELIBERATION: 'deliberation',
    FINISHED: 'finished',
    ARCHIVED: 'archived',
  } as const
  return {
    Competition: class Competition {},
    CompetitionStage,
    STAGE_ORDER: Object.values(CompetitionStage),
  }
})
jest.mock('../../../commands/competitions', () => ({
  competitionCrudEvents: { module: 'competitions', entity: 'competition' },
  competitionCrudIndexer: { entityType: 'competitions:competition' },
}))
jest.mock('../../../../teams/data/entities', () => ({
  Team: class Team {},
  TeamTrack: class TeamTrack {},
  TeamStatus: { ACTIVE: 'active' },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST } = require('../route') as typeof import('../route')

const TENANT = '11111111-1111-4111-8111-111111111111'
const ORG = '22222222-2222-4222-8222-222222222222'
const COMPETITION = '33333333-3333-4333-8333-333333333333'

let storedStage: string
let flushed: number

async function advanceTo(targetStage: string) {
  const res = await POST(
    new Request('http://localhost/api/competitions/advance-stage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ competition_id: COMPETITION, target_stage: targetStage }),
    }),
  )
  return { status: res.status, body: (await res.json()) as Record<string, any> }
}

beforeEach(() => {
  jest.clearAllMocks()
  storedStage = 'team_formation'
  flushed = 0

  mockGetAuthFromCookies.mockResolvedValue({ tenantId: TENANT, orgId: ORG, sub: 'user-1' })

  const em = {
    findOne: jest.fn(async () => ({
      id: COMPETITION,
      tenantId: TENANT,
      organizationId: ORG,
      get stage() { return storedStage },
      set stage(next: string) { storedStage = next },
    })),
    find: jest.fn(async () => []),
    persist: jest.fn(),
    flush: jest.fn(async () => { flushed += 1 }),
  }
  mockCreateRequestContainer.mockResolvedValue({
    resolve: (name: string) => {
      if (name === 'em') return em
      if (name === 'dataEngine') return { flushOrmEntityChanges: jest.fn(async () => {}) }
      if (name === 'eventBus') return { emit: jest.fn(async () => {}) }
      throw new Error(`unexpected container token: ${name}`)
    },
  })
})

describe('POST /api/competitions/advance-stage — stale-read recovery', () => {
  it('flushes the cached CRUD row when the competition already reached the target stage', async () => {
    const { status, body } = await advanceTo('team_formation')

    expect(status).toBe(409)
    expect(body.code).toBe('stage_already_reached')
    // Without this the page can never recover: the cached list row keeps the pre-advance
    // stage, so the next load re-offers the same already-made transition.
    expect(mockInvalidateCrudCache).toHaveBeenCalledTimes(1)
    const [, resource, identifiers, fallbackTenant] = mockInvalidateCrudCache.mock.calls[0]
    expect(resource).toBe('competitions.competition')
    expect(identifiers).toEqual({ id: COMPETITION, organizationId: ORG, tenantId: TENANT })
    expect(fallbackTenant).toBe(TENANT)
    // The rejection must not write.
    expect(flushed).toBe(0)
    expect(storedStage).toBe('team_formation')
  })

  it('returns the real current stage so the page can re-sync its stage rail', async () => {
    const { body } = await advanceTo('team_formation')

    expect(body.competition).toEqual({ id: COMPETITION, stage: 'team_formation' })
  })

  it('rejects a backwards move the same way, with the real stage attached', async () => {
    const { status, body } = await advanceTo('open')

    expect(status).toBe(409)
    expect(body.code).toBe('stage_already_reached')
    expect(body.competition.stage).toBe('team_formation')
    expect(storedStage).toBe('team_formation')
  })

  it('still advances — and invalidates once — for a genuinely later stage', async () => {
    const { status, body } = await advanceTo('track_selection')

    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.competition.stage).toBe('track_selection')
    expect(storedStage).toBe('track_selection')
    expect(flushed).toBe(1)
    expect(mockInvalidateCrudCache).toHaveBeenCalledTimes(1)
    expect(mockInvalidateCrudCache.mock.calls[0][4]).toBe('competitions.stage.advance')
  })
})

// Keep this file a module so its top-level bindings stay file-scoped: sibling route tests
// declare the same names, and `yarn typecheck` sees every script-scoped test at once.
export {}
