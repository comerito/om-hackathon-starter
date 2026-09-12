"use client"

import * as React from 'react'
import {
  EMPTY_PORTAL_SELECTION,
  PORTAL_SELECTION_EVENT,
  PORTAL_SELECTION_KEYS,
  isSamePortalSelection,
  type PortalSelection,
} from './portal-selection'

function readSelection(): PortalSelection {
  if (typeof window === 'undefined') return EMPTY_PORTAL_SELECTION
  return {
    competitionId: localStorage.getItem(PORTAL_SELECTION_KEYS.competitionId),
    stage: localStorage.getItem(PORTAL_SELECTION_KEYS.stage),
    role: localStorage.getItem(PORTAL_SELECTION_KEYS.role),
  }
}

const STORAGE_KEY_SET: ReadonlySet<string> = new Set(Object.values(PORTAL_SELECTION_KEYS))

/**
 * Live view of the selected competition, its stage and the viewer's role in it.
 *
 * Starts empty so server and first client render agree, then reads localStorage on mount and
 * re-reads whenever the selection changes — in this tab (the `PORTAL_SELECTION_EVENT` that
 * `CompetitionProvider` dispatches on every write) or in another one (`storage`).
 *
 * Persistent layout chrome must use this rather than a one-shot `useEffect(…, [])` read: the
 * layout is not remounted by client-side navigation, so a one-shot read is frozen at the value
 * the tab happened to load with.
 */
export function usePortalSelection(): PortalSelection {
  const [selection, setSelection] = React.useState<PortalSelection>(EMPTY_PORTAL_SELECTION)

  React.useEffect(() => {
    const sync = () => {
      setSelection((prev) => {
        const next = readSelection()
        return isSamePortalSelection(prev, next) ? prev : next
      })
    }

    sync()

    // Same tab: CompetitionProvider announces its own writes.
    window.addEventListener(PORTAL_SELECTION_EVENT, sync)
    // Other tabs: `storage` fires only for keys we care about.
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || STORAGE_KEY_SET.has(event.key)) sync()
    }
    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener(PORTAL_SELECTION_EVENT, sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return selection
}
