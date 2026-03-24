export const metadata = {
  event: 'competitions.competition.stage_advanced',
  persistent: true,
  id: 'sponsors:close-voting',
}

export default async function handler(
  payload: { competitionId: string; oldStage: string; newStage: string; tenantId: string; organizationId: string },
  _ctx: { resolve: <T = unknown>(name: string) => T },
) {
  // Only act when entering DELIBERATION stage
  if (payload.newStage !== 'deliberation') return

  console.log(
    `[sponsors:close-voting] Competition ${payload.competitionId} entered DELIBERATION stage. Voting is now closed.`,
  )
  // Voting window is enforced by checking competition stage in the cast-vote endpoint.
  // No data mutation needed here — the stage change itself is the lock.
}
