/**
 * Route-handler regression tests for issue #116 — portal scoring authorization.
 *
 * ## Why these live at the route and not next to the helper
 *
 * `judging/lib/__tests__/portalAuth.test.ts` and `.../panelScope.test.ts` prove the two helpers
 * decide correctly. Neither proves the route *calls* them: with both `requirePortalFeatures`
 * calls deleted from `api/portal/score-project/route.ts` the whole suite still passed, which is
 * exactly the hole #116 reported. These tests drive the exported `GET` / `POST` handlers, so the
 * assertion is on the response a portal client would actually receive.
 *
 * The feature lists are taken from the module's real `setup.ts` rather than written out here —
 * a gate that the `participant` role happens to already satisfy would then fail the test instead
 * of passing it.
 */

import { matchesEntity } from '@open-mercato/shared/lib/crud/mutation-guard-registry'
import setup from '../../../../setup'
import { PORTAL_SCORE_FEATURE } from '../../../../lib/portalAuth'
import { SCORE_RESOURCE_KIND } from '../../../../lib/resourceKinds'

const mockGetCustomerAuthFromRequest = jest.fn()
const mockCreateRequestContainer = jest.fn()
const mockRunRouteMutationGuards = jest.fn()

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
jest.mock(
  '@open-mercato/shared/lib/crud/route-mutation-guard',
  () => ({ runRouteMutationGuards: (...args: unknown[]) => mockRunRouteMutationGuards(...args) }),
  { virtual: true },
)
jest.mock('@/lib/portal-translations', () => ({
  resolvePortalLocale: jest.fn(async () => 'en'),
  applyPortalTranslationOverlays: jest.fn(async (rows: unknown) => rows),
}))
// The entity modules only serve as MikroORM class tokens here; the fake `em` dispatches on them.
jest.mock('../../../../data/entities', () => ({
  ProjectScore: class ProjectScore {},
  CriterionScore: class CriterionScore {},
  JudgingCriterion: class JudgingCriterion {},
  JudgePanel: class JudgePanel {},
  JudgePanelJudge: class JudgePanelJudge {},
}))
jest.mock('../../../../../projects/data/entities', () => ({ Project: class Project {} }))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET, POST } = require('../route') as typeof import('../route')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const entities = require('../../../../data/entities') as {
  ProjectScore: unknown
  CriterionScore: unknown
  JudgingCriterion: unknown
  JudgePanel: unknown
  JudgePanelJudge: unknown
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const projectEntities = require('../../../../../projects/data/entities') as { Project: unknown }

const TENANT = '00000000-0000-4000-8000-0000000000a1'
const ORG = '00000000-0000-4000-8000-0000000000b1'
const JUDGE_ID = '11111111-1111-4111-8111-111111111111'
const PROJECT_ID = '22222222-2222-4222-8222-222222222222'
const COMPETITION_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_COMPETITION_ID = '44444444-4444-4444-8444-444444444444'
const OWN_PANEL_ID = '55555555-5555-4555-8555-555555555555'
const FOREIGN_PANEL_ID = '66666666-6666-4666-8666-666666666666'
const TRACK_ID = '77777777-7777-4777-8777-777777777777'
const CRITERION_ID = '88888888-8888-4888-8888-888888888888'

const PARTICIPANT_FEATURES = setup.defaultCustomerRoleFeatures?.participant ?? []
const JUDGE_FEATURES = setup.defaultCustomerRoleFeatures?.judge ?? []

function auth(features: string[]) {
  return { sub: JUDGE_ID, tenantId: TENANT, orgId: ORG, resolvedFeatures: features }
}

type PanelRow = { id: string; competitionId: string }
type MembershipRow = { panelId: string }

type EmOptions = {
  /** Panels the caller sits on, as `JudgePanel` rows. */
  panels?: PanelRow[]
  project?: { id: string; competitionId: string; trackId: string } | null
}

/**
 * Minimal `EntityManager` stand-in. It dispatches on the entity class the route passes, so a
 * route that skips a lookup (or performs one it should not have reached) is visible in the
 * recorded calls rather than silently absorbed.
 */
function makeEm(options: EmOptions = {}) {
  const panels = options.panels ?? []
  const project = options.project === undefined
    ? { id: PROJECT_ID, competitionId: COMPETITION_ID, trackId: TRACK_ID }
    : options.project
  const transactional = jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
    const created: Record<string, unknown> = { id: 'created-score-id' }
    const txEm = {
      findOne: jest.fn(async () => null),
      find: jest.fn(async () => []),
      create: jest.fn((_entity: unknown, data: Record<string, unknown>) => Object.assign(created, data)),
      persist: jest.fn(),
      flush: jest.fn(async () => undefined),
    }
    return cb(txEm)
  })
  const findOne = jest.fn(async (entity: unknown) => {
    if (entity === projectEntities.Project) return project
    if (entity === entities.ProjectScore) return null
    return null
  })
  const find = jest.fn(async (entity: unknown): Promise<unknown[]> => {
    if (entity === entities.JudgePanelJudge) {
      return panels.map((p): MembershipRow => ({ panelId: p.id }))
    }
    if (entity === entities.JudgePanel) return panels
    if (entity === entities.JudgingCriterion) return []
    return []
  })
  return { findOne, find, transactional }
}

function container(em: unknown) {
  return { resolve: (key: string) => (key === 'em' ? em : undefined) }
}

function postRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/judging/portal/score-project', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function scorePayload(overrides: Record<string, unknown> = {}) {
  return {
    project_id: PROJECT_ID,
    competition_id: COMPETITION_ID,
    judge_panel_id: 'auto',
    round: 'preliminary',
    conflict_of_interest: false,
    is_submitted: false,
    criterion_scores: [{ criterion_id: CRITERION_ID, score: 5 }],
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRunRouteMutationGuards.mockResolvedValue({
    ok: true,
    modifiedPayload: null,
    runAfterSuccess: jest.fn(async () => undefined),
  })
})

describe('portal score-project — the feature gate (#116)', () => {
  it('the participant role does not carry the scoring feature (guards against a vacuous gate)', () => {
    expect(JUDGE_FEATURES).toContain(PORTAL_SCORE_FEATURE)
    expect(PARTICIPANT_FEATURES).not.toContain(PORTAL_SCORE_FEATURE)
    expect(PARTICIPANT_FEATURES).not.toContain('*')
  })

  it('POST answers 403 for a participant and never resolves the container', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(PARTICIPANT_FEATURES))
    mockCreateRequestContainer.mockRejectedValue(new Error('container must not be resolved for a forbidden caller'))

    const res = await POST(postRequest(scorePayload()))

    // Asserted before the status: with the gate deleted this is the assertion that fails, and it
    // names the actual defect — an unauthorised caller reaching the data layer.
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
    expect(mockRunRouteMutationGuards).not.toHaveBeenCalled()
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({
      error: 'Forbidden',
      requiredFeatures: [PORTAL_SCORE_FEATURE],
    })
  })

  it('GET answers 403 for a participant and leaks no criteria or score', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(PARTICIPANT_FEATURES))
    mockCreateRequestContainer.mockRejectedValue(new Error('container must not be resolved for a forbidden caller'))

    const res = await GET(new Request(
      `http://localhost/api/judging/portal/score-project?project_id=${PROJECT_ID}&competition_id=${COMPETITION_ID}`,
    ))

    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toEqual({ error: 'Forbidden', requiredFeatures: [PORTAL_SCORE_FEATURE] })
    expect(body.criteria).toBeUndefined()
    expect(body.score).toBeUndefined()
  })

  it('POST answers 401 when there is no portal session', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(null)
    mockCreateRequestContainer.mockRejectedValue(new Error('container must not be resolved for an anonymous caller'))

    const res = await POST(postRequest(scorePayload()))

    expect(res.status).toBe(401)
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })
})

describe('portal score-project — the panel gate (#116)', () => {
  it('refuses a judge who sits on no panel of the project\'s competition, and writes nothing', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm({ panels: [{ id: FOREIGN_PANEL_ID, competitionId: OTHER_COMPETITION_ID }] })
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await POST(postRequest(scorePayload()))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toEqual({ error: 'You are not on a judging panel for this competition' })
    expect(body.score_id).toBeUndefined()
    expect(em.transactional).not.toHaveBeenCalled()
  })

  it('refuses a judge who names a panel outside the project\'s competition', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm({
      panels: [
        { id: OWN_PANEL_ID, competitionId: COMPETITION_ID },
        { id: FOREIGN_PANEL_ID, competitionId: OTHER_COMPETITION_ID },
      ],
    })
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await POST(postRequest(scorePayload({ judge_panel_id: FOREIGN_PANEL_ID })))

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'That judging panel cannot score this project' })
    expect(em.transactional).not.toHaveBeenCalled()
  })

  it('reports an unknown project as 404 without disclosing anything', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm({ project: null })
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await POST(postRequest(scorePayload()))

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: 'Project not found' })
    expect(em.transactional).not.toHaveBeenCalled()
  })

  it('lets an eligible judge through — so the refusals above are not vacuous', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm({ panels: [{ id: OWN_PANEL_ID, competitionId: COMPETITION_ID }] })
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await POST(postRequest(scorePayload()))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true, score_id: 'created-score-id' })
    expect(em.transactional).toHaveBeenCalledTimes(1)
  })
})

describe('portal score-project — the mutation-guard registry (#116)', () => {
  it('reports a resource kind a `judging.*` wildcard guard actually matches', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm({ panels: [{ id: OWN_PANEL_ID, competitionId: COMPETITION_ID }] })
    mockCreateRequestContainer.mockResolvedValue(container(em))

    await POST(postRequest(scorePayload()))

    expect(mockRunRouteMutationGuards).toHaveBeenCalledTimes(1)
    const passed = mockRunRouteMutationGuards.mock.calls[0][0] as {
      input: { resourceKind: string; operation: string }
      auth: { userId: string; userFeatures: string[] }
    }
    expect(passed.input.resourceKind).toBe(SCORE_RESOURCE_KIND)
    expect(matchesEntity('judging.*', passed.input.resourceKind)).toBe(true)
    expect(passed.input.operation).toBe('create')
    expect(passed.auth.userFeatures).toEqual(JUDGE_FEATURES)
  })

  it('returns the guard\'s refusal and writes nothing when a guard blocks', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm({ panels: [{ id: OWN_PANEL_ID, competitionId: COMPETITION_ID }] })
    mockCreateRequestContainer.mockResolvedValue(container(em))
    mockRunRouteMutationGuards.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Scoring is closed' }), { status: 403 }),
    })

    const res = await POST(postRequest(scorePayload()))

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'Scoring is closed' })
    expect(em.transactional).not.toHaveBeenCalled()
  })
})
