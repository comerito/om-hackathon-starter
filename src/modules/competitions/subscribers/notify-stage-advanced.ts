import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { resolveNotificationService } from '@open-mercato/core/modules/notifications/lib/notificationService'
import { CompetitionParticipation, Competition } from '../data/entities'

const stageLabels: Record<string, string> = {
  draft: 'Draft', open: 'Registration Open', team_formation: 'Team Formation',
  track_selection: 'Track Selection', hacking: 'Hacking', demos: 'Demo Day',
  deliberation: 'Judging', finished: 'Results Announced', archived: 'Archived',
}

export const metadata = {
  event: 'competitions.competition.stage_advanced',
  persistent: true,
  id: 'competitions:notify-stage-advanced',
}

type Payload = {
  id: string
  stage?: string
  previousStage?: string
  tenantId: string
  organizationId: string
}

export default async function handler(
  payload: Payload,
  ctx: { resolve: <T = unknown>(name: string) => T },
) {
  const em = ctx.resolve('em') as EntityManager
  const notificationService = resolveNotificationService(ctx)

  // Get competition from DB (payload.stage may not be present)
  const competition = await em.findOne(Competition, { id: payload.id } as FilterQuery<Competition>)
  if (!competition) return
  const compName = competition.name ?? 'Competition'
  const stage = payload.stage ?? competition.stage
  const stageName = stageLabels[stage] ?? stage

  // Find all participants
  const participations = await em.find(CompetitionParticipation, {
    competitionId: payload.id,
    tenantId: payload.tenantId,
    deletedAt: null,
  } as FilterQuery<CompetitionParticipation>)

  if (participations.length === 0) return

  const recipientUserIds = participations.map(p => p.customerUserId)

  await notificationService.createBatch(
    {
      recipientUserIds,
      type: 'competitions.stage.advanced',
      title: `${compName} moved to ${stageName}`,
      titleKey: 'competitions.notifications.stageAdvanced.title',
      titleVariables: { competition: compName, stage: stageName },
      body: `The competition has entered the ${stageName} phase.`,
      icon: 'zap',
      severity: 'warning',
      sourceModule: 'competitions',
      sourceEntityType: 'competitions:competition',
      sourceEntityId: payload.id,
      groupKey: `stage-${payload.id}`,
    },
    { tenantId: payload.tenantId, organizationId: payload.organizationId },
  )
}
