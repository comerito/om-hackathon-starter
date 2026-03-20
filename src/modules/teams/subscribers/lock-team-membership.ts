export const metadata = {
  event: 'competitions.competition.stage_advanced',
  persistent: true,
  id: 'teams:lock-team-membership',
}

export default async function handler(
  payload: { competitionId: string; oldStage: string; newStage: string; tenantId: string; organizationId: string },
  ctx: { resolve: <T = any>(name: string) => T },
) {
  // Only act when entering HACKING stage
  if (payload.newStage !== 'hacking') return

  const em = ctx.resolve('em') as import('@mikro-orm/postgresql').EntityManager

  // Log the lockdown — actual membership enforcement is done via stage checks in API routes
  console.log(
    `[teams:lock-team-membership] Competition ${payload.competitionId} entered HACKING stage. Team membership is now locked.`,
  )

  // Close all pending invitations for this competition
  const { TeamInvitation, InvitationStatus } = await import('../data/entities')
  const pendingInvitations = await em.find(TeamInvitation, {
    competitionId: payload.competitionId,
    status: InvitationStatus.PENDING,
    tenantId: payload.tenantId,
  } as import('@mikro-orm/postgresql').FilterQuery<InstanceType<typeof TeamInvitation>>)

  for (const inv of pendingInvitations) {
    inv.status = InvitationStatus.EXPIRED
    inv.respondedAt = new Date()
  }

  if (pendingInvitations.length > 0) {
    await em.persistAndFlush(pendingInvitations)
    console.log(`[teams:lock-team-membership] Expired ${pendingInvitations.length} pending invitations`)
  }
}
