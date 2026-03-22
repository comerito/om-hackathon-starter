"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud, fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

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

export default function CreatePrizePage() {
  const t = useT()
  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'competition_id', label: t('sponsors.fields.competition', 'Competition'), type: 'combobox', required: true, loadOptions: loadCompetitions },
    { id: 'name', label: t('sponsors.fields.name', 'Prize Name'), type: 'text', required: true },
    { id: 'description', label: t('sponsors.fields.description', 'Description'), type: 'textarea' },
    { id: 'category', label: t('sponsors.fields.category', 'Category'), type: 'select', defaultValue: 'special_award',
      options: [{ value: 'track_placement', label: 'Track Placement' }, { value: 'special_award', label: 'Special Award' },
        { value: 'sponsor_prize', label: 'Sponsor Prize' }, { value: 'peoples_choice', label: "People's Choice" }] },
    { id: 'sponsor_id', label: t('sponsors.fields.sponsor', 'Sponsor'), type: 'combobox', loadOptions: loadSponsors },
    { id: 'value', label: t('sponsors.fields.value', 'Value'), type: 'text', placeholder: 'e.g., 5000 PLN, API Credits' },
    { id: 'rank', label: t('sponsors.fields.rank', 'Rank'), type: 'number', placeholder: '1st, 2nd, 3rd' },
    { id: 'order', label: t('sponsors.fields.order', 'Display Order'), type: 'number', defaultValue: 0 },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('sponsors.groups.prize', 'Prize Details'), column: 1, fields: ['competition_id', 'name', 'description', 'category'] },
    { id: 'award', title: t('sponsors.groups.award', 'Award Info'), column: 2, fields: ['sponsor_id', 'value', 'rank', 'order'] },
  ], [t])

  return (
    <Page><PageBody>
      <CrudForm
        title={t('sponsors.prizes.create.title', 'Add Prize')}
        backHref="/backend/sponsors" entityId="sponsors:prize"
        fields={fields} groups={groups}
        submitLabel={t('sponsors.prizes.create.submit', 'Create')}
        cancelHref="/backend/sponsors"
        successRedirect={`/backend/sponsors?flash=${encodeURIComponent(t('sponsors.flash.prizeCreated', 'Prize created'))}&type=success`}
        onSubmit={async (vals) => { await createCrud('sponsors/prizes', vals) }}
      />
    </PageBody></Page>
  )
}
