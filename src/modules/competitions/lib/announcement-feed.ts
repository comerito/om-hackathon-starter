/**
 * Progressive reveal for the participant dashboard announcement feed.
 *
 * The portal `competition-data?type=announcements` endpoint returns the full,
 * already-ordered list for a competition (pinned first, then priority, then
 * newest — see `./announcement-order`). The dashboard therefore paginates that
 * single ordered array client-side instead of re-querying with limit/offset:
 * slicing one sorted array cannot drift out of order the way independently
 * fetched pages could.
 */

/** How many announcements the dashboard shows initially and adds per click. */
export const DASHBOARD_ANNOUNCEMENT_PAGE_SIZE = 5

export type AnnouncementFeedPage<T> = {
  /** The items to render right now. */
  visible: T[]
  /** True when at least one older item is still hidden. */
  hasMore: boolean
  /** How many items are still hidden. */
  remaining: number
  /** The `visibleCount` to move to when the user asks for older items. */
  nextVisibleCount: number
}

function normalizeCount(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  const rounded = Math.floor(value)
  return rounded > 0 ? rounded : fallback
}

/**
 * Slices `items` down to the first `visibleCount` entries and reports whether
 * older entries remain.
 *
 * @param visibleCount how many entries are currently revealed; values that are
 *   not a positive finite number fall back to `pageSize`
 * @param pageSize how many more entries a "load older" click reveals; values
 *   that are not a positive finite number fall back to
 *   {@link DASHBOARD_ANNOUNCEMENT_PAGE_SIZE}
 */
export function paginateAnnouncementFeed<T>(
  items: readonly T[] | null | undefined,
  visibleCount: number,
  pageSize: number = DASHBOARD_ANNOUNCEMENT_PAGE_SIZE,
): AnnouncementFeedPage<T> {
  const size = normalizeCount(pageSize, DASHBOARD_ANNOUNCEMENT_PAGE_SIZE)
  const count = normalizeCount(visibleCount, size)
  const all = items ?? []
  const visible = all.slice(0, count)
  const remaining = Math.max(0, all.length - visible.length)
  return {
    visible,
    hasMore: remaining > 0,
    remaining,
    nextVisibleCount: visible.length + size,
  }
}
