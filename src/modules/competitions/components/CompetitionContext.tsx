"use client"
import * as React from 'react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
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

const STORAGE_KEY = 'hackon:selected-competition'
const STAGE_STORAGE_KEY = 'hackon:selected-competition-stage'
const ROLE_STORAGE_KEY = 'hackon:selected-competition-role'

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
            localStorage.setItem(STAGE_STORAGE_KEY, valid.stage)
            localStorage.setItem(ROLE_STORAGE_KEY, valid.role)
            window.dispatchEvent(new CustomEvent('competition-role-changed', { detail: { role: valid.role } }))
          } else if (result.items.length > 0) {
            setSelectedIdState(result.items[0].id)
            localStorage.setItem(STORAGE_KEY, result.items[0].id)
            localStorage.setItem(STAGE_STORAGE_KEY, result.items[0].stage)
            localStorage.setItem(ROLE_STORAGE_KEY, result.items[0].role)
            window.dispatchEvent(new CustomEvent('competition-role-changed', { detail: { role: result.items[0].role } }))
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
    if (comp) {
      localStorage.setItem(STAGE_STORAGE_KEY, comp.stage)
      localStorage.setItem(ROLE_STORAGE_KEY, comp.role)
      window.dispatchEvent(new CustomEvent('competition-role-changed', { detail: { role: comp.role } }))
    }
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
