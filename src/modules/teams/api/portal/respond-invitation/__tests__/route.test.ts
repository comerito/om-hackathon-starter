/**
 * Route-handler tests for issue #109, accept path —
 * `POST /api/teams/portal/respond-invitation` with `action: 'accept'`.
 *
 * This is the path that actually takes the seat, and the one that matters most: an invitation
 * issued while the team had room can be accepted long after it filled up another way. So the cap
 * is checked again here, with `canJoinTeam` rather than `canInviteToTeam` — pending invitations
 * deliberately do NOT count, because this call is one of them being converted.
 *
 * The fake `em.count` applies whatever filter the route hands it, which is what pins the
 * remediation commit's `activeTeamMemberFilter`: a member who has LEFT must not block an accept.
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
const INVITATION = '44444444-4444-4444-8444-444444444444'

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SECOND_MEMBER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const DEPARTED_MEMBER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const JOINER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

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
let maxTeamSize: number | null
let persisted: Record<string, unknown>[]
let flushed: number
let countCalls: [unknown, Record<string, unknown>][]

async function accept() {
  const res = await POST(
    new Request('http://localhost/api/teams/portal/respond-invitation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invitation_id: INVITATION, action: 'accept' }),
    }),
  )
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

beforeEach(() => {
  jest.clearAllMocks()
  members = [member(OWNER)]
  maxTeamSize = 2
  persisted = []
  flushed = 0
  countCalls = []

  // The caller is the invitee accepting their own invitation.
  mockGetCustomerAuthFromRequest.mockResolvedValue({ sub: JOINER, tenantId: TENANT, orgId: 'org-1' })

  const em = {
    findOne: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity === teamEntities.TeamInvitation) {
        return {
          id: INVITATION,
          teamId: TEAM,
          competitionId: COMPETITION,
          type: 'invite',
          status: 'pending',
          inviteeId: JOINER,
          inviterId: OWNER,
          organizationId: 'org-1',
        }
      }
      if (entity === competitionEntities.CompetitionParticipation) {
        return { customerUserId: where.customerUserId, role: 'participant', lookingForTeam: false }
      }
      if (entity === teamEntities.TeamMember) {
        return members.find((row) => matches(row as unknown as Record<string, unknown>, where)) ?? null
      }
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
      throw new Error('unexpected entity in em.count')
    }),
    create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({ id: 'new-id', ...data })),
    persist: jest.fn((row: Record<string, unknown>) => {
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

describe('POST /api/teams/portal/respond-invitation accept — max team size (#109)', () => {
  it('refuses with 409 when the team filled up since the invitation was issued', async () => {
    members = [member(OWNER), member(SECOND_MEMBER)]

    const { status, body } = await accept()

    expect(status).toBe(409)
    expect(body).toEqual({ error: 'This team is already at its maximum size (2 members).' })
    // The seat must not have been taken.
    expect(persisted).toEqual([])
    expect(flushed).toBe(0)
  })

  it('still lets the last free seat be taken', async () => {
    const { status, body } = await accept()

    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(persisted.some((row) => row.customerUserId === JOINER && row.teamId === TEAM)).toBe(true)
    expect(flushed).toBeGreaterThan(0)
  })

  it('leaves an unconfigured cap uncapped', async () => {
    maxTeamSize = null
    members = [member(OWNER), member(SECOND_MEMBER)]

    const { status } = await accept()
    expect(status).toBe(200)
  })
})

describe('POST /api/teams/portal/respond-invitation accept — a departed member frees their seat (#109)', () => {
  it('does not charge the team for a member who has LEFT', async () => {
    members = [
      member(OWNER),
      member(DEPARTED_MEMBER, { leftAt: new Date('2026-03-01T00:00:00.000Z') }),
    ]

    const { status, body } = await accept()

    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(persisted.some((row) => row.customerUserId === JOINER)).toBe(true)
  })

  it('asks the database for active members only', async () => {
    await accept()
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
