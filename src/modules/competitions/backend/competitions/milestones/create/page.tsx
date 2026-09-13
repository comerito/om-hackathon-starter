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

export default function CreateMilestonePage() {
  const t = useT()
  const { competitionId: scopedCompetitionId, ready: scopeReady } = useCompetitionScope()
  const competitionSeedOptions = useScopedCompetitionSeedOptions()
  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'competition_id', label: t('competitions.milestones.competition', 'Competition'), type: 'combobox', required: true, loadOptions: loadCompetitions, seedOptions: competitionSeedOptions },
    { id: 'name', label: t('competitions.milestones.name', 'Name'), type: 'text', required: true },
    { id: 'description', label: t('competitions.milestones.description', 'Description'), type: 'textarea' },
    { id: 'due_date', label: t('competitions.milestones.dueDate', 'Due Date'), type: 'datetime', required: true },
    { id: 'status', label: t('competitions.milestones.status', 'Status'), type: 'select', defaultValue: 'upcoming', options: [
      { value: 'upcoming', label: 'Upcoming' },
      { value: 'active', label: 'Active' },
      { value: 'completed', label: 'Completed' },
    ]},
    { id: 'sort_order', label: t('competitions.milestones.sortOrder', 'Sort Order'), type: 'number', defaultValue: 0 },
  ], [t, competitionSeedOptions])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('competitions.milestones.groups.details', 'Milestone Details'), column: 1, fields: ['competition_id', 'name', 'description', 'due_date'] },
    { id: 'settings', title: t('competitions.milestones.groups.settings', 'Settings'), column: 2, fields: ['status', 'sort_order'] },
  ], [t])

  return (
    <Page><PageBody>
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
        title={t('competitions.milestones.createTitle', 'New Milestone')}
        backHref="/backend/competitions/milestones"
        entityId="competitions:milestone"
        fields={fields}
        groups={groups}
        submitLabel={t('competitions.milestones.createSubmit', 'Create')}
        cancelHref="/backend/competitions/milestones"
        successRedirect={`/backend/competitions/milestones?flash=${encodeURIComponent(t('competitions.milestones.flash.created', 'Milestone created'))}&type=success`}
        onSubmit={async (vals) => { await createCrud('competitions/milestones', vals) }}
      />
    </PageBody></Page>
  )
}
