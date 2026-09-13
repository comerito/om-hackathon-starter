/**
 * Presentation-queue display helpers for the demo kiosk.
 *
 * The kiosk is a big screen shown to the whole audience, so anything on it that is not backed by
 * the feed is a public mistake — issue #114: it rendered a hard-coded queue position and a track
 * name ("Infrastruktura") that did not exist in the competition at all. These helpers exist so
 * the derivations are asserted rather than eyeballed, and so "we do not actually know this"
 * has one explicit answer (`null` → the caller renders nothing) instead of a plausible literal.
 */

/**
 * Queue position as shown to the audience.
 *
 * `presentation_order` is 0-based everywhere it is assigned (`judging/commands/demos.ts`
 * renumbers with `others[i].presentationOrder = i`), and every other surface displays it as
 * `order + 1` zero-padded to two digits — see the presentations portal page and
 * `JudgingDashboard`'s `#` column. The kiosk now agrees with them instead of printing "02".
 *
 * Returns `null` when the order is missing or nonsensical, so the caller can omit the label
 * rather than show a wrong number on a projector.
 */
export function formatQueuePosition(order: number | null | undefined): string | null {
  if (typeof order !== 'number' || !Number.isFinite(order) || !Number.isInteger(order)) return null
  if (order < 0) return null
  return String(order + 1).padStart(2, '0')
}

/**
 * Track name for a demo session.
 *
 * `/api/judging/portal/current-demo` returns `track_id` but no track name, so the name has to be
 * looked up against the competition's tracks. An unknown or absent id yields `null` — the whole
 * point of #114 is that a wrong track name is worse than no track name.
 */
export function resolveTrackName(
  trackId: string | null | undefined,
  tracks: ReadonlyArray<{ id: string; name: string }>,
): string | null {
  if (!trackId) return null
  const name = tracks.find((track) => track.id === trackId)?.name
  return name && name.length > 0 ? name : null
}

/**
 * Wall-clock instant at which the presenting team's slot is over: its start plus the
 * presentation and Q&A allowances.
 *
 * This replaces a literal "Hard Deadline: 00:00:00" that was always zero. Every input comes from
 * the same feed the countdown already uses; `null` when the slot has not started, which is also
 * when the countdown itself is not rendered.
 */
export function computeHardDeadline(demo: {
  actual_start: string | null
  presentation_duration_minutes: number
  qa_duration_minutes: number
} | null | undefined): Date | null {
  if (!demo?.actual_start) return null
  const start = new Date(demo.actual_start).getTime()
  if (!Number.isFinite(start)) return null
  const total = (demo.presentation_duration_minutes + demo.qa_duration_minutes) * 60 * 1000
  if (!Number.isFinite(total)) return null
  return new Date(start + total)
}
