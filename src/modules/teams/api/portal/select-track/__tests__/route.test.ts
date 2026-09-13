/**
 * Route-handler tests for issue #108, write side — `POST /api/teams/portal/select-track`.
 *
 * Hiding a removed track from the picker is only half a fix: a client working from a stale list
 * (or anyone posting by hand) can still name the track's id. These tests call the exported `POST`
 * and assert the write is refused with 409 *and* that nothing was flushed — a 409 that still
 * persisted the row would not be a closed hole.
 *
 * Deleting the `isSelectableTrack` guard from `../route.ts` makes them fail.
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
// The entity modules pull in MikroORM decorators; the route uses the classes as query tokens and
// the enums/orderings as plain values, which are reproduced verbatim here.
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

const TRACKS: Record<string, TrackRow> = {
  [LIVE_TRACK]: { id: LIVE_TRACK, deletedAt: null, isActive: true },
  [DELETED_TRACK]: {
    id: DELETED_TRACK,
    deletedAt: new Date('2026-01-01T00:00:00.000Z'),
    isActive: true,
  },
  [DEACTIVATED_TRACK]: { id: DEACTIVATED_TRACK, deletedAt: null, isActive: false },
}

let team: { id: string; competitionId: string; trackId: string | null }
let flushed: number
let persisted: unknown[]

function post(trackId: string | null): Request {
  return new Request('http://localhost/api/teams/portal/select-track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ team_id: TEAM, track_id: trackId }),
  })
}

async function selectTrack(trackId: string | null) {
  const res = await POST(post(trackId))
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
    findOne: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity === entities.TeamMember) return { id: 'membership-1', role: 'owner' }
      if (entity === entities.Team) return team
      if (entity === Competition) {
        return { id: COMPETITION, stage: 'track_selection', allowTrackChange: true }
      }
      if (entity === Track) return TRACKS[String(where.id)] ?? null
      throw new Error('unexpected entity in em.findOne')
    }),
    find: jest.fn(async () => []),
    remove: jest.fn(),
    create: jest.fn((_entity: unknown, data: unknown) => data),
    persist: jest.fn((row: unknown) => {
      persisted.push(row)
    }),
    flush: jest.fn(async () => {
      flushed += 1
    }),
  }
  mockCreateRequestContainer.mockResolvedValue({
    resolve: (name: string) => {
      if (name !== 'em') throw new Error(`unexpected container token: ${name}`)
      return em
    },
  })
})

describe('POST /api/teams/portal/select-track — unavailable tracks (#108)', () => {
  it('refuses a soft-deleted track with 409 and writes nothing', async () => {
    const { status, body } = await selectTrack(DELETED_TRACK)

    expect(status).toBe(409)
    expect(body).toEqual({ error: 'This track is no longer available' })
    expect(team.trackId).toBeNull()
    expect(flushed).toBe(0)
    expect(persisted).toEqual([])
  })

  it('refuses a deactivated track with 409 and writes nothing', async () => {
    const { status, body } = await selectTrack(DEACTIVATED_TRACK)

    expect(status).toBe(409)
    expect(body).toEqual({ error: 'This track is no longer available' })
    expect(team.trackId).toBeNull()
    expect(flushed).toBe(0)
  })

  it('still accepts a live track', async () => {
    const { status, body } = await selectTrack(LIVE_TRACK)

    expect(status).toBe(200)
    expect(body).toEqual({ ok: true, track_id: LIVE_TRACK })
    expect(team.trackId).toBe(LIVE_TRACK)
    expect(flushed).toBe(1)
  })

  it('still accepts clearing the track', async () => {
    team.trackId = LIVE_TRACK
    const { status } = await selectTrack(null)
    expect(status).toBe(200)
    expect(team.trackId).toBeNull()
  })

  it('keeps 404 — not 409 — for a track that belongs to another competition', async () => {
    const { status, body } = await selectTrack('77777777-7777-4777-8777-777777777777')
    expect(status).toBe(404)
    expect(body).toEqual({ error: 'Track not found in this competition' })
  })
})

// Keep this file a module so its top-level `POST` / mock bindings stay file-scoped: the sibling
// route tests declare the same names, and `yarn typecheck` sees every script-scoped test at once.
export {}
