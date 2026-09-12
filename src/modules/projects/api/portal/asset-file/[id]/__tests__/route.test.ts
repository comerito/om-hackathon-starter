/**
 * Route-handler tests for issue #117 — `GET /api/projects/portal/asset-file/[id]`.
 *
 * `projects/lib/__tests__/projectAssetAccess.test.ts` proves `canReadProjectAsset` answers the
 * right question. It proves nothing about the route, and #117 was entirely a route defect: the
 * handler checked `organizationId` and then streamed the bytes, so any logged-in participant could
 * read another team's screenshots and README by guessing an attachment id.
 *
 * These tests call the exported `GET` with a fake container / `em` and a stubbed file read, and
 * assert on the response a client would actually receive — status *and* the body, because a 403
 * that still carries the file is not a closed hole. The stub returns a recognisable marker string
 * so "no bytes leaked" is an assertion about real content, not about a length.
 */

import { promises as nodeFs } from 'fs'

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
jest.mock(
  '@open-mercato/core/modules/attachments/data/entities',
  () => ({ Attachment: class Attachment {} }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/core/modules/attachments/lib/storage',
  () => ({ resolveAttachmentAbsolutePath: () => '/tmp/project-asset-under-test.bin' }),
  { virtual: true },
)
// The entity modules pull in MikroORM decorators; the route only uses the classes as query tokens.
jest.mock('../../../../../data/entities', () => ({ Project: class Project {} }))
jest.mock('../../../../../../teams/data/entities', () => ({ TeamMember: class TeamMember {} }))
jest.mock('../../../../../../competitions/data/entities', () => ({
  CompetitionParticipation: class CompetitionParticipation {},
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require('../route') as typeof import('../route')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Attachment } = require('@open-mercato/core/modules/attachments/data/entities') as {
  Attachment: unknown
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Project } = require('../../../../../data/entities') as { Project: unknown }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TeamMember } = require('../../../../../../teams/data/entities') as { TeamMember: unknown }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CompetitionParticipation } = require('../../../../../../competitions/data/entities') as {
  CompetitionParticipation: unknown
}

const TENANT = '11111111-1111-4111-8111-111111111111'
const ORG = 'org-1'
const COMPETITION = '22222222-2222-4222-8222-222222222222'
const OWNING_TEAM = '33333333-3333-4333-8333-333333333333'
const PROJECT = '44444444-4444-4444-8444-444444444444'
const ATTACHMENT = '55555555-5555-4555-8555-555555555555'

const TEAM_MEMBER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_PARTICIPANT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const DEPARTED_MEMBER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const JUDGE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const OUTSIDER = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

/** What a leaked read would put in the body. Nothing but the allowed cases may contain it. */
const SECRET_BYTES = 'SECRET-PROJECT-SCREENSHOT-BYTES'

/** Every status a project can hold — the refusal must hold at all of them. */
const ALL_STATUSES = ['draft', 'published', 'under_review', 'scored'] as const

type MemberRow = {
  teamId: string
  customerUserId: string
  tenantId: string
  deletedAt: Date | null
  leftAt: Date | null
}

const MEMBERS: MemberRow[] = [
  { teamId: OWNING_TEAM, customerUserId: TEAM_MEMBER, tenantId: TENANT, deletedAt: null, leftAt: null },
  // Left the team: `leftAt` is set, so the route's `leftAt: null` filter must exclude them.
  {
    teamId: OWNING_TEAM,
    customerUserId: DEPARTED_MEMBER,
    tenantId: TENANT,
    deletedAt: null,
    leftAt: new Date('2026-02-01T00:00:00.000Z'),
  },
]

const PARTICIPATION_ROLES: Record<string, string> = {
  [TEAM_MEMBER]: 'participant',
  [OTHER_PARTICIPANT]: 'participant',
  [DEPARTED_MEMBER]: 'participant',
  [JUDGE]: 'judge',
}

/** Minimal equality matcher over the filters this route builds. */
function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key]
    if (cond === null) return value === null || value === undefined
    return value === cond
  })
}

let projectStatus: string
let attachmentEntityId: string
let attachmentOrgId: string | null
let attachmentTenantId: string | null

async function fetchAsset(
  caller: string,
): Promise<{ status: number; body: string; contentType: string | null }> {
  mockGetCustomerAuthFromRequest.mockResolvedValue({ sub: caller, tenantId: TENANT, orgId: ORG })
  const res = await GET(
    new Request(`http://localhost/api/projects/portal/asset-file/${ATTACHMENT}`) as never,
    { params: Promise.resolve({ id: ATTACHMENT }) },
  )
  return {
    status: res.status,
    body: await res.text(),
    contentType: res.headers.get('Content-Type'),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  projectStatus = 'published'
  attachmentEntityId = 'projects:project'
  attachmentOrgId = ORG
  attachmentTenantId = TENANT

  jest.spyOn(nodeFs, 'readFile').mockResolvedValue(Buffer.from(SECRET_BYTES))

  const em = {
    findOne: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity === Attachment) {
        return {
          id: ATTACHMENT,
          tenantId: attachmentTenantId,
          organizationId: attachmentOrgId,
          entityId: attachmentEntityId,
          recordId: PROJECT,
          partitionCode: 'p',
          storagePath: 'shot.png',
          storageDriver: 'local',
          mimeType: 'image/png',
          fileName: 'shot.png',
          fileSize: SECRET_BYTES.length,
        }
      }
      if (entity === Project) {
        return where.id === PROJECT
          ? { id: PROJECT, teamId: OWNING_TEAM, competitionId: COMPETITION, status: projectStatus }
          : null
      }
      if (entity === TeamMember) {
        return (
          MEMBERS.find((row) => matches(row as unknown as Record<string, unknown>, where)) ?? null
        )
      }
      if (entity === CompetitionParticipation) {
        const role = PARTICIPATION_ROLES[String(where.customerUserId)]
        return role ? { customerUserId: where.customerUserId, role } : null
      }
      throw new Error('unexpected entity in em.findOne')
    }),
  }
  mockCreateRequestContainer.mockResolvedValue({
    resolve: (name: string) => {
      if (name !== 'em') throw new Error(`unexpected container token: ${name}`)
      return em
    },
  })
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('GET project asset-file — a participant on another team (#117)', () => {
  it.each(ALL_STATUSES)('answers 403 with no bytes when the project is %s', async (status) => {
    projectStatus = status
    const res = await fetchAsset(OTHER_PARTICIPANT)

    expect(res.status).toBe(403)
    expect(res.body).toBe('{"error":"Forbidden"}')
    expect(res.body).not.toContain(SECRET_BYTES)
    expect(res.contentType).not.toBe('image/png')
    expect(nodeFs.readFile).not.toHaveBeenCalled()
  })

  it('answers 403 for a caller with no relationship to the competition at all', async () => {
    const res = await fetchAsset(OUTSIDER)
    // Body first, deliberately: when this fix is reverted the interesting failure is the file
    // contents in the response, not the status code.
    expect(res.body).not.toContain(SECRET_BYTES)
    expect(res.status).toBe(403)
  })

  it('answers 403 for someone who has LEFT the owning team', async () => {
    const res = await fetchAsset(DEPARTED_MEMBER)
    expect(res.status).toBe(403)
    expect(res.body).not.toContain(SECRET_BYTES)
  })
})

describe('GET project asset-file — who may read (#117)', () => {
  it.each(ALL_STATUSES)('serves the file to an active team member at status %s', async (status) => {
    projectStatus = status
    const res = await fetchAsset(TEAM_MEMBER)

    expect(res.status).toBe(200)
    expect(res.body).toBe(SECRET_BYTES)
    expect(res.contentType).toBe('image/png')
  })

  it('keeps a draft private from a judge of the same competition', async () => {
    projectStatus = 'draft'
    const res = await fetchAsset(JUDGE)
    expect(res.status).toBe(403)
    expect(res.body).not.toContain(SECRET_BYTES)
  })

  it.each(['published', 'under_review', 'scored'])(
    'serves a %s project to a judge of the competition',
    async (status) => {
      projectStatus = status
      const res = await fetchAsset(JUDGE)
      expect(res.status).toBe(200)
      expect(res.body).toBe(SECRET_BYTES)
    },
  )
})

describe('GET project asset-file — scope checks (#117)', () => {
  it('refuses an attachment that is not a project attachment, with no bytes', async () => {
    attachmentEntityId = 'documents:document'
    const res = await fetchAsset(TEAM_MEMBER)

    expect(res.status).toBe(403)
    expect(res.body).toBe('{"error":"Forbidden"}')
    expect(nodeFs.readFile).not.toHaveBeenCalled()
  })

  it('refuses an attachment belonging to another tenant', async () => {
    attachmentTenantId = '99999999-9999-4999-8999-999999999999'
    const res = await fetchAsset(TEAM_MEMBER)
    expect(res.status).toBe(403)
    expect(res.body).not.toContain(SECRET_BYTES)
  })

  it('refuses an attachment belonging to another organization', async () => {
    attachmentOrgId = 'org-2'
    const res = await fetchAsset(TEAM_MEMBER)
    expect(res.status).toBe(403)
    expect(res.body).not.toContain(SECRET_BYTES)
  })

  it('answers 401 without a customer session, before resolving the container', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(null)
    const res = await GET(
      new Request(`http://localhost/api/projects/portal/asset-file/${ATTACHMENT}`) as never,
      { params: Promise.resolve({ id: ATTACHMENT }) },
    )
    expect(res.status).toBe(401)
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })
})

export {}
