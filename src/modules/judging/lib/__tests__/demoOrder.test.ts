import { isDemoMovable, neighbourPositions, planDemoReorder, type DemoOrderSession } from '../demoOrder'

const queue = (...rows: Array<[string, string, number]>): DemoOrderSession[] =>
  rows.map(([id, status, presentationOrder]) => ({ id, status, presentationOrder }))

const ids = (plan: ReturnType<typeof planDemoReorder>) =>
  plan.ok ? [...plan.order].sort((a, b) => a.presentationOrder - b.presentationOrder).map((row) => row.id) : plan.reason

describe('isDemoMovable', () => {
  it('locks everything that is on stage or done', () => {
    expect(['queued', 'on_deck'].map(isDemoMovable)).toEqual([true, true])
    expect(['presenting', 'qa', 'completed', 'skipped'].map(isDemoMovable)).toEqual([false, false, false, false])
  })
})

describe('planDemoReorder', () => {
  const all = queue(['a', 'queued', 0], ['b', 'queued', 1], ['c', 'queued', 2], ['d', 'queued', 3])

  it('moves a demo up and down, shifting the others', () => {
    expect(ids(planDemoReorder(all, 'd', 0))).toEqual(['d', 'a', 'b', 'c'])
    expect(ids(planDemoReorder(all, 'a', 2))).toEqual(['b', 'c', 'a', 'd'])
    expect(ids(planDemoReorder(all, 'b', 3))).toEqual(['a', 'c', 'd', 'b'])
  })

  it('always returns a dense 0..n-1 numbering with no duplicates', () => {
    const plan = planDemoReorder(all, 'c', 0)
    expect(plan.ok && plan.order.map((row) => row.presentationOrder).sort()).toEqual([0, 1, 2, 3])
  })

  it('clamps an out-of-range target and reports a no-op', () => {
    expect(ids(planDemoReorder(all, 'a', 99))).toEqual(['b', 'c', 'd', 'a'])
    expect(ids(planDemoReorder(all, 'd', -5))).toEqual(['d', 'a', 'b', 'c'])
    const noop = planDemoReorder(all, 'b', 1)
    expect(noop.ok && noop.changed).toBe(false)
  })

  it('repairs the duplicate / gapped numbering the old single-row update left behind', () => {
    const broken = queue(['a', 'queued', 0], ['b', 'queued', 0], ['c', 'queued', 5])
    const plan = planDemoReorder(broken, 'c', 0)
    expect(ids(plan)).toEqual(['c', 'a', 'b'])
    expect(plan.ok && plan.changed).toBe(true)
  })

  it('keeps started and finished demos exactly where they are', () => {
    const live = queue(['done', 'completed', 0], ['now', 'presenting', 1], ['x', 'on_deck', 2], ['y', 'queued', 3], ['z', 'queued', 4])
    expect(ids(planDemoReorder(live, 'z', 2))).toEqual(['done', 'now', 'z', 'x', 'y'])
    expect(ids(planDemoReorder(live, 'x', 4))).toEqual(['done', 'now', 'y', 'z', 'x'])
  })

  it('moves around a locked demo in the middle of the queue', () => {
    const mixed = queue(['a', 'queued', 0], ['skip', 'skipped', 1], ['b', 'queued', 2], ['c', 'queued', 3])
    expect(ids(planDemoReorder(mixed, 'c', 0))).toEqual(['c', 'skip', 'a', 'b'])
  })

  it('refuses to move a locked demo, to take a locked position, or an unknown demo', () => {
    const live = queue(['done', 'completed', 0], ['x', 'queued', 1], ['y', 'queued', 2])
    expect(planDemoReorder(live, 'done', 2)).toEqual({ ok: false, reason: 'locked' })
    expect(planDemoReorder(live, 'y', 0)).toEqual({ ok: false, reason: 'target_locked' })
    expect(planDemoReorder(live, 'nope', 0)).toEqual({ ok: false, reason: 'not_found' })
  })
})

describe('neighbourPositions', () => {
  const live = queue(['done', 'completed', 0], ['x', 'queued', 1], ['skip', 'skipped', 2], ['y', 'queued', 3], ['z', 'queued', 4])

  it('skips over locked demos and stops at the edges', () => {
    expect(neighbourPositions(live, 'x')).toEqual({ up: null, down: 3, first: null, last: 4 })
    expect(neighbourPositions(live, 'y')).toEqual({ up: 1, down: 4, first: 1, last: 4 })
    expect(neighbourPositions(live, 'z')).toEqual({ up: 3, down: null, first: 1, last: null })
  })

  it('offers nothing for a locked or unknown demo', () => {
    const none = { up: null, down: null, first: null, last: null }
    expect(neighbourPositions(live, 'done')).toEqual(none)
    expect(neighbourPositions(live, 'nope')).toEqual(none)
  })
})
