"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useSearchParams } from 'next/navigation'

export default function CreateParticipationPage() {
  const t = useT()
  const searchParams = useSearchParams()
  const competitionId = searchParams.get('competitionId') ?? ''

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'competitionId',
      label: t('competitions.participants.form.fields.competitionId.label', 'Competition ID'),
      type: 'text',
      required: true,
      placeholder: t('competitions.participants.form.fields.competitionId.placeholder', 'Competition UUID'),
      ...(competitionId ? { defaultValue: competitionId, hidden: true } : {}),
    },
    {
      id: 'email',
      label: t('competitions.participants.form.fields.email.label', 'Email'),
      type: 'text',
      required: true,
      placeholder: t('competitions.participants.form.fields.email.placeholder', 'participant@example.com'),
    },
    {
      id: 'role',
      label: t('competitions.participants.form.fields.role.label', 'Role'),
      type: 'select',
      required: true,
      options: [
        { label: t('competitions.participants.form.fields.role.participant', 'Participant'), value: 'participant' },
        { label: t('competitions.participants.form.fields.role.mentor', 'Mentor'), value: 'mentor' },
        { label: t('competitions.participants.form.fields.role.judge', 'Judge'), value: 'judge' },
      ],
    },
    {
      id: 'organization',
      label: t('competitions.participants.form.fields.organization.label', 'Organization'),
      type: 'text',
      placeholder: t('competitions.participants.form.fields.organization.placeholder', 'e.g. Acme Corp'),
    },
  ], [t, competitionId])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    {
      id: 'participant',
      title: t('competitions.participants.form.groups.participant', 'Participant Details'),
      column: 1,
      fields: ['competitionId', 'email', 'role', 'organization'],
    },
  ], [t])

  const backHref = competitionId
    ? `/backend/competitions/participants?competitionId=${competitionId}`
    : '/backend/competitions/participants'

  const successRedirect = React.useMemo(
    () => `${backHref}&flash=${encodeURIComponent(t('competitions.participants.flash.created', 'Participant added'))}&type=success`,
    [t, backHref],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('competitions.participants.form.create.title', 'Add participant')}
          backHref={backHref}
          fields={fields}
          groups={groups}
          submitLabel={t('competitions.participants.form.create.submit', 'Add participant')}
          cancelHref={backHref}
          successRedirect={successRedirect}
          onSubmit={async (vals) => { await createCrud('competitions/participations', vals) }}
        />
      </PageBody>
    </Page>
  )
}
