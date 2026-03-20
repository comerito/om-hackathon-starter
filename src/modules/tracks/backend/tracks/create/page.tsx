"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud, fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type CompetitionOption = { id: string; name: string }

export default function CreateTrackPage() {
  const t = useT()

  const loadCompetitions = React.useCallback(async (query?: string) => {
    const params: Record<string, string> = { pageSize: '50' }
    if (query) params.name = query
    const data = await fetchCrudList<CompetitionOption>('competitions/competitions', params)
    return (data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))
  }, [])

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'competition_id', label: t('tracks.fields.competition', 'Competition'), type: 'combobox', required: true, loadOptions: loadCompetitions },
    { id: 'name', label: t('tracks.fields.name', 'Name'), type: 'text', required: true },
    { id: 'description', label: t('tracks.fields.description', 'Description'), type: 'textarea' },
    { id: 'color', label: t('tracks.fields.color', 'Color'), type: 'text', placeholder: '#6366f1' },
    { id: 'icon_url', label: t('tracks.fields.iconUrl', 'Icon URL'), type: 'text' },
    { id: 'max_teams', label: t('tracks.fields.maxTeams', 'Max Teams'), type: 'number' },
    { id: 'order', label: t('tracks.fields.order', 'Order'), type: 'number' },
  ], [t, loadCompetitions])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'general', title: t('tracks.groups.general', 'General'), column: 1, fields: ['competition_id', 'name', 'description'] },
    { id: 'appearance', title: t('tracks.groups.appearance', 'Appearance'), column: 2, fields: ['color', 'icon_url'] },
    { id: 'settings', title: t('tracks.groups.settings', 'Settings'), column: 1, fields: ['max_teams', 'order'] },
  ], [t])

  const successRedirect = React.useMemo(
    () => `/backend/tracks?flash=${encodeURIComponent(t('tracks.flash.created', 'Track created'))}&type=success`,
    [t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('tracks.create.title', 'Create Track')}
          backHref="/backend/tracks"
          entityId="tracks:track"
          fields={fields}
          groups={groups}
          submitLabel={t('tracks.create.submit', 'Create')}
          cancelHref="/backend/tracks"
          successRedirect={successRedirect}
          onSubmit={async (vals) => { await createCrud('tracks/tracks', vals) }}
        />
      </PageBody>
    </Page>
  )
}
