/**
 * Route-handler tests for issue #108 — `GET /api/competitions/portal/competition-data?type=tracks`.
 *
 * `tracks/lib/__tests__/track-visibility.test.ts` proves `SELECTABLE_TRACK_FILTER` describes the
 * right rows. It proves nothing about this route, and an adversarial review demonstrated exactly
 * that: deleting `...SELECTABLE_TRACK_FILTER` from `../route.ts:112` re-opened #108 in full while
 * the whole suite stayed green.
 *
 * So these tests call the exported `GET` with a fake container / `em` whose `find` honours the
 * filter the route actually builds, and assert on the response body the portal track picker would
 * render: a soft-deleted or deactivated track is simply not in `items`.
 */

const mockGetCustomerAuthFromRequest = jest.fn()
const mockCreateRequestContainer = jest.fn()

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
// Translation overlays are a pass-through here: #108 is about which rows are loaded, not how they
// are localised.
jest.mock('@/lib/portal-translations', () => ({
  resolvePortalLocale: async () => 'en',
  applyPortalTranslationOverlays: async (items: unknown[]) => items,
}))
// The entity modules pull in MikroORM decorators; the route only uses the classes as query tokens.
jest.mock('../../../../data/entities', () => ({
  AgendaItem: class AgendaItem {},
  Announcement: class Announcement {},
  CompetitionParticipation: class CompetitionParticipation {},
  Milestone: class Milestone {},
  // `lib/announcement-order` reads this at module load, transitively through the route.
  AnnouncementPriority: { INFO: 'info', WARNING: 'warning', URGENT: 'urgent' },
}))
jest.mock('../../../../../tracks/data/entities', () => ({ Track: class Track {} }))
jest.mock('../../../../../projects/data/entities', () => ({ Project: class Project {} }))
jest.mock('../../../../../teams/data/entities', () => ({
  Team: class Team {},
  TeamTrack: class TeamTrack {},
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require('../route') as typeof import('../route')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Track } = require('../../../../../tracks/data/entities') as { Track: unknown }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CompetitionParticipation } = require('../../../../data/entities') as {
  CompetitionParticipation: unknown
}

const TENANT = '11111111-1111-4111-8111-111111111111'
const COMPETITION = '22222222-2222-4222-8222-222222222222'
const CALLER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const LIVE_TRACK = '44444444-4444-4444-8444-444444444444'
const DELETED_TRACK = '55555555-5555-4555-8555-555555555555'
const DEACTIVATED_TRACK = '66666666-6666-4666-8666-666666666666'

type TrackRow = {
  id: string
  name: string
  competitionId: string
  tenantId: string
  deletedAt: Date | null
  isActive: boolean
  order: number
  description: string | null
  shortDescription: string | null
  color: string | null
  iconUrl: string | null
  maxTeams: number | null
  category: string | null
  badge: string | null
}

function track(id: string, name: string, over: Partial<TrackRow>): TrackRow {
  return {
    id,
    name,
    competitionId: COMPETITION,
    tenantId: TENANT,
    deletedAt: null,
    isActive: true,
    order: 1,
    description: null,
    shortDescription: null,
    color: null,
    iconUrl: null,
    maxTeams: null,
    category: null,
    badge: null,
    ...over,
  }
}

const TRACKS: TrackRow[] = [
  track(LIVE_TRACK, 'Open Innovation', {}),
  track(DELETED_TRACK, 'Retired Track', { deletedAt: new Date('2026-01-01T00:00:00.000Z') }),
  track(DEACTIVATED_TRACK, 'Paused Track', { isActive: false }),
]

/** Minimal `$in` / equality matcher — enough for the filters this route builds. */
function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key]
    if (cond && typeof cond === 'object' && '$in' in (cond as Record<string, unknown>)) {
      return ((cond as { $in: unknown[] }).$in ?? []).includes(value)
    }
    if (cond === null) return value === null || value === undefined
    return value === cond
  })
}

let trackQueries: Record<string, unknown>[] = []
let isParticipant = true

async function fetchTracks(): Promise<{
  status: number
  raw: string
  items: { id: string; name: string }[]
}> {
  const res = await GET(
    new Request(
      `http://localhost/api/competitions/portal/competition-data?competition_id=${COMPETITION}&type=tracks`,
    ),
  )
  const raw = await res.text()
  const body = JSON.parse(raw) as { items?: { id: string; name: string }[] }
  return { status: res.status, raw, items: body.items ?? [] }
}

beforeEach(() => {
  jest.clearAllMocks()
  trackQueries = []
  isParticipant = true

  mockGetCustomerAuthFromRequest.mockResolvedValue({ sub: CALLER, tenantId: TENANT, orgId: 'org-1' })

  const em = {
    findOne: jest.fn(async (entity: unknown) => {
      if (entity !== CompetitionParticipation) throw new Error('unexpected entity in em.findOne')
      return isParticipant ? { id: 'participation-1' } : null
    }),
    find: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity !== Track) throw new Error('unexpected entity in em.find')
      trackQueries.push(where)
      return TRACKS.filter((row) => matches(row as unknown as Record<string, unknown>, where))
    }),
  }
  mockCreateRequestContainer.mockResolvedValue({
    resolve: (name: string) => {
      if (name !== 'em') throw new Error(`unexpected container token: ${name}`)
      return em
    },
  })
})

describe('GET competition-data?type=tracks — soft-deleted tracks (#108)', () => {
  it('omits a soft-deleted track from the response body', async () => {
    const { status, raw, items } = await fetchTracks()

    expect(status).toBe(200)
    expect(items.map((i) => i.id)).toEqual([LIVE_TRACK])
    // Not merely absent from `items` — absent from the bytes the picker receives.
    expect(raw).not.toContain(DELETED_TRACK)
    expect(raw).not.toContain('Retired Track')
  })

  it('omits a deactivated track too', async () => {
    const { raw, items } = await fetchTracks()
    expect(items.map((i) => i.id)).not.toContain(DEACTIVATED_TRACK)
    expect(raw).not.toContain('Paused Track')
  })

  it('still offers the live track', async () => {
    const { items } = await fetchTracks()
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('Open Innovation')
  })

  it('asks the database for selectable rows only, rather than filtering afterwards', async () => {
    await fetchTracks()
    expect(trackQueries).toHaveLength(1)
    expect(trackQueries[0]).toMatchObject({
      competitionId: COMPETITION,
      tenantId: TENANT,
      deletedAt: null,
      isActive: true,
    })
  })

  it('returns an empty list rather than everything when no track is selectable', async () => {
    TRACKS[0].isActive = false
    try {
      const { items } = await fetchTracks()
      expect(items).toEqual([])
    } finally {
      TRACKS[0].isActive = true
    }
  })
})

describe('GET competition-data?type=tracks — preconditions', () => {
  it('answers 403 with no tracks in the body for a non-participant', async () => {
    isParticipant = false
    const { status, raw, items } = await fetchTracks()
    expect(status).toBe(403)
    expect(items).toEqual([])
    expect(raw).not.toContain('Open Innovation')
  })

  it('answers 401 without a customer session', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(null)
    const { status } = await fetchTracks()
    expect(status).toBe(401)
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })
})

// Keep this file a module so its top-level `GET` / mock bindings stay file-scoped: the sibling
// route tests declare the same names, and `yarn typecheck` sees every script-scoped test at once.
export {}
