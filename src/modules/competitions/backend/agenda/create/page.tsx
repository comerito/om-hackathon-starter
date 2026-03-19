"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function CreateAgendaItemPage() {
  const t = useT()

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'competition_id', label: t('competitions.agenda.competitionId', 'Competition ID'), type: 'text', required: true },
    { id: 'title', label: t('competitions.agenda.title', 'Title'), type: 'text', required: true },
    { id: 'description', label: t('competitions.agenda.description', 'Description'), type: 'textarea' },
    { id: 'type', label: t('competitions.agenda.type', 'Type'), type: 'select', options: [
      { value: 'ceremony', label: 'Ceremony' }, { value: 'talk', label: 'Talk' },
      { value: 'workshop', label: 'Workshop' }, { value: 'break', label: 'Break' },
      { value: 'meal', label: 'Meal' }, { value: 'deadline', label: 'Deadline' },
      { value: 'demo_session', label: 'Demo Session' }, { value: 'custom', label: 'Custom' },
    ], defaultValue: 'custom' },
    { id: 'starts_at', label: t('competitions.agenda.startsAt', 'Start Time'), type: 'datetime', required: true },
    { id: 'ends_at', label: t('competitions.agenda.endsAt', 'End Time'), type: 'datetime', required: true },
    { id: 'location', label: t('competitions.agenda.location', 'Location'), type: 'text' },
    { id: 'speaker_name', label: t('competitions.agenda.speakerName', 'Speaker Name'), type: 'text' },
    { id: 'is_mandatory', label: t('competitions.agenda.isMandatory', 'Mandatory'), type: 'checkbox' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: 'Details', column: 1, fields: ['competition_id', 'title', 'description', 'type'] },
    { id: 'schedule', title: 'Schedule', column: 2, fields: ['starts_at', 'ends_at', 'location', 'speaker_name', 'is_mandatory'] },
  ], [])

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('competitions.agenda.createTitle', 'Add Agenda Item')}
          backHref="/backend/competitions/agenda"
          entityId="competitions:agenda_item"
          fields={fields}
          groups={groups}
          submitLabel={t('competitions.agenda.createSubmit', 'Create')}
          cancelHref="/backend/competitions/agenda"
          successRedirect={`/backend/competitions/agenda?flash=${encodeURIComponent('Agenda item created')}&type=success`}
          onSubmit={async (vals) => { await createCrud('competitions/agenda', vals) }}
        />
      </PageBody>
    </Page>
  )
}
