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

// The announcement API returns only `competition_id` and `loadCompetitions` is paginated, so the
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

export default function EditAnnouncementPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const id = params?.id

  const { data, isLoading, error } = useQuery({
    queryKey: ['announcement-edit', id],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ item: Record<string, unknown> }>(
        `/api/competitions/announcements/${id}`,
      )
      if (!ok || !result?.item) throw new Error('Failed to load announcement')
      const item = result.item
      // Resolved here rather than in a follow-up query so the form mounts with the picker's
      // label already known, instead of flashing an empty control first.
      const competitionOptions = await loadCompetitionSeedOptions(item.competition_id)
      return { item, competitionOptions }
    },
    enabled: !!id,
  })

  const competitionSeedOptions = data?.competitionOptions

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'competition_id',
      label: t('competitions.announcements.competition', 'Competition'),
      type: 'combobox',
      required: true,
      loadOptions: loadCompetitions,
      // Hydrate the option map with the linked competition so the picker renders its name
      // instead of the raw uuid (or nothing) before the user interacts with it.
      seedOptions: competitionSeedOptions,
    },
    { id: 'title', label: 'Title', type: 'text', required: true },
    { id: 'content', label: 'Content', type: 'textarea', required: true },
    { id: 'category', label: 'Category', type: 'select', defaultValue: 'general', options: [
      { value: 'general', label: 'General' },
      { value: 'logistics', label: 'Logistics' },
      { value: 'technical', label: 'Technical' },
      { value: 'schedule', label: 'Schedule' },
      { value: 'judging', label: 'Judging' },
    ]},
    { id: 'priority', label: 'Priority', type: 'select', options: [
      { value: 'info', label: 'Info' }, { value: 'warning', label: 'Warning' }, { value: 'urgent', label: 'Urgent' },
    ], defaultValue: 'info' },
    { id: 'pinned', label: 'Pinned', type: 'checkbox' },
    { id: 'action_url', label: 'Action URL', type: 'text' },
    { id: 'action_label', label: 'Action Label', type: 'text' },
  ], [t, competitionSeedOptions])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'content', title: t('competitions.announcements.groups.content', 'Content'), column: 1, fields: ['competition_id', 'title', 'content'] },
    { id: 'settings', title: t('competitions.announcements.groups.settings', 'Settings'), column: 2, fields: ['category', 'priority', 'pinned'] },
    { id: 'action', title: 'Action Link', column: 2, fields: ['action_url', 'action_label'] },
  ], [t])

  if (isLoading) return <Page><PageBody><LoadingMessage label="Loading announcement..." /></PageBody></Page>
  if (error || !data) return <Page><PageBody><ErrorMessage label="Failed to load announcement" /></PageBody></Page>

  return (
    <Page><PageBody>
      <CrudForm
        title={t('competitions.announcements.editTitle', 'Edit Announcement')}
        backHref="/backend/competitions/announcements"
        entityId="competitions:announcement"
        fields={fields}
        groups={groups}
        initialValues={data.item}
        // "Competition" is the first field, so CrudForm would autofocus it on mount, and
        // ComboboxInput only mirrors its `value` into the visible text while NOT focused — see
        // the prize/criteria forms and #90. Suppressing the autofocus lets it show its selection.
        disableInitialFocus
        submitLabel={t('competitions.announcements.editSubmit', 'Save Changes')}
        cancelHref="/backend/competitions/announcements"
        successRedirect={`/backend/competitions/announcements?flash=${encodeURIComponent(t('competitions.announcements.flash.updated', 'Announcement updated'))}&type=success`}
        onSubmit={async (vals) => { await updateCrud('competitions/announcements', { ...vals, id }) }}
      />
    </PageBody></Page>
  )
}
