/**
 * Route-handler tests for `POST /api/competitions/admin/thank-you-emails`.
 *
 * What matters is the sent marker: only participations whose email actually left
 * receive `thankYouEmailSentAt`, already-thanked rows are never emailed twice, and
 * the marker is flushed per batch so a later failure cannot cause a double send.
 */

export {}

const mockGetAuthFromRequest = jest.fn()
const mockCreateRequestContainer = jest.fn()
const mockResolveOrganizationScopeForRequest = jest.fn()
const mockRunRouteMutationGuards = jest.fn()
const mockFindWithDecryption = jest.fn()
const mockSendThankYouEmail = jest.fn()

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
jest.mock('../../../../lib/sendThankYouEmail', () => ({
  sendThankYouEmail: (...args: unknown[]) => mockSendThankYouEmail(...args),
}))
jest.mock('../../../../lib/thankYouEmails', () => {
  const actual = jest.requireActual('../../../../lib/thankYouEmails') as typeof import('../../../../lib/thankYouEmails')
  return { ...actual, THANK_YOU_EMAIL_BATCH_DELAY_MS: 0 }
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
const PHOTOS_URL = 'https://drive.google.com/drive/folders/example'

type ParticipationRow = {
  id: string
  competitionId: string
  customerUserId: string
  tenantId: string
  organizationId: string
  deletedAt: Date | null
  thankYouEmailSentAt: Date | null
}

type UserRow = {
  id: string
  email: string
  displayName: string
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
    thankYouEmailSentAt: null,
    ...overrides,
  }
}

function userFor(row: ParticipationRow, email: string, displayName = ''): UserRow {
  return { id: row.customerUserId, email, displayName, tenantId: TENANT, deletedAt: null }
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
      if (entity !== entities.Competition) return null
      if (where.id !== COMPETITION_ID || where.tenantId !== TENANT || where.deletedAt !== null) return null
      return { id: COMPETITION_ID, name: 'HackOn 2026', tenantId: TENANT, organizationId: ORG, deletedAt: null }
    }),
    find: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity !== entities.CompetitionParticipation) return []
      return participations.filter((row) => matchesWhere(row as unknown as Record<string, unknown>, where))
    }),
    flush: (...args: unknown[]) => emFlush(...args),
  }
}

function request(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/competitions/admin/thank-you-emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function callPost(ids: string[], photosUrl = PHOTOS_URL): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await POST(
    request({
      competition_id: COMPETITION_ID,
      photos_url: photosUrl,
      selection: { mode: 'selected', participation_ids: ids },
    }),
  )
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
  mockFindWithDecryption.mockImplementation(async (_em: unknown, entity: unknown, where: Record<string, unknown>) => {
    if (entity !== CustomerUser) return []
    return users.filter((row) => matchesWhere(row as unknown as Record<string, unknown>, where))
  })
  mockSendThankYouEmail.mockResolvedValue(undefined)
  const em = makeEm()
  mockCreateRequestContainer.mockResolvedValue({
    resolve: (name: string) => {
      if (name !== 'em') throw new Error(`unexpected container token: ${name}`)
      return em
    },
  })
})

describe('POST /api/competitions/admin/thank-you-emails — delivery and persistence', () => {
  it('emails every selected participant with the competition name and photos link, then marks them sent', async () => {
    const one = participation(1)
    const two = participation(2)
    participations = [one, two]
    users = [userFor(one, 'Ada@Example.com', 'Ada Lovelace'), userFor(two, 'grace@example.com')]

    const { status, body } = await callPost([one.id, two.id])

    expect(status).toBe(200)
    expect(body).toMatchObject({ ok: true, status: 'complete', sent: 2, failed: 0 })
    expect(mockSendThankYouEmail).toHaveBeenCalledWith({
      to: 'ada@example.com',
      competitionName: 'HackOn 2026',
      displayName: 'Ada Lovelace',
      photosUrl: PHOTOS_URL,
    })
    // No display name on the account → fall back to the email local part.
    expect(mockSendThankYouEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'grace@example.com', displayName: 'grace' }))
    expect(one.thankYouEmailSentAt).toBeInstanceOf(Date)
    expect(two.thankYouEmailSentAt).toBeInstanceOf(Date)
    expect(JSON.stringify(body)).not.toContain('@example.com')
  })

  it('marks only delivered items and answers 207 when some emails fail', async () => {
    const one = participation(1)
    const two = participation(2)
    const noEmail = participation(3)
    participations = [one, two, noEmail]
    users = [userFor(one, 'ada@example.com'), userFor(two, 'grace@example.com')]
    mockSendThankYouEmail.mockImplementation(async ({ to }: { to: string }) => {
      if (to === 'grace@example.com') throw new Error('RESEND_SEND_FAILED: rate limited')
    })

    const { status, body } = await callPost([one.id, two.id, noEmail.id])

    expect(status).toBe(207)
    expect(body).toMatchObject({ ok: false, status: 'partial', sent: 1, failed: 2 })
    expect(one.thankYouEmailSentAt).toBeInstanceOf(Date)
    expect(two.thankYouEmailSentAt).toBeNull()
    expect(noEmail.thankYouEmailSentAt).toBeNull()
    expect(mockSendThankYouEmail).toHaveBeenCalledTimes(2)
  })

  it('flushes after every batch of 4 so a delivered email stays marked', async () => {
    participations = Array.from({ length: 9 }, (_, index) => participation(index + 1))
    users = participations.map((row, index) => userFor(row, `user${index}@example.com`))

    const { status, body } = await callPost(participations.map((row) => row.id))

    expect(status).toBe(200)
    expect(body.sent).toBe(9)
    expect(emFlush).toHaveBeenCalledTimes(3)
  })

  it('skips already-thanked ids and does not email them again', async () => {
    const unsent = participation(1)
    const sentAt = new Date('2026-09-19T10:00:00.000Z')
    const sent = participation(2, { thankYouEmailSentAt: sentAt })
    participations = [unsent, sent]
    users = [userFor(unsent, 'ada@example.com'), userFor(sent, 'grace@example.com')]

    const { status, body } = await callPost([unsent.id, sent.id])

    expect(status).toBe(200)
    expect(body.sent).toBe(1)
    expect(mockSendThankYouEmail).toHaveBeenCalledTimes(1)
    expect(sent.thankYouEmailSentAt).toEqual(sentAt)
  })

  it('sends nothing when every selected id was already thanked', async () => {
    const sent = participation(1, { thankYouEmailSentAt: new Date('2026-09-19T10:00:00.000Z') })
    participations = [sent]

    const { status, body } = await callPost([sent.id])

    expect(status).toBe(400)
    expect(body).toEqual({ error: 'Everyone in this selection already received the thank-you email' })
    expect(mockSendThankYouEmail).not.toHaveBeenCalled()
    expect(emFlush).not.toHaveBeenCalled()
  })
})

describe('POST /api/competitions/admin/thank-you-emails — validation and scoping', () => {
  it('rejects a photos link that is not http(s)', async () => {
    const one = participation(1)
    participations = [one]

    const { status } = await callPost([one.id], 'javascript:alert(1)')

    expect(status).toBe(422)
    expect(mockSendThankYouEmail).not.toHaveBeenCalled()
  })

  it('rejects selected ids that belong to another competition', async () => {
    const local = participation(1)
    const foreign = participation(2, { competitionId: OTHER_COMPETITION_ID })
    participations = [local, foreign]

    const { status, body } = await callPost([local.id, foreign.id])

    expect(status).toBe(400)
    expect(body).toEqual({ error: 'Some participants were not found in this competition' })
    expect(mockSendThankYouEmail).not.toHaveBeenCalled()
  })

  it('rejects selected ids from another organization in the current tenant', async () => {
    const local = participation(1)
    const otherOrg = participation(2, { organizationId: OTHER_ORG })
    participations = [local, otherOrg]

    const { status } = await callPost([local.id, otherOrg.id])

    expect(status).toBe(400)
    expect(mockSendThankYouEmail).not.toHaveBeenCalled()
  })

  it('returns the guard response when a mutation guard blocks the send', async () => {
    const one = participation(1)
    participations = [one]
    mockRunRouteMutationGuards.mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'Locked' }, { status: 423 }),
    })

    const { status } = await callPost([one.id])

    expect(status).toBe(423)
    expect(mockSendThankYouEmail).not.toHaveBeenCalled()
  })

  it('answers 401 when there is no staff session', async () => {
    mockGetAuthFromRequest.mockResolvedValue(null)

    const { status } = await callPost([uuid(1)])

    expect(status).toBe(401)
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })
})
