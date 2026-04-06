import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import { CompetitionInvitation, CompetitionParticipation } from '../data/entities'
import { participationCrudEvents, participationCrudIndexer } from '../commands/participations'

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
  const LOG = '[create-participation-on-invite-accept]'
  const em = ctx.resolve('em') as EntityManager

  console.log(LOG, 'Event received:', JSON.stringify(payload))

  // Look up competition invitation metadata
  const competitionInvitation = await em.findOne(CompetitionInvitation, {
    customerInvitationId: payload.invitationId,
  } as FilterQuery<CompetitionInvitation>)

  // If this invitation wasn't a competition invite, do nothing
  if (!competitionInvitation) {
    console.log(LOG, `No CompetitionInvitation found for customerInvitationId=${payload.invitationId} — not a competition invite or record missing`)
    return
  }

  console.log(LOG, `Found CompetitionInvitation: id=${competitionInvitation.id}, competitionId=${competitionInvitation.competitionId}, role=${competitionInvitation.participationRole}`)

  // Check for existing participation (idempotency)
  const existing = await em.findOne(CompetitionParticipation, {
    competitionId: competitionInvitation.competitionId,
    customerUserId: payload.userId,
    tenantId: payload.tenantId,
    deletedAt: null,
  } as FilterQuery<CompetitionParticipation>)
  if (existing) {
    console.log(LOG, `Participation already exists: id=${existing.id} — skipping`)
    return
  }

  try {
    // Create participation
    const participation = em.create(CompetitionParticipation, {
      competitionId: competitionInvitation.competitionId,
      customerUserId: payload.userId,
      role: competitionInvitation.participationRole,
      checkedIn: false,
      badgePrinted: false,
      cocAccepted: false,
      privacyPolicyAccepted: false,
      profileComplete: false,
      lookingForTeam: false,
      tenantId: competitionInvitation.tenantId,
      organizationId: competitionInvitation.organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await em.persistAndFlush(participation)
    console.log(LOG, `Created participation: id=${participation.id} for userId=${payload.userId} in competition=${competitionInvitation.competitionId}`)

    // Index the participation so it appears in back office listings
    const de = ctx.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: participation,
      identifiers: {
        id: String(participation.id),
        tenantId: competitionInvitation.tenantId,
        organizationId: competitionInvitation.organizationId,
      },
      events: participationCrudEvents,
      indexer: participationCrudIndexer,
    })
  } catch (error) {
    console.error(LOG, 'Failed to create participation:', error)
    throw error
  }
}
