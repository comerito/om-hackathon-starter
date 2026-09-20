/**
 * `PUT /api/judging/demos` — manual reordering of the demo queue.
 *
 * The previous handler overwrote one row's `presentation_order` and left everyone else alone,
 * so moving a demo produced two sessions with the same position. These tests pin the whole-queue
 * renumbering, the "history does not move" rule, and the MikroORM 7 read-before-write ordering.
 */

const mockGetAuthFromRequest = jest.fn()
const mockCreateRequestContainer = jest.fn()
const mockRunRouteMutationGuards = jest.fn()

jest.mock('@open-mercato/shared/lib/auth/server', () => ({
  getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a),
  getAuthFromCookies: jest.fn(),
}), { virtual: true })
jest.mock('@open-mercato/shared/lib/di/container', () => ({ createRequestContainer: (...a: unknown[]) => mockCreateRequestContainer(...a) }), { virtual: true })
jest.mock('@open-mercato/shared/lib/crud/route-mutation-guard', () => ({ runRouteMutationGuards: (...a: unknown[]) => mockRunRouteMutationGuards(...a) }), { virtual: true })
jest.mock('@open-mercato/core/modules/directory/utils/organizationScope', () => ({ resolveOrganizationScopeForRequest: async () => ({ selectedId: null }) }), { virtual: true })
jest.mock('../../../data/entities', () => ({ DemoSession: class DemoSession {}, DemoStatus: { QUEUED: 'queued' } }))
jest.mock('../../../../projects/data/entities', () => ({ Project: class Project {}, ProjectStatus: { PUBLISHED: 'published' } }))
jest.mock('../../../../competitions/data/entities', () => ({ Competition: class Competition {} }))
jest.mock('../../../../teams/data/entities', () => ({ Team: class Team {} }))
jest.mock('../../../../tracks/data/entities', () => ({ Track: class Track {} }))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PUT } = require('../route') as typeof import('../route')

const TENANT = '11111111-1111-4111-8111-111111111111'
const ORG = '99999999-9999-4999-8999-999999999999'
const id = (n: number) => `0000000${n}-0000-4000-8000-000000000000`

type Session = { id: string; status: string; presentationOrder: number; competitionId: string; round: string; updatedAt?: Date }
let sessions: Session[]
let flushed: number
let readsAfterWrite: number
let emitted: string[]

function call(demoId: string, newOrder: number) {
  return PUT(new Request('http://localhost/api/judging/demos', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: demoId, new_order: newOrder }),
  }))
}

const currentOrder = () => [...sessions].sort((a, b) => a.presentationOrder - b.presentationOrder).map((s) => s.id)

beforeEach(() => {
  flushed = 0; readsAfterWrite = 0; emitted = []
  sessions = ['completed', 'presenting', 'on_deck', 'queued', 'queued'].map((status, index) => ({
    id: id(index + 1), status, presentationOrder: index, competitionId: 'comp', round: 'preliminary',
  }))
  let wrote = false
  const em = {
    findOne: jest.fn(async (_e: unknown, where: { id: string }) => { if (wrote) readsAfterWrite += 1; return sessions.find((s) => s.id === where.id) ?? null }),
    find: jest.fn(async () => { if (wrote) readsAfterWrite += 1; return sessions }),
    persist: jest.fn(() => { wrote = true }),
    flush: jest.fn(async () => { flushed += 1 }),
  }
  mockGetAuthFromRequest.mockResolvedValue({ sub: 'admin', tenantId: TENANT, orgId: ORG })
  mockCreateRequestContainer.mockResolvedValue({
    resolve: (name: string) => (name === 'em' ? em : { emit: async (eventId: string) => { emitted.push(eventId) } }),
  })
  mockRunRouteMutationGuards.mockResolvedValue({ ok: true, runAfterSuccess: jest.fn() })
})

describe('PUT /api/judging/demos', () => {
  it('moves a demo and renumbers the rest, leaving no duplicate positions', async () => {
    const res = await call(id(5), 2)
    expect(res.status).toBe(200)
    expect(currentOrder()).toEqual([id(1), id(2), id(5), id(3), id(4)])
    expect(sessions.map((s) => s.presentationOrder).sort()).toEqual([0, 1, 2, 3, 4])
    expect(flushed).toBe(1)
    expect(emitted).toEqual(['judging.demo.queue_updated'])
  })

  it('reads the whole queue before the first write (MikroORM 7)', async () => {
    await call(id(3), 4)
    expect(readsAfterWrite).toBe(0)
  })

  it('does not move a demo that is on stage or finished, nor let another take its position', async () => {
    expect((await call(id(2), 4)).status).toBe(409)
    expect((await call(id(4), 0)).status).toBe(409)
    expect(currentOrder()).toEqual([1, 2, 3, 4, 5].map(id))
    expect(flushed).toBe(0)
    expect(emitted).toEqual([])
  })

  it('treats a move to the current position as a no-op', async () => {
    const body = await (await call(id(4), 3)).json()
    expect(body).toMatchObject({ ok: true, changed: false })
    expect(flushed).toBe(0)
    expect(emitted).toEqual([])
  })

  it('answers 404 for an unknown demo, 422 for a bad body, 401 without auth', async () => {
    expect((await call(id(9), 0)).status).toBe(404)
    expect((await call('not-a-uuid', 0)).status).toBe(422)
    mockGetAuthFromRequest.mockResolvedValue(null)
    expect((await call(id(4), 2)).status).toBe(401)
  })

  it('stops when a mutation guard blocks', async () => {
    mockRunRouteMutationGuards.mockResolvedValue({ ok: false, response: new Response('{}', { status: 423 }) })
    expect((await call(id(5), 2)).status).toBe(423)
    expect(flushed).toBe(0)
  })
})

export {}
