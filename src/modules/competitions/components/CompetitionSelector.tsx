"use client"
import * as React from 'react'
import { createPortal } from 'react-dom'
import { useCompetitionContext } from './CompetitionContext'

const stageLabels: Record<string, string> = {
  draft: 'Draft', open: 'Open', team_formation: 'Team Formation',
  track_selection: 'Track Selection', hacking: 'Hacking', demos: 'Demos',
  deliberation: 'Deliberation', finished: 'Finished', archived: 'Archived',
}

/**
 * Renders the competition selector into the portal header (next to notification bell)
 * using React createPortal. Falls back to inline rendering if header element not found.
 */
export function CompetitionSelector() {
  const { competitions, selected, selectedId, setSelectedId, isLoading } = useCompetitionContext()
  const [headerEl, setHeaderEl] = React.useState<Element | null>(null)

  React.useEffect(() => {
    // Find the right side of the portal header (the div containing the notification bell)
    const header = document.querySelector('[data-portal-handle="section:portal:header"]')
    if (header) {
      const rightSection = header.querySelector('.flex.items-center.gap-3:last-child')
      setHeaderEl(rightSection ?? header)
    }
  }, [])

  if (isLoading || competitions.length === 0) return null

  const selectorContent = (
    <select
      value={selectedId ?? ''}
      onChange={(e) => setSelectedId(e.target.value)}
      className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-w-[200px] truncate"
      aria-label="Select competition"
    >
      {competitions.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} — {stageLabels[c.stage] ?? c.stage}
        </option>
      ))}
    </select>
  )

  // Render into the header via portal, or inline as fallback
  if (headerEl) {
    return createPortal(selectorContent, headerEl)
  }

  return null
}
