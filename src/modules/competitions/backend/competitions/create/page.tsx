"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function CreateCompetitionPage() {
  const t = useT()

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'name',
      label: t('competitions.form.fields.name.label', 'Name'),
      type: 'text',
      required: true,
      placeholder: t('competitions.form.fields.name.placeholder', 'e.g. HackOn 2026'),
    },
    {
      id: 'slug',
      label: t('competitions.form.fields.slug.label', 'Slug'),
      type: 'text',
      required: true,
      placeholder: t('competitions.form.fields.slug.placeholder', 'e.g. hackon-2026'),
    },
    {
      id: 'description',
      label: t('competitions.form.fields.description.label', 'Description'),
      type: 'textarea',
      placeholder: t('competitions.form.fields.description.placeholder', 'Brief description of the competition'),
    },
    {
      id: 'location',
      label: t('competitions.form.fields.location.label', 'Location'),
      type: 'text',
      placeholder: t('competitions.form.fields.location.placeholder', 'e.g. Warsaw, Poland'),
    },
    {
      id: 'startsAt',
      label: t('competitions.form.fields.startsAt.label', 'Starts at'),
      type: 'datetime',
      required: true,
    },
    {
      id: 'endsAt',
      label: t('competitions.form.fields.endsAt.label', 'Ends at'),
      type: 'datetime',
      required: true,
    },
    {
      id: 'timezone',
      label: t('competitions.form.fields.timezone.label', 'Timezone'),
      type: 'text',
      placeholder: t('competitions.form.fields.timezone.placeholder', 'e.g. Europe/Warsaw'),
    },
    {
      id: 'codeOfConductUrl',
      label: t('competitions.form.fields.codeOfConductUrl.label', 'Code of Conduct URL'),
      type: 'text',
      required: true,
      placeholder: t('competitions.form.fields.codeOfConductUrl.placeholder', 'https://...'),
    },
    {
      id: 'rulesUrl',
      label: t('competitions.form.fields.rulesUrl.label', 'Rules URL'),
      type: 'text',
      placeholder: t('competitions.form.fields.rulesUrl.placeholder', 'https://...'),
    },
    {
      id: 'privacyPolicyUrl',
      label: t('competitions.form.fields.privacyPolicyUrl.label', 'Privacy Policy URL'),
      type: 'text',
      placeholder: t('competitions.form.fields.privacyPolicyUrl.placeholder', 'https://...'),
    },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    {
      id: 'details',
      title: t('competitions.form.groups.details', 'Details'),
      column: 1,
      fields: ['name', 'slug', 'description', 'location'],
    },
    {
      id: 'schedule',
      title: t('competitions.form.groups.schedule', 'Schedule'),
      column: 2,
      fields: ['startsAt', 'endsAt', 'timezone'],
    },
    {
      id: 'legal',
      title: t('competitions.form.groups.legal', 'Legal'),
      column: 1,
      fields: ['codeOfConductUrl', 'rulesUrl', 'privacyPolicyUrl'],
    },
  ], [t])

  const successRedirect = React.useMemo(
    () => `/backend/competitions?flash=${encodeURIComponent(t('competitions.flash.created', 'Competition created'))}&type=success`,
    [t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('competitions.form.create.title', 'New competition')}
          backHref="/backend/competitions"
          fields={fields}
          groups={groups}
          submitLabel={t('competitions.form.create.submit', 'Create competition')}
          cancelHref="/backend/competitions"
          successRedirect={successRedirect}
          onSubmit={async (vals) => { await createCrud('competitions/competitions', vals) }}
        />
      </PageBody>
    </Page>
  )
}
