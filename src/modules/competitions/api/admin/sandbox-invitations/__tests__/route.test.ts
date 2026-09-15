/**
 * Route-handler tests for `POST /api/competitions/admin/sandbox-invitations`.
 *
 * The finish line for SPEC-006 Stage 1 is persistence: only accepted upstream
 * items receive `mercatoSandboxesInvitedAt`. These tests drive the exported
 * handler with a mocked om-crm client so a 200, a 207, a conflict, a network
 * failure, missing config, and a 101-item selection are all observable from
 * the response the backoffice would receive.
 */

export {}

const mockGetAuthFromRequest = jest.fn()
const mockCreateRequestContainer = jest.fn()
const mockResolveOrganizationScopeForRequest = jest.fn()
const mockRunRouteMutationGuards = jest.fn()
const mockFindWithDecryption = jest.fn()
const mockReadOmCrmSandboxInvitationConfig = jest.fn()
const mockSendOmCrmBulkCustomerInvitations = jest.fn()

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
  },
}))

jest.mock(
  '@open-mercato/shared/lib/auth/server',
  () => ({ getAuthFromRequest: (...args: unknown[]) => mockGetAuthFromRequest(...args) }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/shared/lib/di/container',
  () => ({ createRequestContainer: (...args: unknown[]) => mockCreateRequestContainer(...args) }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/core/modules/directory/utils/organizationScope',
  () => ({
    resolveOrganizationScopeForRequest: (...args: unknown[]) =>
      mockResolveOrganizationScopeForRequest(...args),
  }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/shared/lib/crud/route-mutation-guard',
  () => ({ runRouteMutationGuards: (...args: unknown[]) => mockRunRouteMutationGuards(...args) }),
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
jest.mock('../../../../data/entities', () => ({
  Competition: class Competition {},
  CompetitionParticipation: class CompetitionParticipation {},
}))
jest.mock('../../../../lib/omCrmSandboxInvitations', () => {
  const actual = jest.requireActual('../../../../lib/omCrmSandboxInvitations') as typeof import('../../../../lib/omCrmSandboxInvitations')
  return {
    ...actual,
    readOmCrmSandboxInvitationConfig: (...args: unknown[]) => mockReadOmCrmSandboxInvitationConfig(...args),
    sendOmCrmBulkCustomerInvitations: (...args: unknown[]) => mockSendOmCrmBulkCustomerInvitations(...args),
  }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST } = require('../route') as typeof import('../route')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const entities = require('../../../../data/entities') as {
  Competition: unknown
  CompetitionParticipation: unknown
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CustomerUser } = require('@open-mercato/core/modules/customer_accounts/data/entities') as {
  CustomerUser: unknown
}

const TENANT = '11111111-1111-4111-8111-111111111111'
const ORG = '22222222-2222-4222-8222-222222222222'
const OTHER_ORG = '33333333-3333-4333-8333-333333333333'
const STAFF = '44444444-4444-4444-8444-444444444444'
const COMPETITION_ID = '55555555-5555-4555-8555-555555555555'
const OTHER_COMPETITION_ID = '66666666-6666-4666-8666-666666666666'

type ParticipationRow = {
  id: string
  competitionId: string
  customerUserId: string
  tenantId: string
  organizationId: string
  deletedAt: Date | null
  mercatoSandboxesInvitedAt: Date | null
}

type UserRow = {
  id: string
  email: string
  tenantId: string
  deletedAt: Date | null
}

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

function participation(n: number, overrides: Partial<ParticipationRow> = {}): ParticipationRow {
  return {
    id: uuid(n),
    competitionId: COMPETITION_ID,
    customerUserId: uuid(1000 + n),
    tenantId: TENANT,
    organizationId: ORG,
    deletedAt: null,
    mercatoSandboxesInvitedAt: null,
    ...overrides,
  }
}

function userFor(row: ParticipationRow, email = `user-${row.id.slice(-4)}@example.com`): UserRow {
  return {
    id: row.customerUserId,
    email,
    tenantId: TENANT,
    deletedAt: null,
  }
}

function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (cond && typeof cond === 'object' && '$in' in (cond as { $in?: unknown[] })) {
      return ((cond as { $in: unknown[] }).$in ?? []).includes(row[key])
    }
    return row[key] === cond
  })
}

let participations: ParticipationRow[] = []
let users: UserRow[] = []
let emFlush: jest.Mock

function makeEm() {
  emFlush = jest.fn(async () => undefined)
  return {
    findOne: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity === entities.Competition) {
        if (where.id !== COMPETITION_ID) return null
        if (where.tenantId !== TENANT) return null
        if (where.deletedAt !== null) return null
        if (
          where.organizationId
          && typeof where.organizationId === 'object'
          && '$in' in (where.organizationId as { $in?: string[] })
          && !(where.organizationId as { $in: string[] }).$in.includes(ORG)
        ) {
          return null
        }
        return { id: COMPETITION_ID, tenantId: TENANT, organizationId: ORG, deletedAt: null }
      }
      return null
    }),
    find: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity !== entities.CompetitionParticipation) return []
      return participations.filter((row) => matchesWhere(row as unknown as Record<string, unknown>, where))
    }),
    flush: (...args: unknown[]) => emFlush(...args),
  }
}

function container(em: unknown) {
  return {
    resolve: (name: string) => {
      if (name !== 'em') throw new Error(`unexpected container token: ${name}`)
      return em
    },
  }
}

function request(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/competitions/admin/sandbox-invitations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function callPost(body: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await POST(request(body))
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

beforeEach(() => {
  jest.clearAllMocks()
  participations = []
  users = []
  mockGetAuthFromRequest.mockResolvedValue({ sub: STAFF, tenantId: TENANT, orgId: ORG })
  mockResolveOrganizationScopeForRequest.mockResolvedValue({
    selectedId: ORG,
    filterIds: [ORG],
    allowedIds: [ORG],
    tenantId: TENANT,
  })
  mockRunRouteMutationGuards.mockResolvedValue({
    ok: true,
    modifiedPayload: undefined,
    runAfterSuccess: jest.fn(async () => undefined),
  })
  mockReadOmCrmSandboxInvitationConfig.mockReturnValue({
    ok: true,
    config: { baseUrl: 'https://crm.example.test', apiKey: 'omk_test_key' },
  })
  mockFindWithDecryption.mockImplementation(async (_em: unknown, entity: unknown, where: Record<string, unknown>) => {
    if (entity !== CustomerUser) return []
    return users.filter((row) => matchesWhere(row as unknown as Record<string, unknown>, where))
  })
  mockCreateRequestContainer.mockResolvedValue(container(makeEm()))
})

describe('POST /api/competitions/admin/sandbox-invitations — persistence', () => {
  it('marks only accepted items as sent on a partial 207, including a 101-item selection sent in one request', async () => {
    participations = Array.from({ length: 101 }, (_, index) => participation(index + 1))
    users = participations.map((row, index) => userFor(row, `user${index}@example.com`))
    mockSendOmCrmBulkCustomerInvitations.mockResolvedValue({
      ok: true,
      httpStatus: 207,
      status: 'partial',
      results: participations.map((_, index) => ({
        index,
        invitationStatus: index === 0 ? 'accepted' : index === 1 ? 'conflict' : index === 2 ? 'failed' : 'accepted',
      })),
    })

    const { status, body } = await callPost({
      competition_id: COMPETITION_ID,
      selection: { mode: 'selected', participation_ids: participations.map((row) => row.id) },
    })

    expect(status).toBe(207)
    expect(body.sent).toBe(99)
    expect(body.conflicts).toBe(1)
    expect(body.failed).toBe(1)
    expect(body.results).toHaveLength(101)
    expect(JSON.stringify(body)).not.toContain('@example.com')
    expect(JSON.stringify(body)).not.toContain('omk_test_key')
    expect(mockSendOmCrmBulkCustomerInvitations).toHaveBeenCalledTimes(1)
    const sentCustomers = mockSendOmCrmBulkCustomerInvitations.mock.calls[0][1] as Array<{ email: string }>
    expect(sentCustomers).toHaveLength(101)

    expect(participations[0]?.mercatoSandboxesInvitedAt).toBeInstanceOf(Date)
    expect(participations[1]?.mercatoSandboxesInvitedAt).toBeNull()
    expect(participations[2]?.mercatoSandboxesInvitedAt).toBeNull()
    expect(participations[3]?.mercatoSandboxesInvitedAt).toBeInstanceOf(Date)
    expect(emFlush).toHaveBeenCalledTimes(1)
  })

  it('marks every accepted item on a 200 complete response', async () => {
    const one = participation(1)
    const two = participation(2)
    participations = [one, two]
    users = [userFor(one, 'ada@example.com'), userFor(two, 'grace@example.com')]
    mockSendOmCrmBulkCustomerInvitations.mockResolvedValue({
      ok: true,
      httpStatus: 200,
      status: 'complete',
      results: [
        { index: 0, invitationStatus: 'accepted' },
        { index: 1, invitationStatus: 'accepted' },
      ],
    })

    const { status, body } = await callPost({
      competition_id: COMPETITION_ID,
      selection: { mode: 'selected', participation_ids: [one.id, two.id] },
    })

    expect(status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      status: 'complete',
      sent: 2,
      conflicts: 0,
      failed: 0,
    })
    expect(one.mercatoSandboxesInvitedAt).toBeInstanceOf(Date)
    expect(two.mercatoSandboxesInvitedAt).toBeInstanceOf(Date)
    expect(emFlush).toHaveBeenCalledTimes(1)
  })

  it('does not write a timestamp when the upstream request fails', async () => {
    const one = participation(1)
    participations = [one]
    users = [userFor(one)]
    mockSendOmCrmBulkCustomerInvitations.mockResolvedValue({
      ok: false,
      error: 'Could not reach Mercato Sandboxes.',
    })

    const { status, body } = await callPost({
      competition_id: COMPETITION_ID,
      selection: { mode: 'selected', participation_ids: [one.id] },
    })

    expect(status).toBe(502)
    expect(body).toEqual({ error: 'Could not reach Mercato Sandboxes.' })
    expect(one.mercatoSandboxesInvitedAt).toBeNull()
    expect(emFlush).not.toHaveBeenCalled()
  })

  it('does not write a timestamp when om-crm is not configured', async () => {
    const one = participation(1)
    participations = [one]
    users = [userFor(one)]
    mockReadOmCrmSandboxInvitationConfig.mockReturnValue({
      ok: false,
      error: 'Mercato Sandboxes invitation is not configured.',
    })

    const { status, body } = await callPost({
      competition_id: COMPETITION_ID,
      selection: { mode: 'selected', participation_ids: [one.id] },
    })

    expect(status).toBe(503)
    expect(body).toEqual({ error: 'Mercato Sandboxes invitation is not configured.' })
    expect(mockSendOmCrmBulkCustomerInvitations).not.toHaveBeenCalled()
    expect(one.mercatoSandboxesInvitedAt).toBeNull()
    expect(emFlush).not.toHaveBeenCalled()
  })
})

describe('POST /api/competitions/admin/sandbox-invitations — scoping', () => {
  it('rejects selected ids that belong to another competition', async () => {
    const local = participation(1)
    const foreign = participation(2, { competitionId: OTHER_COMPETITION_ID })
    participations = [local, foreign]
    users = [userFor(local), userFor(foreign)]

    const { status, body } = await callPost({
      competition_id: COMPETITION_ID,
      selection: { mode: 'selected', participation_ids: [local.id, foreign.id] },
    })

    expect(status).toBe(400)
    expect(body).toEqual({ error: 'Some participants were not found in this competition' })
    expect(mockSendOmCrmBulkCustomerInvitations).not.toHaveBeenCalled()
    expect(emFlush).not.toHaveBeenCalled()
  })

  it('rejects selected ids from another organization in the current tenant', async () => {
    const local = participation(1)
    const otherOrg = participation(2, { organizationId: OTHER_ORG })
    participations = [local, otherOrg]

    const { status } = await callPost({
      competition_id: COMPETITION_ID,
      selection: { mode: 'selected', participation_ids: [local.id, otherOrg.id] },
    })

    expect(status).toBe(400)
    expect(mockSendOmCrmBulkCustomerInvitations).not.toHaveBeenCalled()
  })

  it('skips already-sent ids in a selected payload and does not re-invite them', async () => {
    const unsent = participation(1)
    const sentAt = new Date('2026-09-01T10:00:00.000Z')
    const sent = participation(2, { mercatoSandboxesInvitedAt: sentAt })
    participations = [unsent, sent]
    users = [userFor(unsent), userFor(sent)]
    mockSendOmCrmBulkCustomerInvitations.mockResolvedValue({
      ok: true,
      httpStatus: 200,
      status: 'complete',
      results: [{ index: 0, invitationStatus: 'accepted' }],
    })

    const { status, body } = await callPost({
      competition_id: COMPETITION_ID,
      selection: { mode: 'selected', participation_ids: [unsent.id, sent.id] },
    })

    expect(status).toBe(200)
    expect(body.sent).toBe(1)
    expect(mockSendOmCrmBulkCustomerInvitations.mock.calls[0][1]).toHaveLength(1)
    expect(unsent.mercatoSandboxesInvitedAt).toBeInstanceOf(Date)
    expect(sent.mercatoSandboxesInvitedAt).toEqual(sentAt)
  })

  it('does not call om-crm when every selected id is already sent', async () => {
    const sent = participation(1, { mercatoSandboxesInvitedAt: new Date('2026-09-01T10:00:00.000Z') })
    participations = [sent]
    users = [userFor(sent)]

    const { status, body } = await callPost({
      competition_id: COMPETITION_ID,
      selection: { mode: 'selected', participation_ids: [sent.id] },
    })

    expect(status).toBe(400)
    expect(body).toEqual({ error: 'No unsent participants in this selection' })
    expect(mockSendOmCrmBulkCustomerInvitations).not.toHaveBeenCalled()
    expect(mockFindWithDecryption).not.toHaveBeenCalled()
    expect(emFlush).not.toHaveBeenCalled()
  })

  it('answers 401 when there is no staff session', async () => {
    mockGetAuthFromRequest.mockResolvedValue(null)
    mockCreateRequestContainer.mockRejectedValue(new Error('container must not be resolved for an anonymous caller'))

    const { status } = await callPost({
      competition_id: COMPETITION_ID,
      selection: { mode: 'selected', participation_ids: [uuid(1)] },
    })

    expect(status).toBe(401)
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })
})
