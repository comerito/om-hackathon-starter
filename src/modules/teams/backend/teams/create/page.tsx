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

export default function CreateTeamPage() {
  const t = useT()

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'competition_id', label: t('teams.fields.competition', 'Competition'), type: 'combobox', required: true, loadOptions: loadCompetitions },
    { id: 'name', label: t('teams.fields.name', 'Name'), type: 'text', required: true },
    { id: 'description', label: t('teams.fields.description', 'Description'), type: 'textarea' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('teams.groups.details', 'Details'), column: 1, fields: ['competition_id', 'name', 'description'] },
  ], [t])

  const successRedirect = React.useMemo(
    () => `/backend/teams?flash=${encodeURIComponent(t('teams.flash.created', 'Team created'))}&type=success`,
    [t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('teams.create.title', 'Create Team')}
          backHref="/backend/teams"
          entityId="teams:team"
          fields={fields}
          groups={groups}
          submitLabel={t('teams.create.submit', 'Create')}
          cancelHref="/backend/teams"
          successRedirect={successRedirect}
          onSubmit={async (vals) => { await createCrud('teams/teams', vals) }}
        />
      </PageBody>
    </Page>
  )
}
