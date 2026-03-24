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

export default function CreateSponsorPage() {
  const t = useT()
  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'competition_id', label: t('sponsors.fields.competition', 'Competition'), type: 'combobox', required: true, loadOptions: loadCompetitions },
    { id: 'name', label: t('sponsors.fields.name', 'Name'), type: 'text', required: true },
    { id: 'tier', label: t('sponsors.fields.tier', 'Tier'), type: 'select', defaultValue: 'partner',
      options: [{ value: 'title', label: 'Title' }, { value: 'gold', label: 'Gold' }, { value: 'silver', label: 'Silver' }, { value: 'partner', label: 'Partner' }, { value: 'in_kind', label: 'In-Kind' }] },
    { id: 'logo_url', label: t('sponsors.fields.logoUrl', 'Logo URL'), type: 'text', required: true },
    { id: 'website_url', label: t('sponsors.fields.websiteUrl', 'Website URL'), type: 'text' },
    { id: 'description', label: t('sponsors.fields.description', 'Description'), type: 'textarea' },
    { id: 'challenge_title', label: t('sponsors.fields.challengeTitle', 'Challenge Title'), type: 'text' },
    { id: 'challenge_description', label: t('sponsors.fields.challengeDescription', 'Challenge Description'), type: 'textarea' },
    { id: 'contact_name', label: t('sponsors.fields.contactName', 'Contact Name'), type: 'text' },
    { id: 'contact_email', label: t('sponsors.fields.contactEmail', 'Contact Email'), type: 'text' },
    { id: 'order', label: t('sponsors.fields.order', 'Display Order'), type: 'number', defaultValue: 0 },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('sponsors.groups.details', 'Sponsor Details'), column: 1, fields: ['competition_id', 'name', 'tier', 'logo_url', 'website_url', 'description'] },
    { id: 'challenge', title: t('sponsors.groups.challenge', 'Sponsor Challenge'), column: 2, fields: ['challenge_title', 'challenge_description'] },
    { id: 'contact', title: t('sponsors.groups.contact', 'Contact'), column: 2, fields: ['contact_name', 'contact_email', 'order'] },
  ], [t])

  return (
    <Page><PageBody>
      <CrudForm
        title={t('sponsors.create.title', 'Add Sponsor')}
        backHref="/backend/sponsors" entityId="sponsors:sponsor"
        fields={fields} groups={groups}
        submitLabel={t('sponsors.create.submit', 'Create')}
        cancelHref="/backend/sponsors"
        successRedirect={`/backend/sponsors?flash=${encodeURIComponent(t('sponsors.flash.created', 'Sponsor created'))}&type=success`}
        onSubmit={async (vals) => { await createCrud('sponsors/sponsors', vals) }}
      />
    </PageBody></Page>
  )
}
