"use client"
import * as React from 'react'
import { ComboboxInput } from '@open-mercato/ui/backend/inputs/ComboboxInput'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'

type TrackOption = { value: string; label: string }

async function loadTracks(competitionId: string, query?: string): Promise<TrackOption[]> {
  const params: Record<string, string> = { pageSize: '50' }
  if (competitionId) params.competition_id = competitionId
  if (query) params.name = query
  const res = await fetchCrudList<{ id: string; name: string }>('tracks/tracks', params)
  return [
    { value: '', label: 'All tracks (global)' },
    ...(res?.items ?? []).map((t) => ({ value: t.id, label: t.name })),
  ]
}

export function TrackCombobox({
  value,
  competitionId,
  onChange,
}: {
  value: string
  competitionId: string
  onChange: (value: unknown) => void
}) {
  const loadSuggestions = React.useCallback(
    async (query?: string) => loadTracks(competitionId, query),
    [competitionId],
  )

  return (
    <ComboboxInput
      value={value}
      onChange={(next) => onChange(next)}
      placeholder="Type to search..."
      loadSuggestions={loadSuggestions}
      allowCustomValues={false}
    />
  )
}
