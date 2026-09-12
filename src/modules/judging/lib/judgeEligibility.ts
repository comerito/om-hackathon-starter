import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { CompetitionParticipation, ParticipationRole } from '../../competitions/data/entities'

/**
 * Who may sit on a judging panel.
 *
 * A judging panel belongs to exactly one competition, so panel membership is scoped to the
 * judges *of that competition* — the roster row in `competitions_participation` whose `role`
 * is `judge`. That roster is the competition-scoped projection of the portal customer role
 * `judge`: `competitions/api/admin/bulk-invite` resolves one `invitee.role` value into both
 * the customer role assignment (`roleIds: [roleId]` for the role with the same slug) and the
 * invitation's `participationRole`, and the invite-accept subscriber copies that role onto the
 * participation. The customer role is tenant-wide and therefore cannot tell a judge of *this*
 * competition from a judge of another one, so the participation role is what we scope on.
 */
export type JudgeEligibilityScope = {
  competitionId: string
  tenantId: string
}

function baseFilter(scope: JudgeEligibilityScope): FilterQuery<CompetitionParticipation> {
  return {
    competitionId: scope.competitionId,
    tenantId: scope.tenantId,
    role: ParticipationRole.JUDGE,
    deletedAt: null,
  } as FilterQuery<CompetitionParticipation>
}

/** Customer user IDs allowed on a panel of this competition, de-duplicated. */
export async function findEligibleJudgeIds(
  em: EntityManager,
  scope: JudgeEligibilityScope,
): Promise<string[]> {
  const rows = await em.find(CompetitionParticipation, baseFilter(scope), {
    orderBy: { createdAt: 'ASC' },
  })
  return [...new Set(rows.map((row) => row.customerUserId))]
}

/** True when `judgeId` holds the judge role in this competition. */
export async function isEligibleJudge(
  em: EntityManager,
  judgeId: string,
  scope: JudgeEligibilityScope,
): Promise<boolean> {
  const found = await em.findOne(CompetitionParticipation, {
    ...(baseFilter(scope) as Record<string, unknown>),
    customerUserId: judgeId,
  } as FilterQuery<CompetitionParticipation>)
  return !!found
}

export const NOT_A_JUDGE_ERROR =
  'This user is not a judge of the panel’s competition. Give them the Judge role on the competition roster first.'
