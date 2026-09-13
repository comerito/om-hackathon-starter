/**
 * Route-handler tests for issue #109, join-request path —
 * `POST /api/teams/portal/request-join`.
 *
 * Same shape as the invite path: `max_team_size` was configured and enforced nowhere, so anyone
 * could queue up for a team the owner had no room to accept them into. These tests call the
 * exported `POST` against a fake `em` whose `count` applies whatever filter the route hands it,
 * which is what pins the remediation commit's `activeTeamMemberFilter` — a member who has LEFT
 * must not occupy a seat.
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
  TeamInvitation: class TeamInvitation {},
  TeamRole: { OWNER: 'owner', MEMBER: 'member' },
  InvitationType: { INVITE: 'invite', JOIN_REQUEST: 'join_request' },
  InvitationStatus: {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled',
  },
}))
jest.mock('../../../../../competitions/data/entities', () => ({
  Competition: class Competition {},
  CompetitionParticipation: class CompetitionParticipation {},
  ParticipationRole: { PARTICIPANT: 'participant', MENTOR: 'mentor', JUDGE: 'judge' },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST } = require('../route') as typeof import('../route')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const teamEntities = require('../../../../data/entities') as {
  Team: unknown
  TeamMember: unknown
  TeamInvitation: unknown
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const competitionEntities = require('../../../../../competitions/data/entities') as {
  Competition: unknown
  CompetitionParticipation: unknown
}

const TENANT = '11111111-1111-4111-8111-111111111111'
const COMPETITION = '22222222-2222-4222-8222-222222222222'
const TEAM = '33333333-3333-4333-8333-333333333333'

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SECOND_MEMBER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const DEPARTED_MEMBER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const APPLICANT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

type MemberRow = {
  teamId: string
  customerUserId: string
  competitionId: string
  role: string
  tenantId: string
  deletedAt: Date | null
  leftAt: Date | null
}

function member(customerUserId: string, over: Partial<MemberRow> = {}): MemberRow {
  return {
    teamId: TEAM,
    customerUserId,
    competitionId: COMPETITION,
    role: customerUserId === OWNER ? 'owner' : 'member',
    tenantId: TENANT,
    deletedAt: null,
    leftAt: null,
    ...over,
  }
}

/** Minimal equality matcher over the filters this route builds. */
function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key]
    if (cond === null) return value === null || value === undefined
    return value === cond
  })
}

let members: MemberRow[]
let pendingInvitationCount: number
let maxTeamSize: number | null
let persisted: unknown[]
let flushed: number
let countCalls: [unknown, Record<string, unknown>][]

async function requestJoin() {
  const res = await POST(
    new Request('http://localhost/api/teams/portal/request-join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ team_id: TEAM }),
    }),
  )
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

beforeEach(() => {
  jest.clearAllMocks()
  members = [member(OWNER)]
  pendingInvitationCount = 0
  maxTeamSize = 2
  persisted = []
  flushed = 0
  countCalls = []

  // The caller is the applicant, not a member of the team.
  mockGetCustomerAuthFromRequest.mockResolvedValue({
    sub: APPLICANT,
    tenantId: TENANT,
    orgId: 'org-1',
  })

  const em = {
    findOne: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity === teamEntities.Team) {
        return { id: TEAM, competitionId: COMPETITION, organizationId: 'org-1' }
      }
      if (entity === competitionEntities.CompetitionParticipation) {
        return { customerUserId: where.customerUserId, role: 'participant' }
      }
      if (entity === teamEntities.TeamMember) {
        // "Am I already on a team?" is keyed by customerUserId, the owner lookup by role.
        return members.find((row) => matches(row as unknown as Record<string, unknown>, where)) ?? null
      }
      if (entity === teamEntities.TeamInvitation) return null
      if (entity === competitionEntities.Competition) {
        return { id: COMPETITION, maxTeamSize, minTeamSize: null }
      }
      throw new Error('unexpected entity in em.findOne')
    }),
    count: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      countCalls.push([entity, where])
      if (entity === teamEntities.TeamMember) {
        return members.filter((row) => matches(row as unknown as Record<string, unknown>, where))
          .length
      }
      if (entity === teamEntities.TeamInvitation) return pendingInvitationCount
      throw new Error('unexpected entity in em.count')
    }),
    create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({ id: 'new-id', ...data })),
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

describe('POST /api/teams/portal/request-join — max team size (#109)', () => {
  it('refuses with 409 when the team is already at its cap, and writes nothing', async () => {
    members = [member(OWNER), member(SECOND_MEMBER)]

    const { status, body } = await requestJoin()

    expect(status).toBe(409)
    expect(body).toEqual({ error: 'This team is full (2 of 2 members).' })
    expect(persisted).toEqual([])
    expect(flushed).toBe(0)
  })

  it('counts pending invitations against the cap', async () => {
    pendingInvitationCount = 1 // 1 member + 1 pending invite = 2 of 2

    const { status, body } = await requestJoin()

    expect(status).toBe(409)
    expect(body.error).toContain('1 pending invitation(s), limit 2')
    expect(flushed).toBe(0)
  })

  it('still accepts a request while a seat is free', async () => {
    const { status, body } = await requestJoin()
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(flushed).toBe(1)
  })

  it('leaves an unconfigured cap uncapped', async () => {
    maxTeamSize = null
    members = [member(OWNER), member(SECOND_MEMBER)]

    const { status } = await requestJoin()
    expect(status).toBe(200)
  })
})

describe('POST /api/teams/portal/request-join — a departed member frees their seat (#109)', () => {
  it('does not charge the team for a member who has LEFT', async () => {
    members = [
      member(OWNER),
      member(DEPARTED_MEMBER, { leftAt: new Date('2026-03-01T00:00:00.000Z') }),
    ]

    const { status, body } = await requestJoin()

    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(flushed).toBe(1)
  })

  it('asks the database for active members only', async () => {
    await requestJoin()
    const memberCountFilter = countCalls.find(
      ([entity]) => entity === teamEntities.TeamMember,
    )?.[1]
    expect(memberCountFilter).toEqual({
      teamId: TEAM,
      tenantId: TENANT,
      deletedAt: null,
      leftAt: null,
    })
  })
})

// Keep this file a module so its top-level `POST` / mock bindings stay file-scoped: the sibling
// route tests declare the same names, and `yarn typecheck` sees every script-scoped test at once.
export {}
