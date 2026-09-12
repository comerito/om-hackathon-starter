"use client"
import * as React from 'react'

/**
 * Global backend competition scope.
 *
 * The backend chrome carries one competition picker (see
 * `widgets/injection/backend-competition-scope`). Every HackOn list page reads
 * the selection from here and narrows its query to that competition, so an
 * organiser picks the event once instead of re-filtering on every page.
 *
 * Mirrors the framework's `organizationEvents` store: module-level state plus a
 * window CustomEvent, so pages that never share a React tree still stay in sync.
 */

export const COMPETITION_SCOPE_CHANGED_EVENT = 'hackon:competition-scope-changed'
export const COMPETITION_SCOPE_STORAGE_KEY = 'hackon:backend-competition-scope'

/** `null` is "Home" — no scope, every competition visible. */
export type CompetitionScopeId = string | null

let currentScopeId: CompetitionScopeId = null
let hydrated = false

function readStoredScopeId(): CompetitionScopeId {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(COMPETITION_SCOPE_STORAGE_KEY)
    return raw && raw.length > 0 ? raw : null
  } catch {
    // Private mode / blocked storage — the scope still works for this page load.
    return null
  }
}

function normalize(id: CompetitionScopeId): CompetitionScopeId {
  return id && id.length > 0 ? id : null
}

/** Current scope, hydrating from localStorage on first browser read. */
export function getCompetitionScopeId(): CompetitionScopeId {
  if (!hydrated && typeof window !== 'undefined') {
    currentScopeId = readStoredScopeId()
    hydrated = true
  }
  return currentScopeId
}

export function setCompetitionScopeId(next: CompetitionScopeId): void {
  const normalized = normalize(next)
  getCompetitionScopeId()
  if (currentScopeId === normalized) return
  currentScopeId = normalized
  hydrated = true
  if (typeof window === 'undefined') return
  try {
    if (normalized) window.localStorage.setItem(COMPETITION_SCOPE_STORAGE_KEY, normalized)
    else window.localStorage.removeItem(COMPETITION_SCOPE_STORAGE_KEY)
  } catch {
    // Ignore — in-memory scope is still authoritative for this tab.
  }
  window.dispatchEvent(
    new CustomEvent<CompetitionScopeId>(COMPETITION_SCOPE_CHANGED_EVENT, { detail: normalized }),
  )
}

export function subscribeCompetitionScopeChanged(
  handler: (id: CompetitionScopeId) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  const onScopeEvent = (event: Event) => {
    handler(normalize((event as CustomEvent<CompetitionScopeId>).detail ?? null))
  }
  // Keep other tabs of the same admin in sync.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== COMPETITION_SCOPE_STORAGE_KEY) return
    currentScopeId = normalize(event.newValue)
    hydrated = true
    handler(currentScopeId)
  }
  window.addEventListener(COMPETITION_SCOPE_CHANGED_EVENT, onScopeEvent as EventListener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(COMPETITION_SCOPE_CHANGED_EVENT, onScopeEvent as EventListener)
    window.removeEventListener('storage', onStorage)
  }
}

export type CompetitionScope = {
  /** Selected competition, or `null` for Home (all competitions). */
  competitionId: CompetitionScopeId
  /**
   * False until localStorage has been read on the client. Gate list queries on
   * this (`enabled: ready`) so a scoped page never fires an unscoped request
   * first and flashes rows from other competitions.
   */
  ready: boolean
  setCompetitionId: (id: CompetitionScopeId) => void
}

/**
 * Read the global competition scope.
 *
 * Server render and hydration both report `{ competitionId: null, ready: false }`,
 * so there is no hydration mismatch; the stored scope lands on the first
 * post-hydration render.
 */
export function useCompetitionScope(): CompetitionScope {
  const [state, setState] = React.useState<{ competitionId: CompetitionScopeId; ready: boolean }>({
    competitionId: null,
    ready: false,
  })
  React.useEffect(() => {
    setState({ competitionId: getCompetitionScopeId(), ready: true })
    return subscribeCompetitionScopeChanged((competitionId) => {
      setState({ competitionId, ready: true })
    })
  }, [])
  return {
    competitionId: state.competitionId,
    ready: state.ready,
    setCompetitionId: setCompetitionScopeId,
  }
}

/**
 * Convenience for list pages: merges the scope into a query param bag.
 * Returns the params untouched when the scope is Home.
 */
export function withCompetitionScope(
  params: Record<string, string>,
  competitionId: CompetitionScopeId,
): Record<string, string> {
  if (!competitionId) return params
  return { ...params, competition_id: competitionId }
}
