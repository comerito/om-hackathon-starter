/**
 * Route-handler regression tests for issue #118 — the portal results export.
 *
 * ## Why these live at the route
 *
 * `judging/lib/__tests__/portalAuth.test.ts` and `.../resultsScope.test.ts` prove the helpers
 * decide correctly. Neither proves the route *calls* them: deleting the `requirePortalFeatures`
 * call from `api/portal/export-results/route.ts` leaves the whole suite green, and that is the
 * hole #118 reported. These tests drive the exported `GET` handler and assert on the response a
 * portal client would actually receive — including that the CSV body is absent, not merely that
 * the status is 403.
 *
 * The feature lists come from the module's real `setup.ts`. That is load-bearing here: the
 * original gate was `portal.judging.results.view`, which every attendee already holds, so a
 * hand-written feature list would have let the same non-gate pass its own test. Asserting
 * against `defaultCustomerRoleFeatures` is what makes "participant cannot export" a real claim.
 */

import setup from '../../../../setup'
import {
  PORTAL_RESULTS_EXPORT_FEATURE,
  PORTAL_RESULTS_FEATURE,
} from '../../../../lib/portalAuth'
import { RESULTS_NOT_PUBLISHED_MESSAGE } from '../../../../lib/resultsScope'
import { CompetitionStage } from '../../../../../competitions/data/entities'

const mockGetCustomerAuthFromRequest = jest.fn()
const mockCreateRequestContainer = jest.fn()
const mockRawAll = jest.fn()

jest.mock(
  '@open-mercato/core/modules/customer_accounts/lib/customerAuth',
  () => ({ getCustomerAuthFromRequest: (...args: unknown[]) => mockGetCustomerAuthFromRequest(...args) }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/shared/lib/di/container',
  () => ({ createRequestContainer: (...args: unknown[]) => mockCreateRequestContainer(...args) }),
  { virtual: true },
)
jest.mock('@/lib/db', () => ({ rawAll: (...args: unknown[]) => mockRawAll(...args) }))
jest.mock('@/lib/portal-translations', () => ({
  resolvePortalLocale: jest.fn(async () => 'en'),
  applyPortalTranslationOverlays: jest.fn(async (rows: unknown) => rows),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require('../route') as typeof import('../route')

const TENANT = '00000000-0000-4000-8000-0000000000a1'
const ORG = '00000000-0000-4000-8000-0000000000b1'
const CALLER_ID = '11111111-1111-4111-8111-111111111111'
const COMPETITION_ID = '33333333-3333-4333-8333-333333333333'

const PARTICIPANT_FEATURES = setup.defaultCustomerRoleFeatures?.participant ?? []
const MENTOR_FEATURES = setup.defaultCustomerRoleFeatures?.mentor ?? []
const JUDGE_FEATURES = setup.defaultCustomerRoleFeatures?.judge ?? []

const LEADERBOARD_ROWS = [{
  id: 'project-1',
  title: 'Secret Project',
  team_name: 'Team Alpha',
  status: 'submitted',
  rank: 1,
  avg_score: 91.5,
  peer_vote_count: 7,
  is_finalist: true,
}]

function auth(features: string[]) {
  return { sub: CALLER_ID, tenantId: TENANT, orgId: ORG, resolvedFeatures: features }
}

function makeEm(competition: { id: string; stage: string } | null) {
  return { findOne: jest.fn(async (_entity: unknown, _filter: unknown) => competition) }
}

function container(em: unknown) {
  return { resolve: (key: string) => (key === 'em' ? em : undefined) }
}

function request(query = `?competition_id=${COMPETITION_ID}`): Request {
  return new Request(`http://localhost/api/judging/portal/export-results${query}`)
}

/** The fix is worthless if the refusal still ships the ranking. */
async function expectNoCsv(res: Response) {
  expect(res.headers.get('Content-Type')).not.toMatch(/text\/csv/)
  expect(res.headers.get('Content-Disposition')).toBeNull()
  const text = await res.text()
  expect(text).not.toContain('Secret Project')
  expect(text).not.toContain('Team Alpha')
  expect(text).not.toContain('Rank,Project,Team')
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRawAll.mockResolvedValue(LEADERBOARD_ROWS)
})

describe('portal export-results — the feature gate (#118)', () => {
  it('the export feature is a real gate: only `judge` holds it, though everyone holds the view feature', () => {
    // If this flips, the gate below is decorative — which is exactly what #118 was.
    expect(JUDGE_FEATURES).toContain(PORTAL_RESULTS_EXPORT_FEATURE)
    expect(PARTICIPANT_FEATURES).not.toContain(PORTAL_RESULTS_EXPORT_FEATURE)
    expect(MENTOR_FEATURES).not.toContain(PORTAL_RESULTS_EXPORT_FEATURE)
    expect(PARTICIPANT_FEATURES).toContain(PORTAL_RESULTS_FEATURE)
    expect(MENTOR_FEATURES).toContain(PORTAL_RESULTS_FEATURE)
    expect(PARTICIPANT_FEATURES).not.toContain('*')
  })

  it('answers 403 for a participant, never touches the database, and returns no CSV', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(PARTICIPANT_FEATURES))
    mockCreateRequestContainer.mockRejectedValue(new Error('container must not be resolved for a forbidden caller'))

    const res = await GET(request())

    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
    expect(mockRawAll).not.toHaveBeenCalled()
    expect(res.status).toBe(403)
    const clone = res.clone()
    await expect(res.json()).resolves.toEqual({
      error: 'Forbidden',
      requiredFeatures: [PORTAL_RESULTS_EXPORT_FEATURE],
    })
    await expectNoCsv(clone)
  })

  it('answers 403 for a mentor as well', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(MENTOR_FEATURES))
    mockCreateRequestContainer.mockRejectedValue(new Error('container must not be resolved for a forbidden caller'))

    const res = await GET(request())

    expect(res.status).toBe(403)
    expect(mockRawAll).not.toHaveBeenCalled()
  })

  it('answers 401 without a portal session', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(null)
    mockCreateRequestContainer.mockRejectedValue(new Error('container must not be resolved for an anonymous caller'))

    const res = await GET(request())

    expect(res.status).toBe(401)
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })
})

describe('portal export-results — the stage gate (#118)', () => {
  const PRE_PUBLICATION_STAGES = [
    CompetitionStage.HACKING,
    CompetitionStage.DEMOS,
    CompetitionStage.DELIBERATION,
  ]

  it.each(PRE_PUBLICATION_STAGES)(
    'refuses a judge with 403 while the competition is in stage %p, and returns no CSV',
    async (stage) => {
      mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
      mockCreateRequestContainer.mockResolvedValue(container(makeEm({ id: COMPETITION_ID, stage })))

      const res = await GET(request())

      expect(mockRawAll).not.toHaveBeenCalled()
      expect(res.status).toBe(403)
      const clone = res.clone()
      await expect(res.json()).resolves.toEqual({ error: RESULTS_NOT_PUBLISHED_MESSAGE })
      await expectNoCsv(clone)
    },
  )

  it('serves the CSV to a judge once the competition is finished — so the refusals are not vacuous', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    mockCreateRequestContainer.mockResolvedValue(
      container(makeEm({ id: COMPETITION_ID, stage: CompetitionStage.FINISHED })),
    )

    const res = await GET(request())

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv')
    const text = await res.text()
    expect(text).toContain('Rank,Project,Team,Avg Score,Peer Votes,Status,Finalist')
    expect(text).toContain('Secret Project')
    expect(mockRawAll).toHaveBeenCalledTimes(1)
  })

  it('reports a competition outside the caller\'s tenant as 404 with no CSV', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    mockCreateRequestContainer.mockResolvedValue(container(makeEm(null)))

    const res = await GET(request())

    expect(res.status).toBe(404)
    const clone = res.clone()
    await expect(res.json()).resolves.toEqual({ error: 'Competition not found' })
    await expectNoCsv(clone)
    expect(mockRawAll).not.toHaveBeenCalled()
  })

  it('scopes the competition lookup to the caller\'s tenant and organisation', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm({ id: COMPETITION_ID, stage: CompetitionStage.FINISHED })
    mockCreateRequestContainer.mockResolvedValue(container(em))

    await GET(request())

    expect(em.findOne).toHaveBeenCalledTimes(1)
    const filter = em.findOne.mock.calls[0][1] as Record<string, unknown>
    expect(filter).toMatchObject({ id: COMPETITION_ID, tenantId: TENANT, organizationId: ORG })
  })

  it('still rejects a missing competition_id with 400', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    mockCreateRequestContainer.mockRejectedValue(new Error('container must not be resolved for invalid input'))

    const res = await GET(request(''))

    expect(res.status).toBe(400)
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })
})
