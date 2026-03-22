"use client"
import * as React from 'react'
import { useCompetitionContext } from './CompetitionContext'
import { useT } from '@open-mercato/shared/lib/i18n/context'

const stageLabels: Record<string, string> = {
  draft: 'Draft', open: 'Open', team_formation: 'Team Formation',
  track_selection: 'Track Selection', hacking: 'Hacking', demos: 'Demos',
  deliberation: 'Deliberation', finished: 'Finished', archived: 'Archived',
}

export function CompetitionSelector() {
  const t = useT()
  const { competitions, selected, selectedId, setSelectedId, isLoading } = useCompetitionContext()

  if (isLoading) return null
  if (competitions.length === 0) {
    return (
      <div className="mb-6 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        {t('competitions.portal.noCompetitions', 'You are not registered in any competition yet. Please contact the organizer.')}
      </div>
    )
  }
  if (competitions.length === 1) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{selected?.name}</span>
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {stageLabels[selected?.stage ?? ''] ?? selected?.stage}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2.5">
      <label htmlFor="competition-select" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        {t('competitions.portal.selectCompetition', 'Competition')}:
      </label>
      <select
        id="competition-select"
        value={selectedId ?? ''}
        onChange={(e) => setSelectedId(e.target.value)}
        className="flex h-8 w-full max-w-xs rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {competitions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} — {stageLabels[c.stage] ?? c.stage}
          </option>
        ))}
      </select>
    </div>
  )
}
