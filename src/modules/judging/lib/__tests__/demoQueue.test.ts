import * as fs from 'node:fs'
import * as path from 'node:path'
import { computeHardDeadline, formatQueuePosition, resolveTrackName } from '../demoQueue'

/**
 * Regression guard for issue #114: the demo kiosk's "Up Next" bar rendered the literals
 * "POZYCJA W KOLEJCE 02" and "SCIEZKA: INFRASTRUKTURA" on the big screen shown to the whole
 * audience — a track that did not exist in the competition at all — while the feed it was
 * already polling carried a real `presentation_order` and `track_id`.
 */

describe('formatQueuePosition', () => {
  it('renders the 0-based order the way every other judging surface does', () => {
    // Matches `presentation_order + 1` padded to two digits in the presentations portal page
    // and JudgingDashboard's `#` column.
    expect(formatQueuePosition(0)).toBe('01')
    expect(formatQueuePosition(1)).toBe('02')
    expect(formatQueuePosition(8)).toBe('09')
  })

  it('reproduces the issue: Team Borealis at presentation_order 1 is position 02', () => {
    expect(formatQueuePosition(1)).toBe('02')
  })

  it('stops padding past two digits instead of truncating', () => {
    expect(formatQueuePosition(9)).toBe('10')
    expect(formatQueuePosition(99)).toBe('100')
  })

  it('returns null rather than a plausible number when the order is unusable', () => {
    // A wrong position on a projector misdirects the room; no position just omits the label.
    expect(formatQueuePosition(null)).toBeNull()
    expect(formatQueuePosition(undefined)).toBeNull()
    expect(formatQueuePosition(-1)).toBeNull()
    expect(formatQueuePosition(1.5)).toBeNull()
    expect(formatQueuePosition(Number.NaN)).toBeNull()
    expect(formatQueuePosition(Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('resolveTrackName', () => {
  const TRACKS = [
    { id: 'a955b129-4590-4522-8c8e-9905d046bf6c', name: 'Developer Experience' },
    { id: 'b0000000-0000-0000-0000-000000000000', name: 'AI Agents' },
    { id: 'c0000000-0000-0000-0000-000000000000', name: 'Green Tech' },
  ]

  it('resolves the id the demo feed actually returns', () => {
    // The exact id and name from the issue's evidence block.
    expect(resolveTrackName('a955b129-4590-4522-8c8e-9905d046bf6c', TRACKS)).toBe('Developer Experience')
  })

  it('returns null for an id the competition does not have', () => {
    // This is the whole point of #114 — a wrong track name is worse than no track name.
    expect(resolveTrackName('deadbeef-0000-0000-0000-000000000000', TRACKS)).toBeNull()
  })

  it('returns null when there is no id or no track list yet', () => {
    expect(resolveTrackName(null, TRACKS)).toBeNull()
    expect(resolveTrackName(undefined, TRACKS)).toBeNull()
    expect(resolveTrackName('a955b129-4590-4522-8c8e-9905d046bf6c', [])).toBeNull()
  })

  it('treats an empty name as unknown', () => {
    expect(resolveTrackName('x', [{ id: 'x', name: '' }])).toBeNull()
  })
})

describe('computeHardDeadline', () => {
  const demo = {
    actual_start: '2026-09-13T10:00:00.000Z',
    presentation_duration_minutes: 5,
    qa_duration_minutes: 3,
  }

  it('is the start plus the presentation and Q&A allowances', () => {
    expect(computeHardDeadline(demo)?.toISOString()).toBe('2026-09-13T10:08:00.000Z')
  })

  it('is never the "00:00:00" the label used to hard-code', () => {
    const deadline = computeHardDeadline(demo)
    expect(deadline).not.toBeNull()
    expect(deadline!.getTime()).toBeGreaterThan(new Date(demo.actual_start).getTime())
  })

  it('returns null when the slot has not started, or the feed is unusable', () => {
    expect(computeHardDeadline({ ...demo, actual_start: null })).toBeNull()
    expect(computeHardDeadline({ ...demo, actual_start: 'not a date' })).toBeNull()
    expect(computeHardDeadline(null)).toBeNull()
    expect(computeHardDeadline(undefined)).toBeNull()
  })
})

describe('kiosk page no longer carries invented values', () => {
  const repoRoot = path.resolve(__dirname, '../../../../..')
  const read = (p: string) => fs.readFileSync(path.join(repoRoot, p), 'utf8')
  const KIOSK = 'src/modules/judging/frontend/[orgSlug]/portal/kiosk/page.tsx'

  it('declares the fields the feed returns, so they can be rendered', () => {
    const page = read(KIOSK)
    expect(page).toContain('track_id')
    expect(page).toContain('presentation_order')
  })

  it('no longer hard-codes a queue position, a track or a zero deadline', () => {
    const page = read(KIOSK)
    expect(page).not.toContain("position: '02'")
    expect(page).not.toContain('trackFallback')
    expect(page).not.toContain('00:00:00')
    // The stacked avatars for team-mates the kiosk never knew about.
    expect(page).not.toContain('avatarFallback')
  })

  it('sources the track name from the competition track list', () => {
    expect(read(KIOSK)).toContain('type=tracks')
  })

  it.each(['en', 'pl'])('keeps the %s dictionary in step with the page', (locale) => {
    const messages = JSON.parse(read(`src/modules/judging/i18n/${locale}.json`)) as Record<string, string>
    // Retired together with the literals they carried.
    expect(messages['judging.portal.kiosk.trackFallback']).toBeUndefined()
    expect(messages['judging.portal.kiosk.avatarFallback.team']).toBeUndefined()
    // The deadline is interpolated now, in both locales — a half-translated string is its own
    // reported bug class in this app.
    expect(messages['judging.portal.kiosk.hardDeadline']).toContain('{time}')
    expect(messages['judging.portal.kiosk.queuePosition']).toContain('{position}')
  })
})
