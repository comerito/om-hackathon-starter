/**
 * How long a demo gets on stage: presentation + Q&A minutes.
 *
 * Resolution order, per field:
 *   1. the judging panel that hears the demo (same round, covers the demo's track),
 *   2. the hard-coded defaults below.
 *
 * `competition.demoConfig` is deliberately NOT a layer: every competition row carries the
 * schema default (3 / 2) and nothing in the UI edits it, so it would silently override the
 * defaults for everyone.
 *
 * Pure: callers load panels and their tracks up front.
 */

export const DEFAULT_PRESENTATION_MINUTES = 5
export const DEFAULT_QA_MINUTES = 2

export type DurationPanel = {
  id: string
  round: string
  presentationDurationMinutes?: number | null
  qaDurationMinutes?: number | null
}

export type DurationPanelTrack = { panelId: string; trackId: string }

export type ResolvedDemoDurations = {
  presentationDurationMinutes: number
  qaDurationMinutes: number
  /** Panel that supplied at least one of the values, when any did. */
  panelId: string | null
}

function validMinutes(value: unknown, min: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min ? value : null
}

/**
 * Panels that hear a demo: same round, and the demo's track is assigned to the panel. A panel
 * with no track assignments covers nothing — the same reading `lib/panelScope.ts` uses for
 * scoring. Ordered by id so two panels sharing a track resolve deterministically.
 */
export function panelsHearingDemo(
  demo: { trackId: string; round: string },
  panels: readonly DurationPanel[],
  panelTracks: readonly DurationPanelTrack[],
): DurationPanel[] {
  const covering = new Set(panelTracks.filter((pt) => pt.trackId === demo.trackId).map((pt) => pt.panelId))
  return panels
    .filter((panel) => panel.round === demo.round && covering.has(panel.id))
    .sort((a, b) => a.id.localeCompare(b.id))
}

export function resolveDemoDurations(
  demo: { trackId: string; round: string },
  panels: readonly DurationPanel[],
  panelTracks: readonly DurationPanelTrack[],
): ResolvedDemoDurations {
  const hearing = panelsHearingDemo(demo, panels, panelTracks)
  const presentationPanel = hearing.find((panel) => validMinutes(panel.presentationDurationMinutes, 1) !== null)
  const qaPanel = hearing.find((panel) => validMinutes(panel.qaDurationMinutes, 0) !== null)

  return {
    presentationDurationMinutes:
      validMinutes(presentationPanel?.presentationDurationMinutes, 1)
      ?? DEFAULT_PRESENTATION_MINUTES,
    qaDurationMinutes:
      validMinutes(qaPanel?.qaDurationMinutes, 0)
      ?? DEFAULT_QA_MINUTES,
    panelId: presentationPanel?.id ?? qaPanel?.id ?? null,
  }
}
