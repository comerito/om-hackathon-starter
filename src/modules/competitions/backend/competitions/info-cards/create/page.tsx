"use client"
import * as React from 'react'
import { useSearchParams } from 'next/navigation'
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

export default function CreateCompetitionInfoCardPage() {
  const t = useT()
  const searchParams = useSearchParams()
  const competitionId = searchParams.get('competitionId') ?? ''

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'competition_id', label: t('competitions.infoCards.competition', 'Competition'), type: 'combobox', required: true, loadOptions: loadCompetitions, defaultValue: competitionId },
    { id: 'key', label: t('competitions.infoCards.key', 'Key'), type: 'text', required: true, placeholder: 'wifi' },
    { id: 'icon', label: t('competitions.infoCards.icon', 'Icon'), type: 'text', placeholder: 'wifi' },
    { id: 'label', label: t('competitions.infoCards.label', 'Label'), type: 'text', required: true },
    { id: 'value', label: t('competitions.infoCards.value', 'Value'), type: 'textarea', required: true },
    { id: 'sort_order', label: t('competitions.infoCards.sortOrder', 'Sort Order'), type: 'number', defaultValue: 0 },
  ], [competitionId, t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('competitions.infoCards.groups.details', 'Details'), column: 1, fields: ['competition_id', 'key', 'icon', 'sort_order'] },
    { id: 'content', title: t('competitions.infoCards.groups.content', 'Content'), column: 2, fields: ['label', 'value'] },
  ], [t])

  const successRedirect = competitionId
    ? `/backend/competitions/info-cards?competitionId=${encodeURIComponent(competitionId)}&flash=${encodeURIComponent(t('competitions.infoCards.flash.created', 'Info card created'))}&type=success`
    : `/backend/competitions/info-cards?flash=${encodeURIComponent(t('competitions.infoCards.flash.created', 'Info card created'))}&type=success`

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('competitions.infoCards.createTitle', 'Add Competition Info Card')}
          backHref={competitionId ? `/backend/competitions/info-cards?competitionId=${encodeURIComponent(competitionId)}` : '/backend/competitions/info-cards'}
          entityId="competitions:competition_info_card"
          fields={fields}
          groups={groups}
          submitLabel={t('competitions.infoCards.createSubmit', 'Create')}
          cancelHref={competitionId ? `/backend/competitions/info-cards?competitionId=${encodeURIComponent(competitionId)}` : '/backend/competitions/info-cards'}
          successRedirect={successRedirect}
          onSubmit={async (vals) => { await createCrud('competitions/info-cards', vals) }}
        />
      </PageBody>
    </Page>
  )
}
