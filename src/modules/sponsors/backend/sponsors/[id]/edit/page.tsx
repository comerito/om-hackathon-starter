"use client"
import * as React from 'react'

import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFieldOption, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { updateCrud, fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useQuery } from '@tanstack/react-query'

async function loadCompetitions(query?: string) {
  const params: Record<string, string> = { pageSize: '20' }
  if (query) params.name = query
  const res = await fetchCrudList<{ id: string; name: string }>('competitions/competitions', params)
  return (res?.items ?? []).map((c) => ({ value: c.id, label: c.name }))
}

// The sponsor API returns only `competition_id` and `loadCompetitions` is paginated, so the picker
// cannot resolve the label of a pre-selected id on its own. Best-effort: a missing label only
// degrades the picker to the raw id, it must never keep the form from loading.
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

export default function EditSponsorPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const sponsorId = params?.id

  const { data, isLoading, error } = useQuery({
    queryKey: ['sponsor-edit', sponsorId],
    queryFn: async () => {
      const res = await fetchCrudList<Record<string, unknown>>('sponsors/sponsors', { id: sponsorId!, pageSize: '1' })
      const item = res?.items?.[0]
      if (!item) throw new Error('Failed to load sponsor')
      // Resolved here rather than in a follow-up query so the form mounts with the picker's
      // label already known, instead of flashing an empty control first.
      const competitionOptions = await loadCompetitionSeedOptions(item.competition_id)
      return { item, competitionOptions }
    },
    enabled: !!sponsorId,
  })

  const competitionSeedOptions = data?.competitionOptions

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'competition_id',
      label: t('sponsors.fields.competition', 'Competition'),
      type: 'combobox',
      required: true,
      loadOptions: loadCompetitions,
      // Hydrate the option map with the linked competition so the picker renders its name
      // instead of the raw uuid (or nothing) before the user interacts with it.
      seedOptions: competitionSeedOptions,
    },
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
  ], [t, competitionSeedOptions])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('sponsors.groups.details', 'Sponsor Details'), column: 1, fields: ['competition_id', 'name', 'tier', 'logo_url', 'website_url', 'description'] },
    { id: 'challenge', title: t('sponsors.groups.challenge', 'Sponsor Challenge'), column: 2, fields: ['challenge_title', 'challenge_description'] },
    { id: 'contact', title: t('sponsors.groups.contact', 'Contact'), column: 2, fields: ['contact_name', 'contact_email', 'order'] },
  ], [t])

  if (isLoading) return <Page><PageBody><LoadingMessage label="Loading sponsor..." /></PageBody></Page>
  if (error || !data) return <Page><PageBody><ErrorMessage label="Failed to load sponsor" /></PageBody></Page>

  return (
    <Page><PageBody>
      <CrudForm
        title={t('sponsors.edit.title', 'Edit Sponsor')}
        backHref="/backend/sponsors" entityId="sponsors:sponsor"
        fields={fields} groups={groups}
        initialValues={data.item}
        // "Competition" is the first field, so CrudForm would autofocus it on mount, and
        // ComboboxInput only mirrors its `value` into the visible text while NOT focused — see
        // the prize/criteria forms and #90. Suppressing the autofocus lets it show its selection.
        disableInitialFocus
        submitLabel={t('sponsors.edit.submit', 'Save Changes')}
        cancelHref="/backend/sponsors"
        successRedirect={`/backend/sponsors?flash=${encodeURIComponent(t('sponsors.flash.updated', 'Sponsor updated'))}&type=success`}
        onSubmit={async (vals) => { await updateCrud('sponsors/sponsors', { ...vals, id: sponsorId }) }}
      />
    </PageBody></Page>
  )
}
