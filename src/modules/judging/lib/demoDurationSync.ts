/**
 * Database side of `demoDurations.ts`: load what the resolver needs, and re-apply panel times
 * to the demos that have not started yet.
 */

import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { DemoSession, JudgePanel, JudgePanelTrack } from '../data/entities'
import { resolveDemoDurations, type DurationPanel, type DurationPanelTrack, type ResolvedDemoDurations } from './demoDurations'
import { isDemoMovable } from './demoOrder'

export type DemoDurationScope = { tenantId: string; organizationId: string }

export type DemoDurationResolver = (demo: { trackId: string; round: string }) => ResolvedDemoDurations

/** The two `DemoSession` fields a resolved duration maps onto. */
export function pickDurations(durations: ResolvedDemoDurations) {
  return {
    presentationDurationMinutes: durations.presentationDurationMinutes,
    qaDurationMinutes: durations.qaDurationMinutes,
  }
}

/** Reads only. Call it BEFORE creating or mutating sessions. */
export async function loadDemoDurationResolver(
  em: EntityManager,
  competitionId: string,
  scope: DemoDurationScope,
): Promise<DemoDurationResolver> {
  const panels = await em.find(JudgePanel, {
    competitionId,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    deletedAt: null,
  } as FilterQuery<JudgePanel>)

  const panelTracks = panels.length > 0
    ? await em.find(JudgePanelTrack, {
        panelId: { $in: panels.map((panel) => panel.id) },
        tenantId: scope.tenantId,
      } as FilterQuery<JudgePanelTrack>)
    : []

  const durationPanels: DurationPanel[] = panels.map((panel) => ({
    id: panel.id,
    round: panel.round,
    presentationDurationMinutes: panel.presentationDurationMinutes ?? null,
    qaDurationMinutes: panel.qaDurationMinutes ?? null,
  }))
  const durationTracks: DurationPanelTrack[] = panelTracks.map((pt) => ({ panelId: pt.panelId, trackId: pt.trackId }))

  return (demo) => resolveDemoDurations(demo, durationPanels, durationTracks)
}

/**
 * Bring every demo that has not started in line with the current panel times. Demos on stage
 * or finished keep the times they ran with. Idempotent; returns how many sessions changed.
 *
 * All reads happen before the first mutation (MikroORM 7), and the flush is ours.
 */
export async function syncDemoDurations(
  em: EntityManager,
  competitionId: string,
  scope: DemoDurationScope,
): Promise<number> {
  const resolve = await loadDemoDurationResolver(em, competitionId, scope)
  const sessions = await em.find(DemoSession, {
    competitionId,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
  } as FilterQuery<DemoSession>)

  let changed = 0
  const now = new Date()
  for (const session of sessions) {
    if (!isDemoMovable(session.status)) continue
    const durations = resolve({ trackId: session.trackId, round: session.round })
    if (
      session.presentationDurationMinutes === durations.presentationDurationMinutes
      && session.qaDurationMinutes === durations.qaDurationMinutes
    ) continue
    session.presentationDurationMinutes = durations.presentationDurationMinutes
    session.qaDurationMinutes = durations.qaDurationMinutes
    session.updatedAt = now
    em.persist(session)
    changed += 1
  }
  if (changed > 0) await em.flush()
  return changed
}

type EventBus = { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }

/** `syncDemoDurations` plus the queue broadcast, for callers that already committed their own write. */
export async function syncDemoDurationsAndNotify(
  container: { resolve: (name: string) => unknown },
  competitionId: string,
  scope: DemoDurationScope,
): Promise<number> {
  // A fork: the caller's unit of work may still hold entities from its own write.
  const em = (container.resolve('em') as EntityManager).fork()
  const changed = await syncDemoDurations(em, competitionId, scope)
  if (changed > 0) {
    try {
      await (container.resolve('eventBus') as EventBus).emit('judging.demo.queue_updated', {
        competitionId,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      })
    } catch (e) {
      console.error('[judging:demo-durations] Event emit error:', e)
    }
  }
  return changed
}
