/**
 * `POST /api/teams/admin/assign-tracks` — organizer track assignment.
 *
 * The case this route exists for: a team formed during `hacking` has no track and, because the
 * stage transition already ran, no draft project either. Assigning a track must create it.
 */

const mockGetAuthFromRequest = jest.fn()
const mockCreateRequestContainer = jest.fn()
const mockRunRouteMutationGuards = jest.fn()

jest.mock('@open-mercato/shared/lib/auth/server', () => ({ getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a) }), { virtual: true })
jest.mock('@open-mercato/shared/lib/di/container', () => ({ createRequestContainer: (...a: unknown[]) => mockCreateRequestContainer(...a) }), { virtual: true })
jest.mock('@open-mercato/shared/lib/crud/route-mutation-guard', () => ({ runRouteMutationGuards: (...a: unknown[]) => mockRunRouteMutationGuards(...a) }), { virtual: true })
jest.mock('@open-mercato/core/modules/directory/utils/organizationScope', () => ({ resolveOrganizationScopeForRequest: async () => ({ selectedId: null }) }), { virtual: true })
jest.mock('../../../../data/entities', () => ({ Team: class Team {}, TeamTrack: class TeamTrack {} }))
jest.mock('../../../../../tracks/data/entities', () => ({ Track: class Track {} }))
jest.mock('../../../../../projects/data/entities', () => ({ Project: class Project {}, ProjectStatus: { DRAFT: 'draft', PUBLISHED: 'published' } }))
jest.mock('../../../../../competitions/data/entities', () => ({
  Competition: class Competition {},
  CompetitionStage: { TRACK_SELECTION: 'track_selection', HACKING: 'hacking', DEMOS: 'demos' },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST } = require('../route') as typeof import('../route')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Team, TeamTrack } = require('../../../../data/entities') as { Team: unknown; TeamTrack: unknown }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Track } = require('../../../../../tracks/data/entities') as { Track: unknown }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Project } = require('../../../../../projects/data/entities') as { Project: unknown }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Competition } = require('../../../../../competitions/data/entities') as { Competition: unknown }

const TENANT = '11111111-1111-4111-8111-111111111111'
const ORG = '99999999-9999-4999-8999-999999999999'
const COMPETITION = '22222222-2222-4222-8222-222222222222'
const TEAM = '33333333-3333-4333-8333-333333333333'
const TRACK_A = '44444444-4444-4444-8444-444444444444'
const TRACK_B = '55555555-5555-4555-8555-555555555555'
const INACTIVE = '66666666-6666-4666-8666-666666666666'

type Row = Record<string, unknown>
let state: { team: Row; competition: Row; teamTracks: Row[]; projects: Row[]; tracks: Row[] }
let persisted: Row[]
let removed: Row[]
let flushed: number
let findsAfterMutation: number
let emitted: Array<{ id: string; payload: Row }>

function buildEm() {
  let mutated = false
  const trackRead = () => { if (mutated) findsAfterMutation += 1 }
  return {
    findOne: jest.fn(async (entity: unknown) => {
      trackRead()
      if (entity === Team) return state.team
      if (entity === Competition) return state.competition
      return null
    }),
    find: jest.fn(async (entity: unknown, where: { id?: { $in: string[] }; trackId?: { $in: string[] } }) => {
      trackRead()
      if (entity === TeamTrack) return state.teamTracks
      if (entity === Track) return state.tracks.filter((t) => where.id?.$in.includes(t.id as string))
      if (entity === Project) return state.projects.filter((p) => where.trackId?.$in.includes(p.trackId as string))
      return []
    }),
    create: jest.fn((_e: unknown, data: Row) => ({ id: `new-${String(data.trackId)}`, ...data })),
    persist: jest.fn((row: Row) => { if (row === state.team) mutated = true; persisted.push(row) }),
    remove: jest.fn((row: Row) => { removed.push(row) }),
    flush: jest.fn(async () => { flushed += 1 }),
  }
}

function call(trackIds: string[]) {
  return POST(new Request('http://localhost/api/teams/admin/assign-tracks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ team_id: TEAM, track_ids: trackIds }),
  }))
}

const emptyDraft = { status: 'draft', description: null, screenshotIds: [], attachmentIds: [], techStack: [] }

beforeEach(() => {
  persisted = []; removed = []; flushed = 0; findsAfterMutation = 0; emitted = []
  state = {
    team: { id: TEAM, name: 'Late Joiners', competitionId: COMPETITION, trackId: null, tenantId: TENANT, organizationId: ORG },
    competition: { id: COMPETITION, stage: 'hacking', maxTracksPerTeam: 2 },
    teamTracks: [],
    projects: [],
    tracks: [
      { id: TRACK_A, isActive: true, deletedAt: null },
      { id: TRACK_B, isActive: true, deletedAt: null },
      { id: INACTIVE, isActive: false, deletedAt: null },
    ],
  }
  const em = buildEm()
  mockGetAuthFromRequest.mockResolvedValue({ sub: 'admin-1', tenantId: TENANT, orgId: ORG })
  mockCreateRequestContainer.mockResolvedValue({
    resolve: (name: string) => (name === 'em' ? em : { emit: async (id: string, payload: Row) => { emitted.push({ id, payload }) } }),
  })
  mockRunRouteMutationGuards.mockResolvedValue({ ok: true, runAfterSuccess: jest.fn() })
})

describe('POST /api/teams/admin/assign-tracks', () => {
  it('gives a team formed during hacking its track AND the draft project it missed', async () => {
    const res = await call([TRACK_A])
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(state.team.trackId).toBe(TRACK_A)
    expect(persisted.filter((row) => row.status === 'draft')).toEqual([
      expect.objectContaining({ teamId: TEAM, trackId: TRACK_A, competitionId: COMPETITION, title: "Late Joiners's Project" }),
    ])
    expect(persisted.some((row) => row.trackId === TRACK_A && row.status === undefined && row.teamId === TEAM)).toBe(true) // junction row
    expect(body.created_project_ids).toEqual([`new-${TRACK_A}`])
    expect(flushed).toBe(1)
    expect(emitted.map((event) => event.id)).toEqual(['teams.team.tracks_updated'])
  })

  it('never reads between a scalar mutation and the flush (MikroORM 7)', async () => {
    await call([TRACK_A, TRACK_B])
    expect(findsAfterMutation).toBe(0)
  })

  it('does not create drafts outside the hacking stage', async () => {
    state.competition.stage = 'track_selection'
    const body = await (await call([TRACK_A])).json()
    expect(body.created_project_ids).toEqual([])
    expect(body.drafts_created_for_stage).toBe(false)
    expect(state.team.trackId).toBe(TRACK_A)
  })

  it('enforces the competition track limit', async () => {
    state.competition.maxTracksPerTeam = 1
    const res = await call([TRACK_A, TRACK_B])
    expect(res.status).toBe(422)
    expect(flushed).toBe(0)
  })

  it('refuses tracks from another competition and newly added inactive tracks', async () => {
    expect((await call(['77777777-7777-4777-8777-777777777777'])).status).toBe(404)
    expect((await call([INACTIVE])).status).toBe(409)
    expect(flushed).toBe(0)
  })

  it('lets a team keep a track that was deactivated after it was chosen', async () => {
    state.team.trackId = INACTIVE
    state.teamTracks = [{ trackId: INACTIVE }]
    state.projects = [{ id: 'p-1', trackId: INACTIVE, ...emptyDraft, description: 'work' }]
    expect((await call([INACTIVE, TRACK_A])).status).toBe(200)
  })

  it('removes an untouched draft with its track, but blocks when the team already wrote something', async () => {
    state.team.trackId = TRACK_A
    state.teamTracks = [{ trackId: TRACK_A }]
    state.projects = [{ id: 'p-1', trackId: TRACK_A, title: 'Empty', ...emptyDraft }]
    const ok = await (await call([TRACK_B])).json()
    expect(ok.removed_project_ids).toEqual(['p-1'])
    expect(removed.map((row) => row.id ?? row.trackId)).toEqual(expect.arrayContaining(['p-1']))

    removed = []; flushed = 0
    state.team.trackId = TRACK_A
    state.projects = [{ id: 'p-2', trackId: TRACK_A, title: 'Real work', ...emptyDraft, description: 'We built it' }]
    const blocked = await call([TRACK_B])
    expect(blocked.status).toBe(409)
    expect((await blocked.json()).details[0]).toMatchObject({ project_id: 'p-2', title: 'Real work' })
    expect(flushed).toBe(0)
  })

  it('stops when a mutation guard blocks', async () => {
    mockRunRouteMutationGuards.mockResolvedValue({ ok: false, response: new Response('{}', { status: 423 }) })
    expect((await call([TRACK_A])).status).toBe(423)
    expect(flushed).toBe(0)
  })

  it('requires authentication', async () => {
    mockGetAuthFromRequest.mockResolvedValue(null)
    expect((await call([TRACK_A])).status).toBe(401)
  })
})

export {}
