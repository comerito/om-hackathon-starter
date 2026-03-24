import type { ResponseEnricher } from '@open-mercato/shared/lib/crud/response-enricher'
import type { EntityManager } from '@mikro-orm/postgresql'
import { JudgePanelJudge, JudgePanelTrack } from './entities'

type PanelRecord = Record<string, unknown> & { id: string }

const panelMembersEnricher: ResponseEnricher<PanelRecord, { _judging: { judgeCount: number; trackCount: number } }> = {
  id: 'judging.panel-members',
  targetEntity: 'judging:judge_panel',
  priority: 10,
  timeout: 2000,
  fallback: { _judging: { judgeCount: 0, trackCount: 0 } },

  async enrichOne(record, context) {
    const em = (context.em as EntityManager).fork()
    const judgeCount = await em.count(JudgePanelJudge, { panelId: record.id, organizationId: context.organizationId })
    const trackCount = await em.count(JudgePanelTrack, { panelId: record.id, organizationId: context.organizationId })
    return { ...record, _judging: { judgeCount, trackCount } }
  },

  async enrichMany(records, context) {
    const em = (context.em as EntityManager).fork()
    const panelIds = records.map(r => r.id)
    if (!panelIds.length) return records.map(r => ({ ...r, _judging: { judgeCount: 0, trackCount: 0 } }))

    const judges = await em.find(JudgePanelJudge, { panelId: { $in: panelIds }, organizationId: context.organizationId })
    const tracks = await em.find(JudgePanelTrack, { panelId: { $in: panelIds }, organizationId: context.organizationId })

    const judgeMap = new Map<string, number>()
    const trackMap = new Map<string, number>()
    for (const j of judges) judgeMap.set(j.panelId, (judgeMap.get(j.panelId) ?? 0) + 1)
    for (const t of tracks) trackMap.set(t.panelId, (trackMap.get(t.panelId) ?? 0) + 1)

    return records.map(r => ({
      ...r,
      _judging: { judgeCount: judgeMap.get(r.id) ?? 0, trackCount: trackMap.get(r.id) ?? 0 },
    }))
  },
}

export const enrichers: ResponseEnricher[] = [panelMembersEnricher]
