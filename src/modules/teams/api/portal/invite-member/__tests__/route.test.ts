/**
 * Route-handler tests for issue #109, invite path —
 * `POST /api/teams/portal/invite-member`.
 *
 * `teams/lib/__tests__/team-size.test.ts` proves `canInviteToTeam` and `activeTeamMemberFilter`
 * are right. It proves nothing about the route, and #109 was a route defect: `max_team_size` was
 * configured, displayed on a progress bar, and enforced nowhere.
 *
 * These tests call the exported `POST` against a fake `em` whose `count` applies whatever filter
 * the route passes it — so the second half of the fix (the remediation commit that stopped
 * counting departed members) is pinned by construction: drop `leftAt: null` from
 * `activeTeamMemberFilter` and a team with a free seat starts refusing invitations again.
 *
 * Every refusal also asserts nothing was persisted or flushed.
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
// the enums as plain values, reproduced verbatim here.
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
const INVITEE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

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

/** Minimal equality matcher over the filters these routes build. */
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
/** Every `(entity, where)` pair the route passed to `em.count`, for the filter assertion below. */
let countCalls: [unknown, Record<string, unknown>][]

async function invite() {
  const res = await POST(
    new Request('http://localhost/api/teams/portal/invite-member', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ team_id: TEAM, invitee_id: INVITEE }),
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

  mockGetCustomerAuthFromRequest.mockResolvedValue({ sub: OWNER, tenantId: TENANT, orgId: 'org-1' })

  const em = {
    findOne: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity === teamEntities.TeamMember) {
        return members.find((row) => matches(row as unknown as Record<string, unknown>, where)) ?? null
      }
      if (entity === teamEntities.Team) {
        return { id: TEAM, competitionId: COMPETITION, organizationId: 'org-1' }
      }
      if (entity === competitionEntities.CompetitionParticipation) {
        return { customerUserId: where.customerUserId, role: 'participant' }
      }
      if (entity === teamEntities.TeamInvitation) return null
      if (entity === competitionEntities.Competition) {
        return { id: COMPETITION, maxTeamSize, minTeamSize: null }
      }
      throw new Error('unexpected entity in em.findOne')
    }),
    // The point of the whole fixture: `count` honours the filter the route hands it, so an
    // `activeTeamMemberFilter` missing `leftAt: null` really does count a departed member.
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

describe('POST /api/teams/portal/invite-member — max team size (#109)', () => {
  it('refuses with 409 when the team is already at its cap, and writes nothing', async () => {
    members = [member(OWNER), member(SECOND_MEMBER)]

    const { status, body } = await invite()

    expect(status).toBe(409)
    expect(body).toEqual({ error: 'This team is full (2 of 2 members).' })
    expect(persisted).toEqual([])
    expect(flushed).toBe(0)
  })

  it('counts pending invitations against the cap and says so', async () => {
    pendingInvitationCount = 1 // 1 member + 1 pending invite = 2 of 2

    const { status, body } = await invite()

    expect(status).toBe(409)
    expect(body.error).toBe(
      'This team is full (1 member(s) plus 1 pending invitation(s), limit 2). Cancel a pending invitation first.',
    )
    expect(persisted).toEqual([])
    expect(flushed).toBe(0)
  })

  it('still allows an invitation while a seat is free', async () => {
    const { status, body } = await invite()
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(flushed).toBe(1)
  })

  it('leaves an unconfigured cap uncapped', async () => {
    maxTeamSize = null
    members = [member(OWNER), member(SECOND_MEMBER), member(INVITEE + '-x')]

    const { status } = await invite()
    expect(status).toBe(200)
  })
})

describe('POST /api/teams/portal/invite-member — a departed member frees their seat (#109)', () => {
  it('does not charge the team for a member who has LEFT', async () => {
    // 2 rows, cap 2 — but one of them left, so there is a free seat.
    members = [
      member(OWNER),
      member(DEPARTED_MEMBER, { leftAt: new Date('2026-03-01T00:00:00.000Z') }),
    ]

    const { status, body } = await invite()

    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(flushed).toBe(1)
  })

  it('does not charge the team for a soft-deleted membership row either', async () => {
    members = [
      member(OWNER),
      member(SECOND_MEMBER, { deletedAt: new Date('2026-03-01T00:00:00.000Z') }),
    ]

    const { status } = await invite()
    expect(status).toBe(200)
  })

  it('asks the database for active members only', async () => {
    await invite()
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
