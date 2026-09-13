/**
 * Route-handler tests for issue #108, multi-track write side —
 * `POST /api/teams/portal/manage-tracks`.
 *
 * Same hole as `select-track`, one layer up: this route accepts a *list* of track ids, so a stale
 * client can smuggle a removed track in alongside live ones. These tests call the exported `POST`
 * and assert the whole request is refused with 409, that the response names which ids were
 * rejected, and that nothing was flushed.
 *
 * Deleting the `unavailableTrackIds` guard from `../route.ts` makes them fail.
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
jest.mock('../../../../data/entities', () => ({
  Team: class Team {},
  TeamMember: class TeamMember {},
  TeamTrack: class TeamTrack {},
  TeamRole: { OWNER: 'owner', MEMBER: 'member' },
}))
jest.mock('../../../../../tracks/data/entities', () => ({ Track: class Track {} }))
jest.mock('../../../../../competitions/data/entities', () => ({
  Competition: class Competition {},
  CompetitionStage: {
    DRAFT: 'draft',
    OPEN: 'open',
    TEAM_FORMATION: 'team_formation',
    TRACK_SELECTION: 'track_selection',
    HACKING: 'hacking',
    DEMOS: 'demos',
    DELIBERATION: 'deliberation',
    FINISHED: 'finished',
    ARCHIVED: 'archived',
  },
  STAGE_ORDER: [
    'draft',
    'open',
    'team_formation',
    'track_selection',
    'hacking',
    'demos',
    'deliberation',
    'finished',
    'archived',
  ],
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST } = require('../route') as typeof import('../route')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const entities = require('../../../../data/entities') as {
  Team: unknown
  TeamMember: unknown
  TeamTrack: unknown
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Track } = require('../../../../../tracks/data/entities') as { Track: unknown }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Competition } = require('../../../../../competitions/data/entities') as {
  Competition: unknown
}

const TENANT = '11111111-1111-4111-8111-111111111111'
const COMPETITION = '22222222-2222-4222-8222-222222222222'
const TEAM = '33333333-3333-4333-8333-333333333333'
const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const LIVE_TRACK = '44444444-4444-4444-8444-444444444444'
const DELETED_TRACK = '55555555-5555-4555-8555-555555555555'
const DEACTIVATED_TRACK = '66666666-6666-4666-8666-666666666666'

type TrackRow = { id: string; deletedAt: Date | null; isActive: boolean }

const TRACKS: TrackRow[] = [
  { id: LIVE_TRACK, deletedAt: null, isActive: true },
  { id: DELETED_TRACK, deletedAt: new Date('2026-01-01T00:00:00.000Z'), isActive: true },
  { id: DEACTIVATED_TRACK, deletedAt: null, isActive: false },
]

let team: { id: string; competitionId: string; trackId: string | null }
let flushed: number
let persisted: { trackId?: string }[]

async function manageTracks(trackIds: string[]) {
  const res = await POST(
    new Request('http://localhost/api/teams/portal/manage-tracks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ team_id: TEAM, track_ids: trackIds }),
    }),
  )
  const raw = await res.text()
  return { status: res.status, raw, body: JSON.parse(raw) as Record<string, unknown> }
}

beforeEach(() => {
  jest.clearAllMocks()
  team = { id: TEAM, competitionId: COMPETITION, trackId: null }
  flushed = 0
  persisted = []

  mockGetCustomerAuthFromRequest.mockResolvedValue({ sub: OWNER, tenantId: TENANT, orgId: 'org-1' })

  const em = {
    findOne: jest.fn(async (entity: unknown) => {
      if (entity === entities.TeamMember) return { id: 'membership-1', role: 'owner' }
      if (entity === entities.Team) return team
      if (entity === Competition) {
        return {
          id: COMPETITION,
          stage: 'track_selection',
          allowTrackChange: true,
          maxTracksPerTeam: 3,
        }
      }
      throw new Error('unexpected entity in em.findOne')
    }),
    find: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity === Track) {
        const wanted = (where.id as { $in?: string[] } | undefined)?.$in ?? []
        return TRACKS.filter((t) => wanted.includes(t.id))
      }
      if (entity === entities.TeamTrack) return []
      throw new Error('unexpected entity in em.find')
    }),
    remove: jest.fn(),
    create: jest.fn((_entity: unknown, data: unknown) => data),
    persist: jest.fn((row: { trackId?: string }) => {
      persisted.push(row)
    }),
    flush: jest.fn(async () => {
      flushed += 1
    }),
  }
  const eventBus = { emit: jest.fn(async () => {}) }
  mockCreateRequestContainer.mockResolvedValue({
    resolve: (name: string) => {
      if (name === 'em') return em
      // The happy path emits a domain event after the flush; a stub keeps that path real
      // (and the test output quiet) without asserting on it.
      if (name === 'eventBus') return eventBus
      throw new Error(`unexpected container token: ${name}`)
    },
  })
})

describe('POST /api/teams/portal/manage-tracks — unavailable tracks (#108)', () => {
  it('refuses a soft-deleted track with 409, names it, and writes nothing', async () => {
    const { status, body } = await manageTracks([DELETED_TRACK])

    expect(status).toBe(409)
    expect(body.details).toEqual([DELETED_TRACK])
    expect(body.error).toBe('1 of the selected track(s) are no longer available')
    expect(flushed).toBe(0)
    expect(persisted).toEqual([])
    expect(team.trackId).toBeNull()
  })

  it('refuses the whole request when a removed track rides along with a live one', async () => {
    const { status, body } = await manageTracks([LIVE_TRACK, DELETED_TRACK])

    expect(status).toBe(409)
    expect(body.details).toEqual([DELETED_TRACK])
    // Nothing partially applied: the live track must not be written either.
    expect(flushed).toBe(0)
    expect(persisted).toEqual([])
    expect(team.trackId).toBeNull()
  })

  it('names every unavailable id, in the requested order', async () => {
    const { status, body } = await manageTracks([DEACTIVATED_TRACK, LIVE_TRACK, DELETED_TRACK])

    expect(status).toBe(409)
    expect(body.details).toEqual([DEACTIVATED_TRACK, DELETED_TRACK])
    expect(body.error).toBe('2 of the selected track(s) are no longer available')
  })

  it('still accepts a list of live tracks', async () => {
    const { status } = await manageTracks([LIVE_TRACK])
    expect(status).toBe(200)
    expect(flushed).toBe(1)
    expect(persisted.some((row) => row.trackId === LIVE_TRACK)).toBe(true)
    expect(team.trackId).toBe(LIVE_TRACK)
  })

  it('keeps 404 — not 409 — for an id that is not a track of this competition', async () => {
    const { status, body } = await manageTracks(['77777777-7777-4777-8777-777777777777'])
    expect(status).toBe(404)
    expect(body).toEqual({ error: 'One or more tracks not found in this competition' })
    expect(flushed).toBe(0)
  })
})

// Keep this file a module so its top-level `POST` / mock bindings stay file-scoped: the sibling
// route tests declare the same names, and `yarn typecheck` sees every script-scoped test at once.
export {}
