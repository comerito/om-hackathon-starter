"use client"
import * as React from 'react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { PORTAL_SELECTION_EVENT, PORTAL_SELECTION_KEYS } from '@/components/portal/portal-selection'
import { AcceptTermsGate } from './AcceptTermsGate'

type CompetitionSummary = {
  id: string
  name: string
  slug: string
  stage: string
  role: string
  starts_at: string
  ends_at: string
  location: string | null
  timezone: string
  max_team_size?: number
  max_tracks_per_team?: number
  allow_track_change?: boolean
}

type CompetitionContextValue = {
  competitions: CompetitionSummary[]
  selected: CompetitionSummary | null
  selectedId: string | null
  setSelectedId: (id: string) => void
  isLoading: boolean
}

const CompetitionContext = React.createContext<CompetitionContextValue>({
  competitions: [],
  selected: null,
  selectedId: null,
  setSelectedId: () => {},
  isLoading: true,
})

export function useCompetitionContext() {
  return React.useContext(CompetitionContext)
}

const STORAGE_KEY = PORTAL_SELECTION_KEYS.competitionId
const STAGE_STORAGE_KEY = PORTAL_SELECTION_KEYS.stage
const ROLE_STORAGE_KEY = PORTAL_SELECTION_KEYS.role

/**
 * Publish the selection to the persistent layout chrome (sidebar, top bar, chat icon).
 *
 * `storage` events only reach *other* tabs, so this tab's own writes have to be announced
 * explicitly — otherwise the chrome, which the router never remounts, keeps rendering whatever
 * it read when the tab first loaded (#115: stage-gated sidebar items needing a reload).
 */
function publishSelection(competition: CompetitionSummary) {
  localStorage.setItem(STORAGE_KEY, competition.id)
  localStorage.setItem(STAGE_STORAGE_KEY, competition.stage)
  localStorage.setItem(ROLE_STORAGE_KEY, competition.role)
  window.dispatchEvent(new CustomEvent(PORTAL_SELECTION_EVENT, {
    detail: { competitionId: competition.id, stage: competition.stage, role: competition.role },
  }))
}

export function CompetitionProvider({ children }: { children: React.ReactNode }) {
  const [competitions, setCompetitions] = React.useState<CompetitionSummary[]>([])
  const [selectedId, setSelectedIdState] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  // Load competitions on mount
  React.useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const { ok, result } = await apiCall<{ items: CompetitionSummary[] }>(
          '/api/competitions/portal/my-competitions',
        )
        if (!mounted) return
        if (ok && result?.items) {
          setCompetitions(result.items)
          // Restore selection from localStorage or pick first
          const stored = localStorage.getItem(STORAGE_KEY)
          const valid = result.items.find(c => c.id === stored)
          if (valid) {
            setSelectedIdState(valid.id)
            publishSelection(valid)
          } else if (result.items.length > 0) {
            setSelectedIdState(result.items[0].id)
            publishSelection(result.items[0])
          }
        }
      } catch (err) {
        console.error('[CompetitionProvider] Failed to load competitions:', err)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const setSelectedId = React.useCallback((id: string) => {
    setSelectedIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
    const comp = competitions.find(c => c.id === id)
    if (comp) publishSelection(comp)
  }, [competitions])

  const selected = React.useMemo(
    () => competitions.find(c => c.id === selectedId) ?? null,
    [competitions, selectedId],
  )

  const value = React.useMemo<CompetitionContextValue>(
    () => ({ competitions, selected, selectedId, setSelectedId, isLoading }),
    [competitions, selected, selectedId, setSelectedId, isLoading],
  )

  return (
    <CompetitionContext.Provider value={value}>
      <AcceptTermsGate selectedId={selectedId}>
        {children}
      </AcceptTermsGate>
    </CompetitionContext.Provider>
  )
}
