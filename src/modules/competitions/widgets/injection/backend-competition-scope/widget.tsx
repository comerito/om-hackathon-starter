"use client"
import * as React from 'react'
import { Home, Trophy } from 'lucide-react'
import type { InjectionWidgetModule } from '@open-mercato/shared/modules/widgets/injection'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@open-mercato/ui/primitives/select'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useCompetitionOptions } from '../../../lib/useCompetitionOptions'
import { useCompetitionScope, setCompetitionScopeId } from '@/lib/competition-scope'

/** Sentinel for the "Home" entry — Radix Select rejects an empty item value. */
const HOME_VALUE = '__home__'

const stageLabels: Record<string, string> = {
  draft: 'Draft',
  open: 'Open',
  team_formation: 'Formation',
  track_selection: 'Tracks',
  hacking: 'Hacking',
  demos: 'Demos',
  deliberation: 'Judging',
  finished: 'Done',
  archived: 'Archived',
}

function CompetitionScopePicker() {
  const t = useT()
  const { competitionId, ready } = useCompetitionScope()
  const { data: competitions, isLoading } = useCompetitionOptions()

  const items = React.useMemo(() => competitions ?? [], [competitions])

  // An org switch (or a deleted event) can leave a stale id pinned in storage.
  // Fall back to Home rather than silently filtering every list to nothing.
  React.useEffect(() => {
    // `items.length === 0` also covers a failed fetch — never drop a valid
    // scope just because the competitions request errored out.
    if (!ready || isLoading || !competitionId || items.length === 0) return
    if (!items.some((c) => c.id === competitionId)) setCompetitionScopeId(null)
  }, [ready, isLoading, competitionId, items])

  // Nothing to scope to — keep the header clean.
  if (items.length === 0) return null

  const selected = competitionId ? items.find((c) => c.id === competitionId) ?? null : null

  return (
    <Select
      value={selected ? selected.id : HOME_VALUE}
      onValueChange={(value) => setCompetitionScopeId(value === HOME_VALUE ? null : value)}
    >
      <SelectTrigger
        size="xs"
        className="w-auto min-w-0 max-w-[13rem] gap-1.5"
        aria-label={t('competitions.scope.ariaLabel', 'Competition scope')}
      >
        {selected ? (
          <Trophy className="size-3.5 text-muted-foreground" aria-hidden="true" />
        ) : (
          <Home className="size-3.5 text-muted-foreground" aria-hidden="true" />
        )}
        <SelectValue>
          <span className="truncate">
            {selected ? selected.name : t('competitions.scope.home', 'All competitions')}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end" className="max-h-80">
        <SelectItem value={HOME_VALUE}>
          <span className="flex items-center gap-2">
            <Home className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {t('competitions.scope.home', 'All competitions')}
          </span>
        </SelectItem>
        <SelectSeparator />
        {items.map((competition) => (
          <SelectItem key={competition.id} value={competition.id}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{competition.name}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                {stageLabels[competition.stage] ?? competition.stage}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const widget: InjectionWidgetModule = {
  metadata: {
    // `title` is mandatory for component widgets — the loader throws without it
    // and InjectionSpot swallows the error, so the widget just never appears.
    id: 'competitions.backend-competition-scope',
    title: 'Competition scope picker',
    description: 'Header picker that scopes every HackOn list to one competition.',
    features: ['competitions.view'],
  },
  Widget: CompetitionScopePicker,
}

export default widget
