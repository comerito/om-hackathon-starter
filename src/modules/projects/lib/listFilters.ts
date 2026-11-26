import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { Team } from '../../teams/data/entities'
import { GalleryStatus, ProjectGallerySubmission } from '../data/entities'

/**
 * Gallery filter values exposed by the backoffice projects list. `none` means the project shows
 * "—" in the Gallery column: no sidecar row, or a row that never opted in and was never requested.
 */
export const GALLERY_FILTER_VALUES = [
  'none',
  GalleryStatus.NOT_REQUESTED,
  GalleryStatus.REQUESTED,
  GalleryStatus.PR_OPEN,
  GalleryStatus.PUBLISHED,
  GalleryStatus.REJECTED,
] as const
export type GalleryFilterValue = (typeof GALLERY_FILTER_VALUES)[number]

/** A UUID `gen_random_uuid()` never produces — `IN ()` does not parse, so "no match" uses this. */
export const NO_MATCH_ID = '00000000-0000-0000-0000-000000000000'

export type ListFilterConstraints = {
  /** Allowed team ids (null = unconstrained). */
  teamIds: string[] | null
  /** Allowed project ids (null = unconstrained). */
  projectIds: string[] | null
  /** Project ids to exclude (null = nothing excluded). */
  excludedProjectIds: string[] | null
}

type GalleryRow = Pick<ProjectGallerySubmission, 'projectId' | 'publishToGallery' | 'status'>

/** Mirrors the Gallery column: a row is "visible" unless it never opted in and was never requested. */
export function galleryRowMatches(row: GalleryRow, value: GalleryFilterValue): boolean {
  const shown = row.publishToGallery || row.status !== GalleryStatus.NOT_REQUESTED
  if (value === 'none') return !shown
  if (value === GalleryStatus.NOT_REQUESTED) return row.publishToGallery && row.status === GalleryStatus.NOT_REQUESTED
  return row.status === value
}

/**
 * Combine a caller-supplied exact id with allowed/excluded id sets into a single query-engine
 * filter. Returns `undefined` when nothing constrains the field.
 */
export function narrowIdFilter(
  exact: string | undefined,
  allowed: string[] | null,
  excluded: string[] | null,
): unknown {
  if (exact) {
    if (allowed && !allowed.includes(exact)) return { $in: [NO_MATCH_ID] }
    if (excluded && excluded.includes(exact)) return { $in: [NO_MATCH_ID] }
    return exact
  }
  if (allowed) return { $in: allowed.length > 0 ? allowed : [NO_MATCH_ID] }
  if (excluded && excluded.length > 0) return { $nin: excluded }
  return undefined
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

export async function resolveListFilterConstraints(
  em: EntityManager,
  input: {
    tenantId: string | null
    organizationIds: string[] | null
    teamName?: string
    galleryStatus?: GalleryFilterValue
  },
): Promise<ListFilterConstraints> {
  const scope: Record<string, unknown> = {}
  if (input.tenantId) scope.tenantId = input.tenantId
  if (input.organizationIds?.length) scope.organizationId = { $in: input.organizationIds }

  const result: ListFilterConstraints = { teamIds: null, projectIds: null, excludedProjectIds: null }

  const teamName = input.teamName?.trim()
  if (teamName) {
    const teams = await em.find(
      Team,
      { ...scope, deletedAt: null, name: { $ilike: `%${escapeLike(teamName)}%` } } as FilterQuery<Team>,
      { fields: ['id'] },
    )
    result.teamIds = teams.map((team) => String(team.id))
  }

  if (input.galleryStatus) {
    const value = input.galleryStatus
    const rows = await em.find(
      ProjectGallerySubmission,
      { ...scope, deletedAt: null } as FilterQuery<ProjectGallerySubmission>,
      { fields: ['projectId', 'publishToGallery', 'status'] },
    )
    if (value === 'none') {
      // Projects without a sidecar row also count as "none", so exclude the shown ones instead.
      result.excludedProjectIds = rows.filter((row) => !galleryRowMatches(row, 'none')).map((row) => row.projectId)
    } else {
      result.projectIds = rows.filter((row) => galleryRowMatches(row, value)).map((row) => row.projectId)
    }
  }

  return result
}
