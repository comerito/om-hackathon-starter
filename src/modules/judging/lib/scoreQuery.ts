import type { ScoresQueryInput } from '../data/validators'

/**
 * Tenant + organisation the caller is acting in. Both are mandatory: a score row is scoped by
 * `tenant_id` *and* `organization_id`, and filtering by tenant alone still mixes organisations.
 */
export type ScoreListScope = {
  tenantId: string
  organizationId: string
}

/**
 * Build the `ProjectScore` filter for the back-office score listing.
 *
 * Pure, so the scoping rule can be asserted directly: the competition, the tenant and the
 * organisation are always present, and the optional filters only ever narrow further. Returned
 * as a plain record because the route casts it to `FilterQuery<ProjectScore>` at the call site.
 */
export function buildScoreListFilter(
  query: ScoresQueryInput,
  scope: ScoreListScope,
): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    competitionId: query.competition_id,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
  }
  if (query.project_id) filter.projectId = query.project_id
  if (query.judge_id) filter.judgeId = query.judge_id
  if (query.round) filter.round = query.round
  return filter
}
