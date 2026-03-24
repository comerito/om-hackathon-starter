"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud, fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

async function loadTeams(query?: string) {
  const params: Record<string, string> = { pageSize: '20' }
  if (query) params.name = query
  const res = await fetchCrudList<{ id: string; name: string }>('teams/teams', params)
  return (res?.items ?? []).map((t) => ({ value: t.id, label: t.name }))
}

export default function CreateResourcePage() {
  const t = useT()

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'team_id', label: t('teams.resources.fields.team', 'Team'), type: 'combobox', required: true, loadOptions: loadTeams },
    { id: 'name', label: t('teams.resources.fields.name', 'Name'), type: 'text', required: true },
    {
      id: 'type',
      label: t('teams.resources.fields.type', 'Type'),
      type: 'select',
      options: [
        { value: 'file', label: t('teams.resources.types.file', 'File') },
        { value: 'link', label: t('teams.resources.types.link', 'Link') },
        { value: 'repository', label: t('teams.resources.types.repository', 'Repository') },
      ],
      defaultValue: 'link',
    },
    { id: 'url', label: t('teams.resources.fields.url', 'URL'), type: 'text' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('teams.resources.groups.details', 'Details'), column: 1, fields: ['team_id', 'name', 'type', 'url'] },
  ], [t])

  const successRedirect = React.useMemo(
    () => `/backend/teams/resources?flash=${encodeURIComponent(t('teams.resources.flash.created', 'Resource created'))}&type=success`,
    [t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('teams.resources.create.title', 'Create Resource')}
          backHref="/backend/teams/resources"
          entityId="teams:resource"
          fields={fields}
          groups={groups}
          submitLabel={t('teams.resources.create.submit', 'Create')}
          cancelHref="/backend/teams/resources"
          successRedirect={successRedirect}
          onSubmit={async (vals) => { await createCrud('teams/resources', vals) }}
        />
      </PageBody>
    </Page>
  )
}
