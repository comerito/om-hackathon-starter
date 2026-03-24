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

export default function CreateAnnouncementPage() {
  const t = useT()

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'competition_id', label: t('competitions.announcements.competition', 'Competition'), type: 'combobox', required: true, loadOptions: loadCompetitions },
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
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'content', title: t('competitions.announcements.groups.content', 'Content'), column: 1, fields: ['competition_id', 'title', 'content'] },
    { id: 'settings', title: t('competitions.announcements.groups.settings', 'Settings'), column: 2, fields: ['category', 'priority', 'pinned'] },
    { id: 'action', title: 'Action Link', column: 2, fields: ['action_url', 'action_label'] },
  ], [t])

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('competitions.announcements.createTitle', 'New Announcement')}
          backHref="/backend/competitions/announcements"
          entityId="competitions:announcement"
          fields={fields}
          groups={groups}
          submitLabel={t('competitions.announcements.createSubmit', 'Publish')}
          cancelHref="/backend/competitions/announcements"
          successRedirect={`/backend/competitions/announcements?flash=${encodeURIComponent(t('competitions.announcements.flash.published', 'Announcement published'))}&type=success`}
          onSubmit={async (vals) => { await createCrud('competitions/announcements', vals) }}
        />
      </PageBody>
    </Page>
  )
}
