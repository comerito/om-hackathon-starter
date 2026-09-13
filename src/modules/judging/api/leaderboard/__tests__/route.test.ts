/**
 * Regression tests for issue #85.
 *
 * The back-office Leaderboard tab used to send `competition_id=all`; the literal
 * string reached a uuid-typed filter and the route answered 500. The route must
 * reject a non-uuid `competition_id` with a 400 and a clear message, before it
 * ever resolves the DI container / touches the database.
 */

const mockGetAuthFromCookies = jest.fn()
const mockCreateRequestContainer = jest.fn()

jest.mock(
  '@open-mercato/shared/lib/auth/server',
  () => ({ getAuthFromCookies: (...args: unknown[]) => mockGetAuthFromCookies(...args) }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/shared/lib/di/container',
  () => ({ createRequestContainer: (...args: unknown[]) => mockCreateRequestContainer(...args) }),
  { virtual: true },
)
// The entity modules pull in MikroORM decorators; the validation path never uses them.
jest.mock('../../../data/entities', () => ({ ProjectScore: class ProjectScore {} }))
jest.mock('../../../../projects/data/entities', () => ({ Project: class Project {} }))
jest.mock('../../../../teams/data/entities', () => ({ Team: class Team {} }))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require('../route') as typeof import('../route')

const VALID_UUID = '9c9a1f0e-4d5b-4a1e-9f2a-1b2c3d4e5f60'

function request(query: string): Request {
  return new Request(`http://localhost/api/judging/leaderboard${query}`)
}

describe('GET /api/judging/leaderboard — competition_id validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAuthFromCookies.mockResolvedValue({ tenantId: 'tenant-1' })
    mockCreateRequestContainer.mockRejectedValue(new Error('container must not be resolved for invalid input'))
  })

  it('rejects the literal string "all" with 400 instead of 500', async () => {
    const res = await GET(request('?competition_id=all'))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'competition_id must be a valid UUID' })
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })

  it.each(['not-a-uuid', '12345', '9c9a1f0e-4d5b-4a1e-9f2a', `${VALID_UUID}x`])(
    'rejects non-uuid competition_id %p with 400',
    async (value) => {
      const res = await GET(request(`?competition_id=${encodeURIComponent(value)}`))
      expect(res.status).toBe(400)
      expect(mockCreateRequestContainer).not.toHaveBeenCalled()
    },
  )

  it('still reports a missing competition_id as required', async () => {
    const res = await GET(request(''))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'competition_id required' })
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })

  it('treats an empty track_id as "all tracks" rather than invalid input', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const res = await GET(request(`?competition_id=${VALID_UUID}&track_id=`))
      expect(res.status).not.toBe(400)
      expect(mockCreateRequestContainer).toHaveBeenCalledTimes(1)
    } finally {
      consoleError.mockRestore()
    }
  })

  it('rejects a non-uuid track_id with 400', async () => {
    const res = await GET(request(`?competition_id=${VALID_UUID}&track_id=all`))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'track_id must be a valid UUID' })
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })

  it('answers 401 before validating when there is no session', async () => {
    mockGetAuthFromCookies.mockResolvedValue(null)
    const res = await GET(request('?competition_id=all'))
    expect(res.status).toBe(401)
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })

  it('accepts a valid uuid and proceeds past validation', async () => {
    // The container rejects, so the route falls into its catch and answers 500 —
    // what matters here is that a valid uuid is NOT short-circuited at validation.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const res = await GET(request(`?competition_id=${VALID_UUID}`))
      expect(mockCreateRequestContainer).toHaveBeenCalledTimes(1)
      expect(res.status).toBe(500)
    } finally {
      consoleError.mockRestore()
    }
  })
})
