/**
 * Route-handler tests for `POST /api/teams/portal/update-recruitment` — the endpoint a team
 * owner uses to publish "we are looking for someone with these skills".
 *
 * `teams/lib/__tests__/recruitment.test.ts` proves the normalisation rules. These tests prove
 * the route applies them, that only the owner may write, and — the rule most likely to rot —
 * that closing the posting actually clears the skills and the note rather than parking stale
 * wants on a team that has stopped recruiting.
 *
 * Every refusal also asserts nothing was persisted or flushed.
 */

const mockGetCustomerAuthFromRequest = jest.fn()
const mockCreateRequestContainer = jest.fn()
const mockRunRouteMutationGuards = jest.fn()

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
  '@open-mercato/shared/lib/crud/route-mutation-guard',
  () => ({ runRouteMutationGuards: (...args: unknown[]) => mockRunRouteMutationGuards(...args) }),
  { virtual: true },
)
// The entity module pulls in MikroORM decorators; the route uses the classes as query tokens and
// the enum as a plain value, reproduced verbatim here.
jest.mock('../../../../data/entities', () => ({
  Team: class Team {},
  TeamMember: class TeamMember {},
  TeamRole: { OWNER: 'owner', MEMBER: 'member' },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST } = require('../route') as typeof import('../route')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const teamEntities = require('../../../../data/entities') as {
  Team: unknown
  TeamMember: unknown
}

const TENANT = '11111111-1111-4111-8111-111111111111'
const COMPETITION = '22222222-2222-4222-8222-222222222222'
const TEAM = '33333333-3333-4333-8333-333333333333'
const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const MEMBER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

type TeamRow = {
  id: string
  competitionId: string
  organizationId: string
  lookingForMembers: boolean
  neededSkills: string[]
  recruitmentNote: string | null
}

let teamRow: TeamRow | null
let ownerId: string
let callerId: string
let persisted: unknown[]
let flushed: number
let afterSuccessRuns: number
let emittedEvents: [string, Record<string, unknown>][]

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/teams/portal/update-recruitment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  ).then(async (res) => ({ status: res.status, body: (await res.json()) as Record<string, unknown> }))
}

beforeEach(() => {
  jest.clearAllMocks()
  ownerId = OWNER
  callerId = OWNER
  persisted = []
  flushed = 0
  afterSuccessRuns = 0
  emittedEvents = []
  teamRow = {
    id: TEAM,
    competitionId: COMPETITION,
    organizationId: 'org-1',
    lookingForMembers: false,
    neededSkills: [],
    recruitmentNote: null,
  }

  mockGetCustomerAuthFromRequest.mockResolvedValue({ sub: callerId, tenantId: TENANT, orgId: 'org-1' })
  mockRunRouteMutationGuards.mockResolvedValue({
    ok: true,
    runAfterSuccess: async () => {
      afterSuccessRuns += 1
    },
  })

  const em = {
    findOne: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity === teamEntities.TeamMember) {
        // Ownership lookup: only the configured owner satisfies `role: 'owner'`.
        return where.customerUserId === ownerId && where.role === 'owner'
          ? { teamId: TEAM, customerUserId: ownerId, role: 'owner' }
          : null
      }
      if (entity === teamEntities.Team) return teamRow
      throw new Error('unexpected entity in em.findOne')
    }),
    persist: jest.fn((row: unknown) => {
      persisted.push(row)
    }),
    flush: jest.fn(async () => {
      flushed += 1
    }),
  }
  mockCreateRequestContainer.mockResolvedValue({
    resolve: (name: string) => {
      if (name === 'em') return em
      if (name === 'eventBus') {
        return {
          emit: async (id: string, payload: Record<string, unknown>) => {
            emittedEvents.push([id, payload])
          },
        }
      }
      throw new Error(`unexpected container token: ${name}`)
    },
  })
})

describe('POST /api/teams/portal/update-recruitment', () => {
  it('rejects an unauthenticated caller', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(null)

    const { status } = await post({ team_id: TEAM, looking_for_members: true })

    expect(status).toBe(401)
    expect(flushed).toBe(0)
  })

  it('refuses a non-owner member with 403 and writes nothing', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue({ sub: MEMBER, tenantId: TENANT, orgId: 'org-1' })

    const { status, body } = await post({ team_id: TEAM, looking_for_members: true, needed_skills: ['React'] })

    expect(status).toBe(403)
    expect(body.error).toBe('Only the team owner can update the recruitment posting')
    expect(persisted).toEqual([])
    expect(flushed).toBe(0)
  })

  it('returns 404 when the team is gone, even for its owner', async () => {
    teamRow = null

    const { status } = await post({ team_id: TEAM, looking_for_members: true })

    expect(status).toBe(404)
    expect(flushed).toBe(0)
  })

  it('returns 422 for a malformed payload', async () => {
    const { status, body } = await post({ team_id: 'not-a-uuid', looking_for_members: true })

    expect(status).toBe(422)
    expect(body.error).toBe('Validation failed')
    expect(flushed).toBe(0)
  })

  it('publishes a posting with normalized skills and a trimmed note', async () => {
    const { status, body } = await post({
      team_id: TEAM,
      looking_for_members: true,
      needed_skills: [' React ', 'react', '', 'Postgres'],
      recruitment_note: '  We need a frontend dev.  ',
    })

    expect(status).toBe(200)
    expect(body).toEqual({
      ok: true,
      looking_for_members: true,
      needed_skills: ['React', 'Postgres'],
      recruitment_note: 'We need a frontend dev.',
    })
    expect(teamRow).toMatchObject({
      lookingForMembers: true,
      neededSkills: ['React', 'Postgres'],
      recruitmentNote: 'We need a frontend dev.',
    })
    expect(persisted).toEqual([teamRow])
    expect(flushed).toBe(1)
  })

  it('clears the skills and the note when the posting is closed', async () => {
    teamRow = { ...(teamRow as TeamRow), lookingForMembers: true, neededSkills: ['React'], recruitmentNote: 'Join us' }

    const { status, body } = await post({ team_id: TEAM, looking_for_members: false })

    expect(status).toBe(200)
    expect(body).toEqual({
      ok: true,
      looking_for_members: false,
      needed_skills: [],
      recruitment_note: null,
    })
    expect(teamRow).toMatchObject({ lookingForMembers: false, neededSkills: [], recruitmentNote: null })
    expect(flushed).toBe(1)
  })

  it('keeps the stored skills when the payload omits them', async () => {
    teamRow = { ...(teamRow as TeamRow), lookingForMembers: true, neededSkills: ['Go'], recruitmentNote: 'Join us' }

    const { body } = await post({ team_id: TEAM, looking_for_members: true })

    expect(body.needed_skills).toEqual(['Go'])
    expect(body.recruitment_note).toBe('Join us')
  })

  it('treats an empty note as no note', async () => {
    const { body } = await post({ team_id: TEAM, looking_for_members: true, recruitment_note: '   ' })

    expect(body.recruitment_note).toBeNull()
  })

  it('stops at a blocking mutation guard without writing', async () => {
    mockRunRouteMutationGuards.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'blocked by guard' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    })

    const { status, body } = await post({ team_id: TEAM, looking_for_members: true })

    expect(status).toBe(403)
    expect(body.error).toBe('blocked by guard')
    expect(persisted).toEqual([])
    expect(flushed).toBe(0)
  })

  it('runs the guard after-success callbacks and emits the team update only once committed', async () => {
    await post({ team_id: TEAM, looking_for_members: true, needed_skills: ['React'] })

    expect(afterSuccessRuns).toBe(1)
    expect(emittedEvents).toEqual([
      ['teams.team.updated', {
        teamId: TEAM,
        competitionId: COMPETITION,
        tenantId: TENANT,
        organizationId: 'org-1',
      }],
    ])
  })
})

// Keep this file a module so its top-level bindings stay file-scoped: the sibling route tests
// declare the same names, and `yarn typecheck` sees every script-scoped test at once.
export {}
