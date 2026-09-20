/**
 * Manual reordering of the demo (presentation) queue.
 *
 * Pure on purpose: the route and the command both read every session of the queue first, ask
 * this module for the new numbering, and only then mutate — MikroORM 7 drops a pending UPDATE
 * when a find is interleaved with it.
 */

export type DemoOrderSession = { id: string; status: string; presentationOrder: number }

/** A demo that is on stage or done is history: the audience saw it in that position. */
const LOCKED_STATUSES: ReadonlySet<string> = new Set(['presenting', 'qa', 'completed', 'skipped'])

export function isDemoMovable(status: string): boolean {
  return !LOCKED_STATUSES.has(status)
}

export type DemoReorderError = 'not_found' | 'locked' | 'target_locked'

export type DemoReorderPlan =
  | { ok: true; order: Array<{ id: string; presentationOrder: number }>; changed: boolean }
  | { ok: false; reason: DemoReorderError }

function byCurrentOrder(a: DemoOrderSession, b: DemoOrderSession): number {
  return a.presentationOrder - b.presentationOrder || a.id.localeCompare(b.id)
}

/**
 * Move `demoId` to the 0-based queue position `targetPosition`.
 *
 * - started / finished sessions keep their position, and a position they hold cannot be taken;
 * - the remaining sessions close ranks around the moved one, keeping their relative order;
 * - the result is always a dense 0..n-1 numbering, which also repairs gaps and duplicates left
 *   behind by the old single-row update.
 */
export function planDemoReorder(
  sessions: readonly DemoOrderSession[],
  demoId: string,
  targetPosition: number,
): DemoReorderPlan {
  const queue = [...sessions].sort(byCurrentOrder)
  const moved = queue.find((session) => session.id === demoId)
  if (!moved) return { ok: false, reason: 'not_found' }
  if (!isDemoMovable(moved.status)) return { ok: false, reason: 'locked' }

  const target = Math.min(Math.max(Math.trunc(targetPosition), 0), queue.length - 1)
  if (!isDemoMovable(queue[target].status)) return { ok: false, reason: 'target_locked' }

  const movableSlots: number[] = []
  queue.forEach((session, index) => { if (isDemoMovable(session.status)) movableSlots.push(index) })

  const movables = queue.filter((session) => isDemoMovable(session.status) && session.id !== demoId)
  movables.splice(movableSlots.indexOf(target), 0, moved)

  const result = [...queue]
  movableSlots.forEach((slot, index) => { result[slot] = movables[index] })

  const order = result.map((session, index) => ({ id: session.id, presentationOrder: index }))
  const changed = result.some((session, index) => session.presentationOrder !== index)
  return { ok: true, order, changed }
}

/** Positions a movable demo can be sent to with the one-step controls, or `null` at the edge. */
export function neighbourPositions(
  sessions: readonly DemoOrderSession[],
  demoId: string,
): { up: number | null; down: number | null; first: number | null; last: number | null } {
  const queue = [...sessions].sort(byCurrentOrder)
  const index = queue.findIndex((session) => session.id === demoId)
  const none = { up: null, down: null, first: null, last: null }
  if (index < 0 || !isDemoMovable(queue[index].status)) return none

  const slots = queue.map((session, i) => (isDemoMovable(session.status) ? i : -1)).filter((i) => i >= 0)
  const at = slots.indexOf(index)
  return {
    up: at > 0 ? slots[at - 1] : null,
    down: at < slots.length - 1 ? slots[at + 1] : null,
    first: at > 0 ? slots[0] : null,
    last: at < slots.length - 1 ? slots[slots.length - 1] : null,
  }
}
