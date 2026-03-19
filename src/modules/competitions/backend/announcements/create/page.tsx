"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function CreateAnnouncementPage() {
  const t = useT()

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'competition_id', label: 'Competition ID', type: 'text', required: true },
    { id: 'title', label: 'Title', type: 'text', required: true },
    { id: 'content', label: 'Content', type: 'textarea', required: true },
    { id: 'priority', label: 'Priority', type: 'select', options: [
      { value: 'info', label: 'Info' }, { value: 'warning', label: 'Warning' }, { value: 'urgent', label: 'Urgent' },
    ], defaultValue: 'info' },
    { id: 'pinned', label: 'Pinned', type: 'checkbox' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'content', title: 'Content', column: 1, fields: ['competition_id', 'title', 'content'] },
    { id: 'settings', title: 'Settings', column: 2, fields: ['priority', 'pinned'] },
  ], [])

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('competitions.announcements.createTitle', 'New Announcement')}
          backHref="/backend/competitions/announcements"
          entityId="competitions:announcement"
          fields={fields}
          groups={groups}
          submitLabel="Publish"
          cancelHref="/backend/competitions/announcements"
          successRedirect={`/backend/competitions/announcements?flash=${encodeURIComponent('Announcement published')}&type=success`}
          onSubmit={async (vals) => { await createCrud('competitions/announcements', vals) }}
        />
      </PageBody>
    </Page>
  )
}
