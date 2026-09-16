/**
 * Wiring regression tests for `/api/competitions/portal/update-profile`.
 *
 * The avatar bug was not a defect in any single function — `avatarUrls.ts` is unit-tested on its
 * own — it was a *wiring* defect: the API handed the browser a URL only a backoffice session could
 * read, and every avatar rendered as a broken image. So the thing worth pinning down here is the
 * boundary itself: what shape of `avatar_url` leaves this route, and what shape reaches the column.
 */

const mockGetCustomerAuthFromRequest = jest.fn()
const mockCreateRequestContainer = jest.fn()
const mockRawFirst = jest.fn()
const mockRawRun = jest.fn()

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
jest.mock('@/lib/db', () => ({
  rawFirst: (...args: unknown[]) => mockRawFirst(...args),
  rawRun: (...args: unknown[]) => mockRawRun(...args),
}))
// The entity module pulls in MikroORM decorators; the route only uses the classes as query tokens.
jest.mock('../../../../data/entities', () => ({
  ParticipantProfile: class ParticipantProfile {},
  CompetitionParticipation: class CompetitionParticipation {},
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET, PUT } = require('../route') as typeof import('../route')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ParticipantProfile, CompetitionParticipation } =
  require('../../../../data/entities') as {
    ParticipantProfile: unknown
    CompetitionParticipation: unknown
  }

const TENANT = '11111111-1111-4111-8111-111111111111'
const ORG = 'org-1'
const CALLER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ATTACHMENT = '55555555-5555-4555-8555-555555555555'

/** What the upload route writes into the column — unreadable from a portal session. */
const STORED_URL = `/api/attachments/file/${ATTACHMENT}`
/** What the portal must receive instead. */
const PORTAL_URL = `/api/competitions/portal/avatars/${ATTACHMENT}`

let profile: Record<string, unknown>

beforeEach(() => {
  jest.clearAllMocks()
  profile = { id: 'profile-1', avatarUrl: STORED_URL, skills: [], socialLinks: {} }

  mockGetCustomerAuthFromRequest.mockResolvedValue({ sub: CALLER, tenantId: TENANT, orgId: ORG })
  mockRawFirst.mockResolvedValue({ display_name: 'Ada' })
  mockRawRun.mockResolvedValue(undefined)

  const em = {
    findOne: jest.fn(async (entity: unknown) => {
      if (entity === ParticipantProfile) return profile
      if (entity === CompetitionParticipation) return { githubUsername: null }
      throw new Error('unexpected entity in em.findOne')
    }),
    persist: jest.fn(),
    flush: jest.fn(async () => undefined),
  }
  mockCreateRequestContainer.mockResolvedValue({
    resolve: (name: string) => {
      if (name !== 'em') throw new Error(`unexpected container token: ${name}`)
      return em
    },
  })
})

describe('GET update-profile', () => {
  it('returns the portal-servable avatar URL, not the stored attachment URL', async () => {
    const res = await GET(new Request('http://localhost/api/competitions/portal/update-profile'))
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.profile.avatar_url).toBe(PORTAL_URL)
    expect(payload.profile.avatar_url).not.toContain('/api/attachments/')
  })

  it('passes an external avatar URL through unchanged', async () => {
    profile.avatarUrl = 'https://avatars.githubusercontent.com/u/1?v=4'
    const res = await GET(new Request('http://localhost/api/competitions/portal/update-profile'))
    const payload = await res.json()

    expect(payload.profile.avatar_url).toBe('https://avatars.githubusercontent.com/u/1?v=4')
  })

  it('reports no avatar as null', async () => {
    profile.avatarUrl = null
    const res = await GET(new Request('http://localhost/api/competitions/portal/update-profile'))
    const payload = await res.json()

    expect(payload.profile.avatar_url).toBeNull()
  })
})

describe('PUT update-profile', () => {
  async function put(body: Record<string, unknown>) {
    const res = await PUT(
      new Request('http://localhost/api/competitions/portal/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    )
    return { status: res.status, payload: await res.json() }
  }

  it('normalises a round-tripped portal URL back to the canonical one before storing', async () => {
    const res = await put({ avatar_url: `${PORTAL_URL}?width=128` })

    expect(res.status).toBe(200)
    expect(profile.avatarUrl).toBe(STORED_URL)
    // ...and still answers with the portal shape.
    expect(res.payload.profile.avatar_url).toBe(PORTAL_URL)
  })

  it('leaves the stored avatar alone when the body does not mention it', async () => {
    const res = await put({ bio: 'hello' })

    expect(profile.avatarUrl).toBe(STORED_URL)
    expect(res.payload.profile.avatar_url).toBe(PORTAL_URL)
  })
})

export {}
