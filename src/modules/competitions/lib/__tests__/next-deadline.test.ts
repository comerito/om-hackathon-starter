import { selectNextDeadline } from '../next-deadline'

const NOW = new Date('2026-03-20T12:00:00.000Z')
const labels = { submission: 'Final Submission', eventEnd: 'Event ends' }

const base = { labels, now: NOW }

describe('selectNextDeadline', () => {
  it('never labels the competition end as a submission deadline when none is configured', () => {
    const picked = selectNextDeadline({
      ...base,
      submissionDeadline: null,
      endsAt: '2026-03-22T18:00:00.000Z',
    })
    expect(picked).toEqual({ kind: 'event_end', title: 'Event ends', date: '2026-03-22T18:00:00.000Z' })
    expect(picked?.title).not.toBe(labels.submission)
  })

  it('shows a configured submission deadline under the submission label', () => {
    const picked = selectNextDeadline({
      ...base,
      submissionDeadline: '2026-03-21T18:00:00.000Z',
      endsAt: '2026-03-22T18:00:00.000Z',
    })
    expect(picked).toEqual({ kind: 'submission', title: 'Final Submission', date: '2026-03-21T18:00:00.000Z' })
  })

  it('uses the submission deadline instead of the event end, never both', () => {
    // A submission deadline after the event end must still replace, not accompany, ends_at.
    const picked = selectNextDeadline({
      ...base,
      submissionDeadline: '2026-03-25T18:00:00.000Z',
      endsAt: '2026-03-22T18:00:00.000Z',
    })
    expect(picked?.kind).toBe('submission')
    expect(picked?.date).toBe('2026-03-25T18:00:00.000Z')
  })

  it('treats an empty-string submission deadline as unset', () => {
    const picked = selectNextDeadline({ ...base, submissionDeadline: '', endsAt: '2026-03-22T18:00:00.000Z' })
    expect(picked?.kind).toBe('event_end')
  })

  it('ignores an unparseable submission deadline rather than rendering "Invalid Date"', () => {
    const picked = selectNextDeadline({ ...base, submissionDeadline: 'not-a-date', endsAt: '2026-03-22T18:00:00.000Z' })
    expect(picked?.kind).toBe('event_end')
  })

  it('returns null when there is nothing dated at all', () => {
    expect(selectNextDeadline({ ...base, submissionDeadline: null, endsAt: null })).toBeNull()
    expect(selectNextDeadline({ ...base })).toBeNull()
  })

  it('prefers the soonest future candidate across all sources', () => {
    const picked = selectNextDeadline({
      ...base,
      agendaDeadline: { title: 'Demo upload', date: '2026-03-21T09:00:00.000Z' },
      milestone: { title: 'MVP ready', date: '2026-03-20T20:00:00.000Z' },
      submissionDeadline: '2026-03-21T18:00:00.000Z',
      endsAt: '2026-03-22T18:00:00.000Z',
    })
    expect(picked).toMatchObject({ kind: 'milestone', title: 'MVP ready' })
  })

  it('skips past candidates while any future one remains', () => {
    const picked = selectNextDeadline({
      ...base,
      milestone: { title: 'Kickoff', date: '2026-03-19T09:00:00.000Z' },
      submissionDeadline: '2026-03-21T18:00:00.000Z',
    })
    expect(picked).toMatchObject({ kind: 'submission' })
  })

  it('falls back to the most recent past candidate when everything is over', () => {
    const picked = selectNextDeadline({
      ...base,
      milestone: { title: 'Kickoff', date: '2026-03-18T09:00:00.000Z' },
      submissionDeadline: null,
      endsAt: '2026-03-19T18:00:00.000Z',
    })
    expect(picked).toMatchObject({ kind: 'event_end', date: '2026-03-19T18:00:00.000Z' })
  })

  it('drops agenda/milestone entries with a missing date or blank title', () => {
    const picked = selectNextDeadline({
      ...base,
      agendaDeadline: { title: 'No date', date: null },
      milestone: { title: '   ', date: '2026-03-20T20:00:00.000Z' },
      submissionDeadline: '2026-03-21T18:00:00.000Z',
    })
    expect(picked).toMatchObject({ kind: 'submission' })
  })

  it('does not fall back to the event end when a submission deadline is set but in the past', () => {
    // The honest answer is the missed submission deadline, not a relabelled ends_at.
    const picked = selectNextDeadline({
      ...base,
      submissionDeadline: '2026-03-19T18:00:00.000Z',
      endsAt: '2026-03-19T20:00:00.000Z',
    })
    expect(picked).toMatchObject({ kind: 'submission', date: '2026-03-19T18:00:00.000Z' })
  })

  it('defaults the clock to the real now when none is injected', () => {
    const farFuture = new Date(Date.now() + 86_400_000).toISOString()
    const picked = selectNextDeadline({ labels, submissionDeadline: farFuture })
    expect(picked).toMatchObject({ kind: 'submission', date: farFuture })
  })
})
