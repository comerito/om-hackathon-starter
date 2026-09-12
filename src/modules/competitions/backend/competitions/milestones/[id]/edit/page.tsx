"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFieldOption, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { updateCrud, fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useQuery } from '@tanstack/react-query'

async function loadCompetitions(query?: string) {
  const params: Record<string, string> = { pageSize: '20' }
  if (query) params.name = query
  const res = await fetchCrudList<{ id: string; name: string }>('competitions/competitions', params)
  return (res?.items ?? []).map((c) => ({ value: c.id, label: c.name }))
}

// The milestone API returns only `competition_id` and `loadCompetitions` is paginated, so the
// picker cannot resolve the label of a pre-selected id on its own. Best-effort: a missing label
// only degrades the picker to the raw id, it must never keep the form from loading.
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

export default function EditMilestonePage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const milestoneId = params?.id

  const { data, isLoading, error } = useQuery({
    queryKey: ['milestone-edit', milestoneId],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ items: Record<string, unknown>[] }>(
        `/api/competitions/milestones?id=${milestoneId}&pageSize=1`,
      )
      if (!ok || !result?.items?.[0]) throw new Error('Failed to load milestone')
      const item = result.items[0]
      // Convert datetime to local format for the datetime input
      if (item.due_date) {
        try { item.due_date = new Date(String(item.due_date)).toISOString().slice(0, 16) } catch { /* keep as-is */ }
      }
      // Resolved here rather than in a follow-up query so the form mounts with the picker's
      // label already known, instead of flashing an empty control first.
      const competitionOptions = await loadCompetitionSeedOptions(item.competition_id)
      return { item, competitionOptions }
    },
    enabled: !!milestoneId,
  })

  const competitionSeedOptions = data?.competitionOptions

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'competition_id',
      label: t('competitions.milestones.competition', 'Competition'),
      type: 'combobox',
      required: true,
      loadOptions: loadCompetitions,
      // Hydrate the option map with the linked competition so the picker renders its name
      // instead of the raw uuid (or nothing) before the user interacts with it.
      seedOptions: competitionSeedOptions,
    },
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

  if (isLoading) return <Page><PageBody><LoadingMessage label={t('competitions.milestones.edit.loading', 'Loading milestone...')} /></PageBody></Page>
  if (error || !data) return <Page><PageBody><ErrorMessage label={t('competitions.milestones.edit.error', 'Failed to load milestone')} /></PageBody></Page>

  return (
    <Page><PageBody>
      <CrudForm
        title={t('competitions.milestones.edit.title', 'Edit Milestone')}
        backHref="/backend/competitions/milestones"
        entityId="competitions:milestone"
        fields={fields}
        groups={groups}
        initialValues={data.item}
        // "Competition" is the first field, so CrudForm would autofocus it on mount, and
        // ComboboxInput only mirrors its `value` into the visible text while NOT focused — see
        // the prize/criteria forms and #90. Suppressing the autofocus lets it show its selection.
        disableInitialFocus
        submitLabel={t('competitions.milestones.edit.submit', 'Save Changes')}
        cancelHref="/backend/competitions/milestones"
        successRedirect={`/backend/competitions/milestones?flash=${encodeURIComponent(t('competitions.milestones.flash.updated', 'Milestone updated'))}&type=success`}
        onSubmit={async (vals) => {
          const cleaned = { ...vals, id: milestoneId } as Record<string, unknown>
          if (cleaned.due_date) cleaned.due_date = new Date(String(cleaned.due_date)).toISOString()
          await updateCrud('competitions/milestones', cleaned)
        }}
      />
    </PageBody></Page>
  )
}
