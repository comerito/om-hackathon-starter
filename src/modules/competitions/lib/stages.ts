/**
 * Client-safe stage helpers.
 *
 * `data/entities.ts` owns the persisted `STAGE_ORDER`, but importing it pulls the
 * MikroORM decorators into whatever bundle does so — which rules it out for the
 * portal and back-office client components that need to reason about stage order.
 * This module mirrors that sequence with no runtime dependencies. Keep the two in
 * step; `__tests__/stages.test.ts` pins the sequence itself.
 */

export const STAGE_SEQUENCE = [
  'draft',
  'open',
  'team_formation',
  'track_selection',
  'hacking',
  'demos',
  'deliberation',
  'finished',
  'archived',
] as const

export type StageId = (typeof STAGE_SEQUENCE)[number]

/** Position of a stage in the lifecycle, or `-1` when the value is not a stage. */
export function stageIndex(stage: string | null | undefined): number {
  if (!stage) return -1
  return (STAGE_SEQUENCE as readonly string[]).indexOf(stage)
}

/**
 * True when `stage` is at or past `reference`. Unknown stages answer `false`:
 * a value we cannot place must not be treated as "already past" anything.
 */
export function isAtOrAfterStage(stage: string | null | undefined, reference: StageId): boolean {
  const idx = stageIndex(stage)
  return idx >= 0 && idx >= stageIndex(reference)
}

/** True when `stage` is strictly past `reference`. */
export function isAfterStage(stage: string | null | undefined, reference: StageId): boolean {
  const idx = stageIndex(stage)
  return idx >= 0 && idx > stageIndex(reference)
}

// ── Stage-advance preflight ─────────────────────────────────────────

export type PreflightTeam = {
  id: string
  name: string
  /** Deprecated single-track column, still the fallback for legacy rows. */
  trackId?: string | null
}

/**
 * Teams that would be silently left without a project when the competition enters
 * `hacking`, because `projects:create-draft-projects` creates one draft per team
 * *per assigned track* and a team with no track therefore gets none.
 *
 * Pure so the caller decides how to load the teams and their track assignments.
 */
export function teamsMissingTrack(
  teams: readonly PreflightTeam[],
  trackIdsByTeam: ReadonlyMap<string, readonly string[]>,
): PreflightTeam[] {
  return teams.filter((team) => {
    const assigned = trackIdsByTeam.get(team.id) ?? []
    if (assigned.length > 0) return false
    return !team.trackId
  })
}
