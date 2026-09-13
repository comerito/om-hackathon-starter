/**
 * What makes a track *offerable* to participants.
 *
 * A track that has been soft-deleted in the back-office, or deactivated, is gone as
 * far as the organiser is concerned: it must not appear in a picker and must not be
 * accepted as input. It may still be *resolved* — a team assigned to a track that was
 * later removed still needs its name rendered — so this is deliberately not a global
 * filter on every `Track` query, only on the offer/accept paths.
 */

/** Query fragment for "tracks a participant may be offered". */
export const SELECTABLE_TRACK_FILTER = {
  deletedAt: null,
  isActive: true,
} as const

export type TrackVisibility = {
  deletedAt?: Date | null
  isActive?: boolean | null
}

/** Mirror of {@link SELECTABLE_TRACK_FILTER} for rows already loaded. */
export function isSelectableTrack(track: TrackVisibility): boolean {
  if (track.deletedAt != null) return false
  return track.isActive === true
}

/** The ids of `trackIds` that are not offerable, preserving the requested order. */
export function unavailableTrackIds(
  trackIds: readonly string[],
  tracksById: ReadonlyMap<string, TrackVisibility>,
): string[] {
  return trackIds.filter((id) => {
    const track = tracksById.get(id)
    return track === undefined || !isSelectableTrack(track)
  })
}
