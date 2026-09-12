/**
 * "Next deadline" selection for the participant dashboard tile.
 *
 * The tile used to always push the competition `ends_at` into the candidate list
 * under the "Final Submission" label, which presented the event end as a project
 * submission deadline even for competitions where `project_submission_deadline`
 * was never configured (and where `submit-project` therefore enforces no gate at
 * all). This module keeps the two dates apart:
 *
 *  - `project_submission_deadline` set  -> a real submission deadline, labelled as one
 *  - `project_submission_deadline` NULL -> the competition end, labelled as the event end
 *
 * A deadline is never fabricated, and `ends_at` is never relabelled as a submission
 * deadline.
 */

export type DeadlineKind = 'agenda' | 'milestone' | 'submission' | 'event_end'

export type NextDeadline = {
  /** Where the date came from — lets the caller style/route the tile if it wants. */
  kind: DeadlineKind
  /** Already-resolved, human-readable label. */
  title: string
  /** The original date string, untouched, so the caller formats it as it likes. */
  date: string
}

/** A dated entry coming from the agenda or the milestone list. */
export type DatedEntry = {
  title?: string | null
  date?: string | null
}

export type NextDeadlineInput = {
  /** Soonest upcoming agenda item of type `deadline`, if any. */
  agendaDeadline?: DatedEntry | null
  /** First non-completed milestone, if any. */
  milestone?: DatedEntry | null
  /** `competition.project_submission_deadline` — NULL when never configured. */
  submissionDeadline?: string | null
  /** `competition.ends_at`. */
  endsAt?: string | null
  /** Resolved labels for the two competition-level dates. */
  labels: {
    /** e.g. "Final Submission" — only ever used for a real submission deadline. */
    submission: string
    /** e.g. "Event ends" — used for `ends_at`. */
    eventEnd: string
  }
  /** Injectable clock; defaults to now. */
  now?: Date
}

function timeOf(value: string | null | undefined): number {
  if (!value) return Number.NaN
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? Number.NaN : time
}

function candidate(kind: DeadlineKind, title: string | null | undefined, date: string | null | undefined): NextDeadline | null {
  if (!date || Number.isNaN(timeOf(date))) return null
  const label = typeof title === 'string' ? title.trim() : ''
  if (!label) return null
  return { kind, title: label, date }
}

/**
 * Picks the deadline to advertise on the dashboard, or `null` when there is
 * nothing honest to show.
 *
 * The soonest still-future candidate wins. When every candidate is in the past,
 * the most recent past one is shown (that is the one participants just missed).
 */
export function selectNextDeadline(input: NextDeadlineInput): NextDeadline | null {
  const nowTime = (input.now ?? new Date()).getTime()

  const candidates: NextDeadline[] = []
  const agenda = candidate('agenda', input.agendaDeadline?.title, input.agendaDeadline?.date)
  if (agenda) candidates.push(agenda)
  const milestone = candidate('milestone', input.milestone?.title, input.milestone?.date)
  if (milestone) candidates.push(milestone)

  // Exactly one competition-level date, and it is labelled for what it actually is.
  const submission = candidate('submission', input.labels.submission, input.submissionDeadline)
  if (submission) {
    candidates.push(submission)
  } else {
    const eventEnd = candidate('event_end', input.labels.eventEnd, input.endsAt)
    if (eventEnd) candidates.push(eventEnd)
  }

  if (candidates.length === 0) return null

  const future = candidates.filter((c) => timeOf(c.date) > nowTime)
  if (future.length > 0) {
    return [...future].sort((a, b) => timeOf(a.date) - timeOf(b.date))[0]
  }
  return [...candidates].sort((a, b) => timeOf(b.date) - timeOf(a.date))[0]
}
