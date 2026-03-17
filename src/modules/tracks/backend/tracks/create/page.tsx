"use client"
import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function CreateTrackPage() {
  const t = useT()
  const searchParams = useSearchParams()
  const competitionId = searchParams.get('competitionId') ?? ''

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'competitionId',
      label: t('tracks.form.fields.competitionId.label', 'Competition'),
      type: 'hidden',
      required: true,
    },
    {
      id: 'name',
      label: t('tracks.form.fields.name.label', 'Name'),
      type: 'text',
      required: true,
      placeholder: t('tracks.form.fields.name.placeholder', 'e.g. AI / Machine Learning'),
    },
    {
      id: 'description',
      label: t('tracks.form.fields.description.label', 'Description'),
      type: 'textarea',
      placeholder: t('tracks.form.fields.description.placeholder', 'What this track is about'),
    },
    {
      id: 'color',
      label: t('tracks.form.fields.color.label', 'Color'),
      type: 'text',
      placeholder: t('tracks.form.fields.color.placeholder', '#6366f1'),
    },
    {
      id: 'iconUrl',
      label: t('tracks.form.fields.iconUrl.label', 'Icon URL'),
      type: 'text',
      placeholder: t('tracks.form.fields.iconUrl.placeholder', 'https://...'),
    },
    {
      id: 'maxTeams',
      label: t('tracks.form.fields.maxTeams.label', 'Max teams'),
      type: 'number',
      placeholder: t('tracks.form.fields.maxTeams.placeholder', 'Leave empty for unlimited'),
    },
    {
      id: 'order',
      label: t('tracks.form.fields.order.label', 'Display order'),
      type: 'number',
      placeholder: '0',
    },
    {
      id: 'mentorIds',
      label: t('tracks.form.fields.mentorIds.label', 'Mentor IDs'),
      type: 'text',
      placeholder: t('tracks.form.fields.mentorIds.placeholder', 'Comma-separated UUIDs (multiselect coming soon)'),
    },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    {
      id: 'details',
      title: t('tracks.form.groups.details', 'Details'),
      column: 1,
      fields: ['name', 'description', 'color', 'iconUrl'],
    },
    {
      id: 'constraints',
      title: t('tracks.form.groups.constraints', 'Constraints'),
      column: 2,
      fields: ['maxTeams', 'order'],
    },
    {
      id: 'mentors',
      title: t('tracks.form.groups.mentors', 'Mentors'),
      column: 2,
      fields: ['mentorIds'],
    },
  ], [t])

  const initialValues = React.useMemo(() => ({
    competitionId,
    name: '',
    description: '',
    color: '#6366f1',
    iconUrl: '',
    maxTeams: '',
    order: '0',
    mentorIds: '',
  }), [competitionId])

  const backHref = competitionId
    ? `/backend/tracks?competitionId=${competitionId}`
    : '/backend/tracks'

  const successRedirect = React.useMemo(
    () => `${backHref}&flash=${encodeURIComponent(t('tracks.flash.created', 'Track created'))}&type=success`,
    [t, backHref],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('tracks.form.create.title', 'New track')}
          backHref={backHref}
          fields={fields}
          groups={groups}
          initialValues={initialValues}
          submitLabel={t('tracks.form.create.submit', 'Create track')}
          cancelHref={backHref}
          successRedirect={successRedirect}
          onSubmit={async (vals) => {
            const payload: Record<string, unknown> = { ...vals }
            // Parse mentorIds from comma-separated string
            if (typeof payload.mentorIds === 'string') {
              const raw = (payload.mentorIds as string).trim()
              payload.mentorIds = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []
            }
            // Parse maxTeams as number or null
            if (payload.maxTeams === '' || payload.maxTeams === undefined) {
              payload.maxTeams = null
            } else {
              payload.maxTeams = Number(payload.maxTeams)
            }
            // Parse order as number
            if (typeof payload.order === 'string') {
              payload.order = Number(payload.order) || 0
            }
            await createCrud('tracks/tracks', payload)
          }}
        />
      </PageBody>
    </Page>
  )
}
