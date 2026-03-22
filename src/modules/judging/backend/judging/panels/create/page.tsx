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

export default function CreatePanelPage() {
  const t = useT()
  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'competition_id', label: t('judging.fields.competition', 'Competition'), type: 'combobox', required: true, loadOptions: loadCompetitions },
    { id: 'name', label: t('judging.fields.name', 'Panel Name'), type: 'text', required: true },
    { id: 'round', label: t('judging.fields.round', 'Round'), type: 'select', defaultValue: 'preliminary',
      options: [{ value: 'preliminary', label: 'Preliminary' }, { value: 'final', label: 'Final' }] },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('judging.groups.details', 'Panel Details'), column: 1, fields: ['competition_id', 'name', 'round'] },
  ], [t])

  return (
    <Page><PageBody>
      <CrudForm
        title={t('judging.panels.create.title', 'Create Judge Panel')}
        backHref="/backend/judging" entityId="judging:panel"
        fields={fields} groups={groups}
        submitLabel={t('judging.panels.create.submit', 'Create')}
        cancelHref="/backend/judging"
        successRedirect={`/backend/judging?flash=${encodeURIComponent(t('judging.flash.panelCreated', 'Panel created'))}&type=success`}
        onSubmit={async (vals) => { await createCrud('judging/panels', vals) }}
      />
    </PageBody></Page>
  )
}
