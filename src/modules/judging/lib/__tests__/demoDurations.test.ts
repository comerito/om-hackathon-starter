import { panelsHearingDemo, resolveDemoDurations, type DurationPanel } from '../demoDurations'

const demo = { trackId: 'track-ai', round: 'preliminary' }
const panel = (id: string, overrides: Partial<DurationPanel> = {}): DurationPanel => ({ id, round: 'preliminary', ...overrides })
const tracks = (...pairs: Array<[string, string]>) => pairs.map(([panelId, trackId]) => ({ panelId, trackId }))

describe('resolveDemoDurations', () => {
  it('falls back to the hard-coded 5 + 2 minutes', () => {
    expect(resolveDemoDurations(demo, [], [])).toEqual({ presentationDurationMinutes: 5, qaDurationMinutes: 2, panelId: null })
    expect(resolveDemoDurations(demo, [panel('p1')], tracks(['p1', 'track-ai']))).toEqual({ presentationDurationMinutes: 5, qaDurationMinutes: 2, panelId: null })
  })

  it('lets the panel that hears the demo override the defaults', () => {
    const result = resolveDemoDurations(demo, [panel('p1', { presentationDurationMinutes: 7, qaDurationMinutes: 4 })], tracks(['p1', 'track-ai']))
    expect(result).toEqual({ presentationDurationMinutes: 7, qaDurationMinutes: 4, panelId: 'p1' })
  })

  it('resolves each field on its own: a panel may set only one of them', () => {
    const result = resolveDemoDurations(demo, [panel('p1', { qaDurationMinutes: 0 })], tracks(['p1', 'track-ai']))
    expect(result).toEqual({ presentationDurationMinutes: 5, qaDurationMinutes: 0, panelId: 'p1' })
  })

  it('ignores panels of another round, of another track, and panels with no tracks at all', () => {
    const panels = [
      panel('final', { round: 'final', presentationDurationMinutes: 10 }),
      panel('other-track', { presentationDurationMinutes: 9 }),
      panel('no-tracks', { presentationDurationMinutes: 8 }),
    ]
    const result = resolveDemoDurations(demo, panels, tracks(['final', 'track-ai'], ['other-track', 'track-commerce']))
    expect(result.presentationDurationMinutes).toBe(5)
    expect(result.panelId).toBeNull()
  })

  it('is deterministic when two panels share a track: lowest id that sets the value wins', () => {
    const panels = [panel('p2', { presentationDurationMinutes: 9 }), panel('p1'), panel('p3', { presentationDurationMinutes: 4 })]
    const shared = tracks(['p1', 'track-ai'], ['p2', 'track-ai'], ['p3', 'track-ai'])
    expect(resolveDemoDurations(demo, panels, shared).presentationDurationMinutes).toBe(9)
    expect(panelsHearingDemo(demo, panels, shared).map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('rejects nonsense values instead of putting them on the kiosk timer', () => {
    const result = resolveDemoDurations(demo, [panel('p1', { presentationDurationMinutes: 0, qaDurationMinutes: -1 })], tracks(['p1', 'track-ai']))
    expect(result).toEqual({ presentationDurationMinutes: 5, qaDurationMinutes: 2, panelId: null })
  })
})

export {}
