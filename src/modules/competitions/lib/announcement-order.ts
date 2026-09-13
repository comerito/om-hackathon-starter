import { AnnouncementPriority } from '../data/entities'

/**
 * Display rank for {@link AnnouncementPriority}. Lower sorts first.
 * The DB column is free-form text, so ordering must be resolved in code — an
 * `ORDER BY priority` would sort alphabetically (info < urgent < warning).
 */
export const ANNOUNCEMENT_PRIORITY_RANK: Record<AnnouncementPriority, number> = {
  [AnnouncementPriority.URGENT]: 0,
  [AnnouncementPriority.WARNING]: 1,
  [AnnouncementPriority.INFO]: 2,
}

/** Unknown / legacy priority values sort after every known one. */
const UNKNOWN_PRIORITY_RANK = Number.MAX_SAFE_INTEGER

export function announcementPriorityRank(priority: unknown): number {
  if (typeof priority !== 'string') return UNKNOWN_PRIORITY_RANK
  const rank = ANNOUNCEMENT_PRIORITY_RANK[priority as AnnouncementPriority]
  return typeof rank === 'number' ? rank : UNKNOWN_PRIORITY_RANK
}

export type AnnouncementOrderInput = {
  pinned?: boolean | null
  priority?: string | null
  published_at?: Date | string | number | null
}

function publishedAtMs(value: AnnouncementOrderInput['published_at']): number {
  if (value == null) return Number.NEGATIVE_INFINITY
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
}

/**
 * Participant-facing announcement ordering: pinned first, then by priority
 * (urgent > warning > info), then newest published first within each group.
 */
export function compareAnnouncementsForDisplay(
  a: AnnouncementOrderInput,
  b: AnnouncementOrderInput,
): number {
  const pinnedDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
  if (pinnedDiff !== 0) return pinnedDiff

  const priorityDiff = announcementPriorityRank(a.priority) - announcementPriorityRank(b.priority)
  if (priorityDiff !== 0) return priorityDiff

  return publishedAtMs(b.published_at) - publishedAtMs(a.published_at)
}

/** Returns a new array ordered by {@link compareAnnouncementsForDisplay}. */
export function sortAnnouncementsForDisplay<T extends AnnouncementOrderInput>(items: T[]): T[] {
  return [...items].sort(compareAnnouncementsForDisplay)
}
