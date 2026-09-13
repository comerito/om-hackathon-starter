import { AnnouncementPriority } from '../../data/entities'
import {
  ANNOUNCEMENT_PRIORITY_RANK,
  announcementPriorityRank,
  sortAnnouncementsForDisplay,
} from '../announcement-order'

type Row = {
  id: string
  pinned: boolean
  priority: string
  published_at: Date
}

const at = (iso: string) => new Date(iso)

const row = (id: string, pinned: boolean, priority: string, iso: string): Row => ({
  id,
  pinned,
  priority,
  published_at: at(iso),
})

const ids = (rows: Row[]) => sortAnnouncementsForDisplay(rows).map((r) => r.id)

describe('announcement display order', () => {
  it('ranks every AnnouncementPriority value, urgent first', () => {
    const ranked = Object.values(AnnouncementPriority)
      .slice()
      .sort((a, b) => ANNOUNCEMENT_PRIORITY_RANK[a] - ANNOUNCEMENT_PRIORITY_RANK[b])

    expect(ranked).toEqual([
      AnnouncementPriority.URGENT,
      AnnouncementPriority.WARNING,
      AnnouncementPriority.INFO,
    ])
    for (const priority of Object.values(AnnouncementPriority)) {
      expect(typeof ANNOUNCEMENT_PRIORITY_RANK[priority]).toBe('number')
    }
  })

  it('reproduces issue #96: pinned+urgent beats a newer unpinned info announcement', () => {
    const welcome = row('welcome', true, AnnouncementPriority.URGENT, '2026-01-01T07:17:00Z')
    const reminder = row('reminder', false, AnnouncementPriority.INFO, '2026-01-01T07:20:00Z')

    expect(ids([reminder, welcome])).toEqual(['welcome', 'reminder'])
  })

  it('puts every pinned announcement ahead of every unpinned one', () => {
    const pinnedOld = row('pinned-old', true, AnnouncementPriority.INFO, '2026-01-01T00:00:00Z')
    const unpinnedNewUrgent = row('unpinned-urgent', false, AnnouncementPriority.URGENT, '2026-06-01T00:00:00Z')

    expect(ids([unpinnedNewUrgent, pinnedOld])).toEqual(['pinned-old', 'unpinned-urgent'])
  })

  it('orders by priority within the same pinned group', () => {
    const info = row('info', false, AnnouncementPriority.INFO, '2026-01-03T00:00:00Z')
    const warning = row('warning', false, AnnouncementPriority.WARNING, '2026-01-02T00:00:00Z')
    const urgent = row('urgent', false, AnnouncementPriority.URGENT, '2026-01-01T00:00:00Z')

    expect(ids([info, warning, urgent])).toEqual(['urgent', 'warning', 'info'])
  })

  it('orders newest published first within the same pinned+priority group', () => {
    const older = row('older', false, AnnouncementPriority.INFO, '2026-01-01T00:00:00Z')
    const newer = row('newer', false, AnnouncementPriority.INFO, '2026-01-02T00:00:00Z')

    expect(ids([older, newer])).toEqual(['newer', 'older'])
  })

  it('accepts ISO strings as well as Date instances for published_at', () => {
    const rows = [
      { id: 'older', pinned: false, priority: AnnouncementPriority.INFO, published_at: '2026-01-01T00:00:00Z' },
      { id: 'newer', pinned: false, priority: AnnouncementPriority.INFO, published_at: '2026-01-02T00:00:00Z' },
    ]

    expect(sortAnnouncementsForDisplay(rows).map((r) => r.id)).toEqual(['newer', 'older'])
  })

  it('sorts unknown or missing priorities after the known ones instead of throwing', () => {
    const unknown = row('unknown', false, 'legacy-value', '2026-06-01T00:00:00Z')
    const info = row('info', false, AnnouncementPriority.INFO, '2026-01-01T00:00:00Z')

    expect(ids([unknown, info])).toEqual(['info', 'unknown'])
    expect(announcementPriorityRank(undefined)).toBeGreaterThan(
      ANNOUNCEMENT_PRIORITY_RANK[AnnouncementPriority.INFO],
    )
  })

  it('does not mutate the input array', () => {
    const input = [
      row('reminder', false, AnnouncementPriority.INFO, '2026-01-01T07:20:00Z'),
      row('welcome', true, AnnouncementPriority.URGENT, '2026-01-01T07:17:00Z'),
    ]
    const before = input.map((r) => r.id)

    sortAnnouncementsForDisplay(input)

    expect(input.map((r) => r.id)).toEqual(before)
  })
})
