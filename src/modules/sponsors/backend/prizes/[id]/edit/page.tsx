"use client"
import * as React from 'react'

import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { updateCrud, fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useQuery } from '@tanstack/react-query'

async function loadCompetitions(query?: string) {
  const params: Record<string, string> = { pageSize: '20' }
  if (query) params.name = query
  const res = await fetchCrudList<{ id: string; name: string }>('competitions/competitions', params)
  return (res?.items ?? []).map((c) => ({ value: c.id, label: c.name }))
}

async function loadSponsors(query?: string) {
  const params: Record<string, string> = { pageSize: '20' }
  if (query) params.name = query
  const res = await fetchCrudList<{ id: string; name: string }>('sponsors/sponsors', params)
  return (res?.items ?? []).map((s) => ({ value: s.id, label: s.name }))
}

async function loadTracks(query?: string) {
  const params: Record<string, string> = { pageSize: '50' }
  if (query) params.name = query
  const res = await fetchCrudList<{ id: string; name: string }>('tracks/tracks', params)
  return (res?.items ?? []).map((tr) => ({ value: tr.id, label: tr.name }))
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
      return item
    },
    enabled: !!id,
  })

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'competition_id', label: t('sponsors.fields.competition', 'Competition'), type: 'combobox', required: true, loadOptions: loadCompetitions },
    { id: 'name', label: t('sponsors.fields.name', 'Prize Name'), type: 'text', required: true },
    { id: 'description', label: t('sponsors.fields.description', 'Description'), type: 'textarea' },
    { id: 'category', label: t('sponsors.fields.category', 'Category'), type: 'select', defaultValue: 'special_award',
      options: [{ value: 'track_placement', label: 'Track Placement' }, { value: 'special_award', label: 'Special Award' },
        { value: 'sponsor_prize', label: 'Sponsor Prize' }, { value: 'peoples_choice', label: "People's Choice" }] },
    { id: 'track_id', label: t('sponsors.fields.track', 'Track'), type: 'combobox', loadOptions: loadTracks },
    { id: 'sponsor_id', label: t('sponsors.fields.sponsor', 'Sponsor'), type: 'combobox', loadOptions: loadSponsors },
    { id: 'value', label: t('sponsors.fields.value', 'Value'), type: 'text', placeholder: 'e.g., 5000 PLN, API Credits' },
    { id: 'rank', label: t('sponsors.fields.rank', 'Rank'), type: 'number', placeholder: '1st, 2nd, 3rd' },
    { id: 'order', label: t('sponsors.fields.order', 'Display Order'), type: 'number', defaultValue: 0 },
  ], [t])

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
        initialValues={data}
        submitLabel={t('sponsors.prizes.edit.submit', 'Save Changes')}
        cancelHref="/backend/sponsors"
        successRedirect={`/backend/sponsors?flash=${encodeURIComponent(t('sponsors.flash.prizeUpdated', 'Prize updated'))}&type=success`}
        onSubmit={async (vals) => { await updateCrud('sponsors/prizes', { ...vals, id }) }}
      />
    </PageBody></Page>
  )
}
