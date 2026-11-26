"use client"
import * as React from 'react'
import { X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { Input } from '@open-mercato/ui/primitives/input'
import { Button } from '@open-mercato/ui/primitives/button'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export type ProjectListFilters = {
  competition_id?: string
  track_id?: string
  /** A status value, or `submitted` for every non-draft status. */
  status?: string
  team_name?: string
  gallery_status?: string
  flagged_for_reuse?: 'true' | 'false'
  /** yyyy-mm-dd, local day */
  submitted_from?: string
  /** yyyy-mm-dd, local day */
  submitted_to?: string
}

export const SUBMITTED_STATUSES = ['published', 'under_review', 'scored']

/** Translate UI filter state into list API query params. */
export function toListQueryParams(filters: ProjectListFilters): Record<string, string> {
  const params: Record<string, string> = {}
  if (filters.competition_id) params.competition_id = filters.competition_id
  if (filters.track_id) params.track_id = filters.track_id
  if (filters.status) params.status = filters.status === 'submitted' ? SUBMITTED_STATUSES.join(',') : filters.status
  if (filters.team_name?.trim()) params.team_name = filters.team_name.trim()
  if (filters.gallery_status) params.gallery_status = filters.gallery_status
  if (filters.flagged_for_reuse) params.flagged_for_reuse = filters.flagged_for_reuse
  // Date inputs are local calendar days: widen them to the local day's bounds.
  if (filters.submitted_from) {
    const from = new Date(`${filters.submitted_from}T00:00:00`)
    if (!Number.isNaN(from.getTime())) params.submitted_from = from.toISOString()
  }
  if (filters.submitted_to) {
    const to = new Date(`${filters.submitted_to}T23:59:59.999`)
    if (!Number.isNaN(to.getTime())) params.submitted_to = to.toISOString()
  }
  return params
}

export function countActiveFilters(filters: ProjectListFilters, ignoreCompetition: boolean): number {
  return Object.entries(filters).filter(([key, value]) => {
    if (ignoreCompetition && key === 'competition_id') return false
    return typeof value === 'string' && value.trim().length > 0
  }).length
}

const ALL = '__all__'

type Option = { value: string; label: string; color?: string | null }

function FilterSelect({
  value,
  onChange,
  allLabel,
  options,
  ariaLabel,
  className,
}: {
  value: string | undefined
  onChange: (value: string | undefined) => void
  allLabel: string
  options: Array<Option | 'separator'>
  ariaLabel: string
  className?: string
}) {
  const active = Boolean(value)
  return (
    <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? undefined : next)}>
      <SelectTrigger
        size="sm"
        aria-label={ariaLabel}
        className={`w-auto min-w-[9rem] max-w-[15rem] ${active ? 'border-foreground/60 bg-muted/60 font-medium' : ''} ${className ?? ''}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        <SelectSeparator />
        {options.map((option, index) =>
          option === 'separator' ? (
            <SelectSeparator key={`sep-${index}`} />
          ) : (
            <SelectItem key={option.value} value={option.value}>
              <span className="inline-flex items-center gap-1.5">
                {option.color ? (
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />
                ) : null}
                <span className="truncate">{option.label}</span>
              </span>
            </SelectItem>
          ),
        )}
      </SelectContent>
    </Select>
  )
}

export function ProjectsInlineFilters({
  value,
  onChange,
  competitionOptions,
  trackOptions,
  showCompetition,
}: {
  value: ProjectListFilters
  onChange: (next: ProjectListFilters) => void
  competitionOptions: Option[]
  trackOptions: Option[]
  showCompetition: boolean
}) {
  const t = useT()
  // Team name is free text: debounce so every keystroke does not refetch the list.
  const [teamName, setTeamName] = React.useState(value.team_name ?? '')
  const valueRef = React.useRef(value)
  valueRef.current = value
  React.useEffect(() => {
    // Sync external changes (e.g. "clear") without eating a trailing space the user is typing.
    const external = value.team_name ?? ''
    setTeamName((current) => (current.trim() === external ? current : external))
  }, [value.team_name])
  React.useEffect(() => {
    const trimmed = teamName.trim()
    if (trimmed === (valueRef.current.team_name ?? '')) return
    const handle = setTimeout(() => onChange({ ...valueRef.current, team_name: trimmed || undefined }), 350)
    return () => clearTimeout(handle)
  }, [teamName, onChange])

  const set = (patch: Partial<ProjectListFilters>) => onChange({ ...value, ...patch })
  const activeCount = countActiveFilters(value, !showCompetition)

  const statusOptions: Array<Option | 'separator'> = [
    { value: 'submitted', label: t('projects.filters.status.submitted', 'Submitted (not draft)') },
    'separator',
    { value: 'draft', label: t('projects.filters.status.draft', 'Draft') },
    { value: 'published', label: t('projects.filters.status.published', 'Published') },
    { value: 'under_review', label: t('projects.filters.status.under_review', 'Under Review') },
    { value: 'scored', label: t('projects.filters.status.scored', 'Scored') },
  ]

  const galleryOptions: Option[] = [
    { value: 'none', label: t('projects.filters.gallery.none', 'Not in gallery') },
    { value: 'not_requested', label: t('projects.filters.gallery.not_requested', 'Opted in') },
    { value: 'requested', label: t('projects.filters.gallery.requested', 'Requested') },
    { value: 'pr_open', label: t('projects.filters.gallery.pr_open', 'PR open') },
    { value: 'published', label: t('projects.filters.gallery.published', 'Live') },
    { value: 'rejected', label: t('projects.filters.gallery.rejected', 'Not accepted') },
  ]

  const flagOptions: Option[] = [
    { value: 'true', label: t('projects.filters.flag.true', 'Flagged for reuse') },
    { value: 'false', label: t('projects.filters.flag.false', 'Not flagged') },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3" data-testid="projects-inline-filters">
      {showCompetition ? (
        <FilterSelect
          value={value.competition_id}
          // Tracks belong to a competition: drop a track that no longer applies.
          onChange={(next) => set({ competition_id: next, track_id: undefined })}
          allLabel={t('projects.filters.allCompetitions', 'All competitions')}
          options={competitionOptions}
          ariaLabel={t('projects.filters.competition', 'Competition')}
        />
      ) : null}
      <FilterSelect
        value={value.track_id}
        onChange={(next) => set({ track_id: next })}
        allLabel={t('projects.filters.allTracks', 'All tracks')}
        options={trackOptions}
        ariaLabel={t('projects.filters.track', 'Track')}
      />
      <FilterSelect
        value={value.status}
        onChange={(next) => set({ status: next })}
        allLabel={t('projects.filters.allStatuses', 'All statuses')}
        options={statusOptions}
        ariaLabel={t('projects.filters.status', 'Status')}
      />
      <Input
        value={teamName}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setTeamName(event.target.value)}
        placeholder={t('projects.filters.teamPlaceholder', 'Team name…')}
        aria-label={t('projects.filters.team', 'Team')}
        className="h-8 w-44 text-xs"
      />
      <FilterSelect
        value={value.gallery_status}
        onChange={(next) => set({ gallery_status: next })}
        allLabel={t('projects.filters.allGallery', 'Gallery: all')}
        options={galleryOptions}
        ariaLabel={t('projects.filters.gallery', 'Gallery')}
      />
      <FilterSelect
        value={value.flagged_for_reuse}
        onChange={(next) => set({ flagged_for_reuse: next === 'true' || next === 'false' ? next : undefined })}
        allLabel={t('projects.filters.allFlags', 'Flag: all')}
        options={flagOptions}
        ariaLabel={t('projects.filters.flag', 'Flag')}
      />
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{t('projects.filters.submitted', 'Submitted')}</span>
        <Input
          type="date"
          value={value.submitted_from ?? ''}
          max={value.submitted_to || undefined}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => set({ submitted_from: event.target.value || undefined })}
          aria-label={t('projects.filters.submittedFrom', 'Submitted from')}
          className="h-8 w-36 text-xs"
        />
        <span>–</span>
        <Input
          type="date"
          value={value.submitted_to ?? ''}
          min={value.submitted_from || undefined}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => set({ submitted_to: event.target.value || undefined })}
          aria-label={t('projects.filters.submittedTo', 'Submitted to')}
          className="h-8 w-36 text-xs"
        />
      </div>
      {activeCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1 px-2 text-xs"
          onClick={() => {
            setTeamName('')
            onChange(showCompetition ? {} : { competition_id: value.competition_id })
          }}
        >
          <X className="size-3.5" aria-hidden="true" />
          {t('projects.filters.clear', 'Clear filters')} ({activeCount})
        </Button>
      ) : null}
    </div>
  )
}
