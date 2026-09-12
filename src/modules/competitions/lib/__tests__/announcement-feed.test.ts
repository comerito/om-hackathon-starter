import {
  DASHBOARD_ANNOUNCEMENT_PAGE_SIZE,
  paginateAnnouncementFeed,
} from '../announcement-feed'

const feed = (n: number) => Array.from({ length: n }, (_, i) => `a${i}`)

describe('paginateAnnouncementFeed', () => {
  it('reveals only the first page and reports the rest as older', () => {
    const page = paginateAnnouncementFeed(feed(12), DASHBOARD_ANNOUNCEMENT_PAGE_SIZE)
    expect(page.visible).toEqual(['a0', 'a1', 'a2', 'a3', 'a4'])
    expect(page.hasMore).toBe(true)
    expect(page.remaining).toBe(7)
    expect(page.nextVisibleCount).toBe(10)
  })

  it('walks the whole feed in order across successive clicks', () => {
    const items = feed(12)
    let count = DASHBOARD_ANNOUNCEMENT_PAGE_SIZE
    const seen: string[] = []
    for (let guard = 0; guard < 10; guard += 1) {
      const page = paginateAnnouncementFeed(items, count)
      seen.length = 0
      seen.push(...page.visible)
      if (!page.hasMore) break
      count = page.nextVisibleCount
    }
    // Order is preserved exactly as delivered by the API (pinned > priority > newest).
    expect(seen).toEqual(items)
    expect(paginateAnnouncementFeed(items, count).hasMore).toBe(false)
  })

  it('hides the control once everything is visible', () => {
    const page = paginateAnnouncementFeed(feed(5), DASHBOARD_ANNOUNCEMENT_PAGE_SIZE)
    expect(page.visible).toHaveLength(5)
    expect(page.hasMore).toBe(false)
    expect(page.remaining).toBe(0)
  })

  it('never over-slices a short or empty feed', () => {
    expect(paginateAnnouncementFeed(feed(2), 5).visible).toEqual(['a0', 'a1'])
    expect(paginateAnnouncementFeed([], 5)).toMatchObject({ visible: [], hasMore: false, remaining: 0 })
    expect(paginateAnnouncementFeed(undefined, 5)).toMatchObject({ visible: [], hasMore: false })
    expect(paginateAnnouncementFeed(null, 5)).toMatchObject({ visible: [], hasMore: false })
  })

  it('advances relative to what is actually shown, not the requested count', () => {
    // A count larger than the feed must not leave nextVisibleCount stranded ahead.
    const page = paginateAnnouncementFeed(feed(7), 100)
    expect(page.visible).toHaveLength(7)
    expect(page.hasMore).toBe(false)
    expect(page.nextVisibleCount).toBe(7 + DASHBOARD_ANNOUNCEMENT_PAGE_SIZE)
  })

  it('falls back to the page size for nonsensical counts', () => {
    for (const bad of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(paginateAnnouncementFeed(feed(12), bad).visible).toHaveLength(DASHBOARD_ANNOUNCEMENT_PAGE_SIZE)
    }
    expect(paginateAnnouncementFeed(feed(12), 5, 0).nextVisibleCount).toBe(10)
    expect(paginateAnnouncementFeed(feed(12), 5, -1).nextVisibleCount).toBe(10)
  })

  it('honours a custom page size', () => {
    const page = paginateAnnouncementFeed(feed(12), 3, 3)
    expect(page.visible).toHaveLength(3)
    expect(page.nextVisibleCount).toBe(6)
  })

  it('does not mutate or alias the input array', () => {
    const items = feed(3)
    const page = paginateAnnouncementFeed(items, 10)
    expect(page.visible).not.toBe(items)
    page.visible.push('mutated')
    expect(items).toHaveLength(3)
  })
})
