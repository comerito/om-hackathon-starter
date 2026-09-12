import {
  SELECTABLE_TRACK_FILTER,
  isSelectableTrack,
  unavailableTrackIds,
  type TrackVisibility,
} from '../track-visibility'

const live: TrackVisibility = { deletedAt: null, isActive: true }
const softDeleted: TrackVisibility = { deletedAt: new Date('2026-09-12T06:58:53Z'), isActive: true }
const deactivated: TrackVisibility = { deletedAt: null, isActive: false }

describe('SELECTABLE_TRACK_FILTER', () => {
  it('is the query form of isSelectableTrack', () => {
    expect(SELECTABLE_TRACK_FILTER).toEqual({ deletedAt: null, isActive: true })
  })
})

describe('isSelectableTrack', () => {
  it('accepts a live, active track', () => {
    expect(isSelectableTrack(live)).toBe(true)
  })

  it('rejects the soft-deleted track from the issue report', () => {
    // tracks_track "ZZ Throwaway Probe", deleted_at = 2026-09-12 06:58:53+00
    expect(isSelectableTrack(softDeleted)).toBe(false)
  })

  it('rejects a deactivated track even though it was never deleted', () => {
    expect(isSelectableTrack(deactivated)).toBe(false)
  })

  it('rejects a track whose flags are missing rather than assuming the best', () => {
    expect(isSelectableTrack({})).toBe(false)
    expect(isSelectableTrack({ deletedAt: null })).toBe(false)
    expect(isSelectableTrack({ deletedAt: undefined, isActive: null })).toBe(false)
  })
})

describe('unavailableTrackIds', () => {
  const tracksById = new Map<string, TrackVisibility>([
    ['t-live', live],
    ['t-deleted', softDeleted],
    ['t-inactive', deactivated],
  ])

  it('names every id that may not be selected, in request order', () => {
    expect(unavailableTrackIds(['t-live', 't-deleted', 't-inactive'], tracksById))
      .toEqual(['t-deleted', 't-inactive'])
  })

  it('treats an id with no row at all as unavailable', () => {
    expect(unavailableTrackIds(['t-missing'], tracksById)).toEqual(['t-missing'])
  })

  it('returns nothing when every requested track is selectable', () => {
    expect(unavailableTrackIds(['t-live'], tracksById)).toEqual([])
    expect(unavailableTrackIds([], tracksById)).toEqual([])
  })
})
