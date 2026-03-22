"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud, fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type CompetitionOption = { id: string; name: string }
type CustomerUserOption = { id: string; displayName: string; email: string }

async function loadCompetitions(query?: string) {
  const params: Record<string, string> = { pageSize: '20' }
  if (query) params.name = query
  const res = await fetchCrudList<CompetitionOption>('competitions/competitions', params)
  return (res?.items ?? []).map((c) => ({ value: c.id, label: c.name }))
}

async function loadCustomerUsers(query?: string) {
  try {
    const params: Record<string, string> = { pageSize: '20' }
    if (query) params.search = query
    const data = await readApiResultOrThrow<{ items: CustomerUserOption[] }>(
      `/api/customer_accounts?${new URLSearchParams(params).toString()}`,
    )
    return (data?.items ?? []).map((u) => ({ value: u.id, label: `${u.displayName || u.email} (${u.email})` }))
  } catch {
    return []
  }
}

export default function AddParticipantPage() {
  const t = useT()

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'competition_id',
      label: t('competitions.participants.form.competition', 'Competition'),
      type: 'combobox',
      required: true,
      loadOptions: loadCompetitions,
    },
    {
      id: 'customer_user_id',
      label: t('competitions.participants.form.customerUser', 'Customer Account'),
      type: 'combobox',
      required: true,
      loadOptions: loadCustomerUsers,
    },
    {
      id: 'role',
      label: t('competitions.participants.form.role', 'Role'),
      type: 'select',
      required: true,
      options: [
        { value: 'participant', label: 'Participant' },
        { value: 'mentor', label: 'Mentor' },
        { value: 'judge', label: 'Judge' },
      ],
    },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    {
      id: 'assignment',
      title: t('competitions.participants.form.group', 'Assign Participant'),
      column: 1,
      fields: ['competition_id', 'customer_user_id', 'role'],
    },
  ], [t])

  const successRedirect = React.useMemo(
    () => `/backend/competitions/participants?flash=${encodeURIComponent(t('competitions.participants.flash.added', 'Participant added'))}&type=success`,
    [t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('competitions.participants.form.title', 'Add Participant')}
          backHref="/backend/competitions/participants"
          entityId="competitions:competition_participation"
          fields={fields}
          groups={groups}
          submitLabel={t('competitions.participants.form.submit', 'Add')}
          cancelHref="/backend/competitions/participants"
          successRedirect={successRedirect}
          onSubmit={async (vals) => { await createCrud('competitions/participations', vals) }}
        />
      </PageBody>
    </Page>
  )
}
