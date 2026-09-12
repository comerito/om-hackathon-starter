"use client"
import * as React from 'react'

import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFieldOption, type CrudFormGroup, type CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { updateCrud, fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { ComboboxInput } from '@open-mercato/ui/backend/inputs/ComboboxInput'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useQuery } from '@tanstack/react-query'

async function loadCompetitions(query?: string) {
  const params: Record<string, string> = { pageSize: '20' }
  if (query) params.name = query
  const res = await fetchCrudList<{ id: string; name: string }>('competitions/competitions', params)
  return (res?.items ?? []).map((c) => ({ value: c.id, label: c.name }))
}

// The prize API returns only `competition_id` and `loadCompetitions` is paginated, so the picker
// cannot resolve the label of a pre-selected id on its own. Best-effort: a missing label only
// degrades the picker to the raw id, it must never keep the form from loading.
async function loadCompetitionSeedOptions(competitionId: unknown): Promise<CrudFieldOption[]> {
  const id = typeof competitionId === 'string' ? competitionId : ''
  if (!id) return []
  try {
    const res = await fetchCrudList<{ id: string; name: string }>('competitions/competitions', { id, pageSize: '1' })
    const competition = res?.items?.[0]
    if (!competition?.id || !competition?.name) return []
    return [{ value: String(competition.id), label: String(competition.name) }]
  } catch {
    return []
  }
}

async function loadSponsors(query?: string) {
  const params: Record<string, string> = { pageSize: '20' }
  if (query) params.name = query
  const res = await fetchCrudList<{ id: string; name: string }>('sponsors/sponsors', params)
  return (res?.items ?? []).map((s) => ({ value: s.id, label: s.name }))
}

async function loadTracks(competitionId: string, query?: string) {
  const params: Record<string, string> = { pageSize: '100', competition_id: competitionId }
  if (query) params.name = query
  const res = await fetchCrudList<{ id: string; name: string }>('tracks/tracks', params)
  return (res?.items ?? []).map((tr) => ({ value: tr.id, label: tr.name }))
}

function TrackField(props: CrudCustomFieldRenderProps) {
  const competitionId = props.values?.competition_id as string | undefined
  return (
    <ComboboxInput
      value={(props.value as string) ?? ''}
      onChange={(v) => props.setValue(v)}
      placeholder="Type to search..."
      disabled={props.disabled || !competitionId}
      autoFocus={props.autoFocus}
      loadSuggestions={competitionId ? (q) => loadTracks(competitionId, q) : undefined}
    />
  )
}

export default function EditPrizePage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const id = params?.id

  const { data, isLoading, error } = useQuery({
    queryKey: ['prize-edit', id],
    queryFn: async () => {
      const res = await fetchCrudList<Record<string, unknown>>('sponsors/prizes', { id: id!, pageSize: '1' })
      const item = res?.items?.[0]
      if (!item) throw new Error('Failed to load prize')
      // Resolved here rather than in a follow-up query so the form mounts with the picker's
      // label already known, instead of flashing an empty control first.
      const competitionOptions = await loadCompetitionSeedOptions(item.competition_id)
      return { item, competitionOptions }
    },
    enabled: !!id,
  })

  const competitionSeedOptions = data?.competitionOptions

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'competition_id',
      label: t('sponsors.fields.competition', 'Competition'),
      type: 'combobox',
      required: true,
      loadOptions: loadCompetitions,
      // Hydrate the option map with the linked competition so the picker renders its name
      // instead of the raw uuid (or nothing) before the user interacts with it.
      seedOptions: competitionSeedOptions,
    },
    { id: 'name', label: t('sponsors.fields.name', 'Prize Name'), type: 'text', required: true },
    { id: 'description', label: t('sponsors.fields.description', 'Description'), type: 'textarea' },
    { id: 'category', label: t('sponsors.fields.category', 'Category'), type: 'select', defaultValue: 'special_award',
      options: [{ value: 'track_placement', label: 'Track Placement' }, { value: 'special_award', label: 'Special Award' },
        { value: 'sponsor_prize', label: 'Sponsor Prize' }, { value: 'peoples_choice', label: "People's Choice" }] },
    { id: 'track_id', label: t('sponsors.fields.track', 'Track'), type: 'custom', component: TrackField },
    { id: 'sponsor_id', label: t('sponsors.fields.sponsor', 'Sponsor'), type: 'combobox', loadOptions: loadSponsors },
    { id: 'value', label: t('sponsors.fields.value', 'Value'), type: 'text', placeholder: 'e.g., 5000 PLN, API Credits' },
    { id: 'rank', label: t('sponsors.fields.rank', 'Rank'), type: 'number', placeholder: '1st, 2nd, 3rd' },
    { id: 'order', label: t('sponsors.fields.order', 'Display Order'), type: 'number', defaultValue: 0 },
  ], [t, competitionSeedOptions])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('sponsors.groups.prize', 'Prize Details'), column: 1, fields: ['competition_id', 'name', 'description', 'category', 'track_id'] },
    { id: 'award', title: t('sponsors.groups.award', 'Award Info'), column: 2, fields: ['sponsor_id', 'value', 'rank', 'order'] },
  ], [t])

  if (isLoading) return <Page><PageBody><LoadingMessage label="Loading prize..." /></PageBody></Page>
  if (error || !data) return <Page><PageBody><ErrorMessage label="Failed to load prize" /></PageBody></Page>

  return (
    <Page><PageBody>
      <CrudForm
        title={t('sponsors.prizes.edit.title', 'Edit Prize')}
        backHref="/backend/sponsors"
        entityId="sponsors:prize"
        fields={fields}
        groups={groups}
        initialValues={data.item}
        // "Competition" is the first field, so CrudForm would autofocus it on mount.
        // ComboboxInput only mirrors its `value` into the visible text while the input is NOT
        // focused, so focusing it on its very first render leaves the control showing the empty
        // "Type to search..." placeholder forever, even though competition_id is set (#134, same
        // as #90). Suppressing the mount-time autofocus lets the control render its selection.
        disableInitialFocus
        submitLabel={t('sponsors.prizes.edit.submit', 'Save Changes')}
        cancelHref="/backend/sponsors"
        successRedirect={`/backend/sponsors?flash=${encodeURIComponent(t('sponsors.flash.prizeUpdated', 'Prize updated'))}&type=success`}
        onSubmit={async (vals) => { await updateCrud('sponsors/prizes', { ...vals, id }) }}
      />
    </PageBody></Page>
  )
}
