"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud, fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useCompetitionScope } from '@/lib/competition-scope'
import { useScopedCompetitionSeedOptions } from '@/lib/competition-label'

async function loadCompetitions(query?: string) {
  const params: Record<string, string> = { pageSize: '20' }
  if (query) params.name = query
  const res = await fetchCrudList<{ id: string; name: string }>('competitions/competitions', params)
  return (res?.items ?? []).map((c) => ({ value: c.id, label: c.name }))
}

export default function CreateTeamPage() {
  const t = useT()
  const { competitionId: scopedCompetitionId, ready: scopeReady } = useCompetitionScope()
  const competitionSeedOptions = useScopedCompetitionSeedOptions()

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'competition_id', label: t('teams.fields.competition', 'Competition'), type: 'combobox', required: true, loadOptions: loadCompetitions, seedOptions: competitionSeedOptions },
    { id: 'name', label: t('teams.fields.name', 'Name'), type: 'text', required: true },
    { id: 'description', label: t('teams.fields.description', 'Description'), type: 'textarea' },
  ], [t, competitionSeedOptions])

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
          // The scope only resolves after hydration, and CrudForm will not push a
          // late `initialValues` into a combobox it considers user-touched — so remount
          // the form once the scope is known (and again if it changes).
          key={scopeReady ? scopedCompetitionId ?? 'home' : 'pending'}
          initialValues={scopedCompetitionId ? { competition_id: scopedCompetitionId } : undefined}
          // The competition combobox is the first field, so it would auto-focus — and a
          // focused combobox never renders the label for a value it did not receive from
          // the user, then clears that value on blur. Skip initial focus when prefilled.
          disableInitialFocus={Boolean(scopedCompetitionId)}
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
