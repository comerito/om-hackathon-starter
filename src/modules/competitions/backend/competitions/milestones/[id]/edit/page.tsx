"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { updateCrud, fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useQuery } from '@tanstack/react-query'
import { toFormInstant } from '@/modules/competitions/lib/formInstant'

async function loadCompetitions(query?: string) {
  const params: Record<string, string> = { pageSize: '20' }
  if (query) params.name = query
  const res = await fetchCrudList<{ id: string; name: string }>('competitions/competitions', params)
  return (res?.items ?? []).map((c) => ({ value: c.id, label: c.name }))
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
      // Keep the stored instant intact for the `datetime` picker, which renders it in the
      // browser's local timezone. Narrowing it to a zone-less `YYYY-MM-DDTHH:mm` string (as
      // this loader used to) made the picker re-read a UTC instant as local wall-clock time,
      // so every save shifted the due date by the UTC offset — issue #122, same defect as #81.
      if (item.due_date) item.due_date = toFormInstant(item.due_date)
      return item
    },
    enabled: !!milestoneId,
  })

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'competition_id', label: t('competitions.milestones.competition', 'Competition'), type: 'combobox', required: true, loadOptions: loadCompetitions },
    { id: 'name', label: t('competitions.milestones.name', 'Name'), type: 'text', required: true },
    { id: 'description', label: t('competitions.milestones.description', 'Description'), type: 'textarea' },
    { id: 'due_date', label: t('competitions.milestones.dueDate', 'Due Date'), type: 'datetime', required: true },
    { id: 'status', label: t('competitions.milestones.status', 'Status'), type: 'select', defaultValue: 'upcoming', options: [
      { value: 'upcoming', label: 'Upcoming' },
      { value: 'active', label: 'Active' },
      { value: 'completed', label: 'Completed' },
    ]},
    { id: 'sort_order', label: t('competitions.milestones.sortOrder', 'Sort Order'), type: 'number', defaultValue: 0 },
  ], [t])

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
        initialValues={data}
        submitLabel={t('competitions.milestones.edit.submit', 'Save Changes')}
        cancelHref="/backend/competitions/milestones"
        successRedirect={`/backend/competitions/milestones?flash=${encodeURIComponent(t('competitions.milestones.flash.updated', 'Milestone updated'))}&type=success`}
        onSubmit={async (vals) => {
          // `due_date` already holds an ISO-8601 UTC instant — either the value loaded from the
          // API or the picker's own `date.toISOString()` output — so it is forwarded untouched.
          // Re-parsing it here was the second half of issue #122.
          const cleaned = { ...vals, id: milestoneId } as Record<string, unknown>
          await updateCrud('competitions/milestones', cleaned)
        }}
      />
    </PageBody></Page>
  )
}
