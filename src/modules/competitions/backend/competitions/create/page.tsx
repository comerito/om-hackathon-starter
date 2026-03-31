"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function CreateCompetitionPage() {
  const t = useT()

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'name', label: t('competitions.fields.name', 'Name'), type: 'text', required: true },
    { id: 'slug', label: t('competitions.fields.slug', 'Slug'), type: 'text', required: true, placeholder: 'my-hackathon-2026' },
    { id: 'description', label: t('competitions.fields.description', 'Description'), type: 'textarea' },
    { id: 'location', label: t('competitions.fields.location', 'Location'), type: 'text' },
    { id: 'starts_at', label: t('competitions.fields.startsAt', 'Starts At'), type: 'datetime', required: true },
    { id: 'ends_at', label: t('competitions.fields.endsAt', 'Ends At'), type: 'datetime', required: true },
    { id: 'timezone', label: t('competitions.fields.timezone', 'Timezone'), type: 'text', defaultValue: 'Europe/Warsaw' },
    { id: 'min_team_size', label: t('competitions.fields.minTeamSize', 'Min Team Size'), type: 'number', defaultValue: 2 },
    { id: 'max_team_size', label: t('competitions.fields.maxTeamSize', 'Max Team Size'), type: 'number', defaultValue: 5 },
    { id: 'code_of_conduct_url', label: t('competitions.fields.cocUrl', 'Code of Conduct URL'), type: 'text', required: true },
    { id: 'code_of_conduct_content', label: t('competitions.fields.cocContent', 'Code of Conduct Content (Markdown)'), type: 'textarea' },
    { id: 'rules_url', label: t('competitions.fields.rulesUrl', 'Rules URL'), type: 'text' },
    { id: 'rules_content', label: t('competitions.fields.rulesContent', 'Rules Content (Markdown)'), type: 'textarea' },
    { id: 'privacy_policy_url', label: t('competitions.fields.privacyPolicyUrl', 'Privacy Policy URL'), type: 'text' },
    { id: 'privacy_policy_content', label: t('competitions.fields.privacyPolicyContent', 'Privacy Policy Content (Markdown)'), type: 'textarea' },
    { id: 'cover_image_url', label: t('competitions.fields.coverImageUrl', 'Cover Image URL'), type: 'text' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'general', title: t('competitions.groups.general', 'General'), column: 1, fields: ['name', 'slug', 'description', 'location'] },
    { id: 'schedule', title: t('competitions.groups.schedule', 'Schedule'), column: 2, fields: ['starts_at', 'ends_at', 'timezone'] },
    { id: 'teams', title: t('competitions.groups.teams', 'Team Settings'), column: 1, fields: ['min_team_size', 'max_team_size'] },
    {
      id: 'legal',
      title: t('competitions.groups.legal', 'Legal & Media'),
      column: 2,
      fields: [
        'code_of_conduct_url',
        'code_of_conduct_content',
        'rules_url',
        'rules_content',
        'privacy_policy_url',
        'privacy_policy_content',
        'cover_image_url',
      ],
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
          title={t('competitions.create.title', 'Create Competition')}
          backHref="/backend/competitions"
          entityId="competitions:competition"
          fields={fields}
          groups={groups}
          submitLabel={t('competitions.create.submit', 'Create')}
          cancelHref="/backend/competitions"
          successRedirect={successRedirect}
          onSubmit={async (vals) => { await createCrud('competitions/competitions', vals) }}
        />
      </PageBody>
    </Page>
  )
}
