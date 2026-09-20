jest.mock('../../data/entities', () => ({
  DemoSession: class DemoSession {},
  JudgePanel: class JudgePanel {},
  JudgePanelTrack: class JudgePanelTrack {},
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { syncDemoDurations, loadDemoDurationResolver } = require('../demoDurationSync') as typeof import('../demoDurationSync')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const entities = require('../../data/entities') as { DemoSession: unknown; JudgePanel: unknown; JudgePanelTrack: unknown }

const scope = { tenantId: 'tenant', organizationId: 'org' }

type SessionRow = { id: string; status: string; trackId: string; round: string; presentationDurationMinutes: number; qaDurationMinutes: number }

function fakeEm(input: { panels: unknown[]; panelTracks: unknown[]; sessions: SessionRow[] }) {
  let wrote = false
  let readsAfterWrite = 0
  const em = {
    find: jest.fn(async (entity: unknown) => {
      if (wrote) readsAfterWrite += 1
      if (entity === entities.JudgePanel) return input.panels
      if (entity === entities.JudgePanelTrack) return input.panelTracks
      return input.sessions
    }),
    persist: jest.fn(() => { wrote = true }),
    flush: jest.fn(),
  }
  return { em, readsAfterWrite: () => readsAfterWrite }
}

const session = (id: string, status: string, trackId = 'track-ai'): SessionRow => ({
  id, status, trackId, round: 'preliminary', presentationDurationMinutes: 3, qaDurationMinutes: 2,
})

describe('syncDemoDurations', () => {
  const panels = [{ id: 'p1', round: 'preliminary', presentationDurationMinutes: 8, qaDurationMinutes: null }]
  const panelTracks = [{ panelId: 'p1', trackId: 'track-ai' }]

  it('re-times demos that have not started, and only those', async () => {
    const sessions = [session('done', 'completed'), session('live', 'presenting'), session('next', 'on_deck'), session('later', 'queued')]
    const { em, readsAfterWrite } = fakeEm({ panels, panelTracks, sessions })

    expect(await syncDemoDurations(em as never, 'comp', scope)).toBe(2)
    expect(sessions.map((s) => s.presentationDurationMinutes)).toEqual([3, 3, 8, 8])
    expect(em.flush).toHaveBeenCalledTimes(1)
    expect(readsAfterWrite()).toBe(0)
  })

  it('falls back to the hard-coded 5 + 2 for tracks no panel hears', async () => {
    const sessions = [session('other', 'queued', 'track-commerce')]
    const { em } = fakeEm({ panels, panelTracks, sessions })
    await syncDemoDurations(em as never, 'comp', scope)
    expect(sessions[0]).toMatchObject({ presentationDurationMinutes: 5, qaDurationMinutes: 2 })
  })

  it('writes nothing when the times already match', async () => {
    const sessions = [{ ...session('ok', 'queued'), presentationDurationMinutes: 8, qaDurationMinutes: 2 }]
    const { em } = fakeEm({ panels, panelTracks, sessions })
    expect(await syncDemoDurations(em as never, 'comp', scope)).toBe(0)
    expect(em.flush).not.toHaveBeenCalled()
  })

  it('does not query panel tracks when the competition has no panels', async () => {
    const { em } = fakeEm({ panels: [], panelTracks: [], sessions: [] })
    const resolve = await loadDemoDurationResolver(em as never, 'comp', scope)
    expect(resolve({ trackId: 'track-ai', round: 'preliminary' })).toMatchObject({ presentationDurationMinutes: 5, qaDurationMinutes: 2 })
    expect(em.find).toHaveBeenCalledTimes(1)
  })
})

export {}
