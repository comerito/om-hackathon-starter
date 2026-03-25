import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { CompetitionInvitation, CompetitionParticipation } from '../data/entities'

export const metadata = {
  event: 'customer_accounts.invitation.accepted',
  persistent: true,
  id: 'competitions:create-participation-on-invite-accept',
}

type Payload = {
  invitationId: string
  userId: string
  tenantId: string
}

export default async function handler(
  payload: Payload,
  ctx: { resolve: <T = unknown>(name: string) => T },
) {
  const em = ctx.resolve('em') as EntityManager

  // Look up competition invitation metadata
  const competitionInvitation = await em.findOne(CompetitionInvitation, {
    customerInvitationId: payload.invitationId,
  } as FilterQuery<CompetitionInvitation>)

  // If this invitation wasn't a competition invite, do nothing
  if (!competitionInvitation) return

  // Check for existing participation (idempotency)
  const existing = await em.findOne(CompetitionParticipation, {
    competitionId: competitionInvitation.competitionId,
    customerUserId: payload.userId,
    tenantId: payload.tenantId,
    deletedAt: null,
  } as FilterQuery<CompetitionParticipation>)
  if (existing) return

  // Create participation
  const participation = em.create(CompetitionParticipation, {
    competitionId: competitionInvitation.competitionId,
    customerUserId: payload.userId,
    role: competitionInvitation.participationRole,
    tenantId: competitionInvitation.tenantId,
    organizationId: competitionInvitation.organizationId,
  })
  await em.persistAndFlush(participation)
}
