"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type TrackItem = {
  id: string
  competition_id: string
  name: string
  description?: string | null
  color: string
  icon_url?: string | null
  max_teams?: number | null
  order: number
  mentor_ids?: string[]
  is_active?: boolean
}

type TrackFormValues = {
  id: string
  competitionId: string
  name: string
  description: string
  color: string
  iconUrl: string
  maxTeams: string
  order: string
  mentorIds: string
}

export default function EditTrackPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<TrackFormValues | null>(null)
  const [competitionId, setCompetitionId] = React.useState<string>('')
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)

  const baseFields = React.useMemo<CrudField[]>(() => [
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

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      setLoading(true)
      setErr(null)
      try {
        // We need to fetch with a known competitionId; use a broad search with pageSize 1
        const data = await fetchCrudList<TrackItem>('tracks/tracks', { id: String(id), pageSize: '1', competitionId: '' } as Record<string, string>)
        const item = data?.items?.[0]
        if (!item) throw new Error(t('tracks.form.error.notFound', 'Track not found'))
        if (!cancelled) {
          setCompetitionId(item.competition_id)
          setInitial({
            id: item.id,
            competitionId: item.competition_id,
            name: item.name,
            description: item.description ?? '',
            color: item.color ?? '#6366f1',
            iconUrl: item.icon_url ?? '',
            maxTeams: item.max_teams != null ? String(item.max_teams) : '',
            order: String(item.order ?? 0),
            mentorIds: Array.isArray(item.mentor_ids) ? item.mentor_ids.join(', ') : '',
          })
        }
      } catch (error: unknown) {
        if (!cancelled) {
          const message = error instanceof Error && error.message ? error.message : t('tracks.form.error.load', 'Failed to load track')
          setErr(message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, t])

  const fallbackInitialValues = React.useMemo<TrackFormValues>(() => ({
    id: id ?? '',
    competitionId: '',
    name: '',
    description: '',
    color: '#6366f1',
    iconUrl: '',
    maxTeams: '',
    order: '0',
    mentorIds: '',
  }), [id])

  const backHref = competitionId
    ? `/backend/tracks?competitionId=${competitionId}`
    : '/backend/tracks'

  const successRedirect = React.useMemo(
    () => `${backHref}&flash=${encodeURIComponent(t('tracks.flash.saved', 'Track saved'))}&type=success`,
    [t, backHref],
  )

  if (!id) return null

  return (
    <Page>
      <PageBody>
        {err ? (
          <div className="text-red-600">{err}</div>
        ) : (
          <CrudForm<TrackFormValues>
            title={t('tracks.form.edit.title', 'Edit track')}
            backHref={backHref}
            fields={baseFields}
            groups={groups}
            initialValues={initial ?? fallbackInitialValues}
            submitLabel={t('tracks.form.edit.submit', 'Save track')}
            cancelHref={backHref}
            successRedirect={successRedirect}
            isLoading={loading}
            loadingMessage={t('tracks.form.loading', 'Loading track...')}
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
              await updateCrud('tracks/tracks', payload)
            }}
            onDelete={async () => {
              if (!id) return
              try {
                await deleteCrud('tracks/tracks', String(id))
                pushWithFlash(router, backHref, t('tracks.flash.deleted', 'Track deleted'), 'success')
              } catch (error) {
                const message =
                  error instanceof Error && error.message ? error.message : t('tracks.table.error.delete', 'Failed to delete track')
                setErr(message)
              }
            }}
          />
        )}
      </PageBody>
    </Page>
  )
}
