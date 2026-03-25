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

async function loadTracks(query?: string) {
  const params: Record<string, string> = { pageSize: '50' }
  if (query) params.name = query
  const res = await fetchCrudList<{ id: string; name: string }>('tracks/tracks', params)
  return [{ value: '', label: 'All tracks (global)' }, ...(res?.items ?? []).map((t) => ({ value: t.id, label: t.name }))]
}

export default function CreateCriterionPage() {
  const t = useT()
  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'competition_id', label: t('judging.fields.competition', 'Competition'), type: 'combobox', required: true, loadOptions: loadCompetitions },
    { id: 'track_id', label: t('judging.fields.track', 'Track (optional)'), type: 'combobox', loadOptions: loadTracks },
    { id: 'name', label: t('judging.fields.name', 'Criterion Name'), type: 'text', required: true },
    { id: 'description', label: t('judging.fields.description', 'Description'), type: 'textarea' },
    { id: 'max_score', label: t('judging.fields.maxScore', 'Max Score'), type: 'number', defaultValue: 10 },
    { id: 'weight', label: t('judging.fields.weight', 'Weight (0-1)'), type: 'number', defaultValue: 0.25, placeholder: '0.25 = 25%' },
    { id: 'round', label: t('judging.fields.round', 'Applicable Round'), type: 'select', defaultValue: 'both',
      options: [{ value: 'both', label: 'Both rounds' }, { value: 'preliminary', label: 'Preliminary only' }, { value: 'final', label: 'Final only' }] },
    { id: 'order', label: t('judging.fields.order', 'Display Order'), type: 'number', defaultValue: 0 },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('judging.groups.criterion', 'Criterion Details'), column: 1, fields: ['competition_id', 'track_id', 'name', 'description'] },
    { id: 'scoring', title: t('judging.groups.scoring', 'Scoring'), column: 2, fields: ['max_score', 'weight', 'round', 'order'] },
  ], [t])

  return (
    <Page><PageBody>
      <CrudForm
        title={t('judging.criteria.create.title', 'Create Judging Criterion')}
        backHref="/backend/judging" entityId="judging:criterion"
        fields={fields} groups={groups}
        submitLabel={t('judging.criteria.create.submit', 'Create')}
        cancelHref="/backend/judging"
        successRedirect={`/backend/judging?flash=${encodeURIComponent(t('judging.flash.criterionCreated', 'Criterion created'))}&type=success`}
        onSubmit={async (vals) => { await createCrud('judging/criteria', vals) }}
      />
    </PageBody></Page>
  )
}
