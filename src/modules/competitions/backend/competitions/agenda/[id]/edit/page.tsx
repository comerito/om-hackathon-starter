"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type AgendaFormValues = {
  id: string
  competition_id: string
  title: string
  description: string
  type: string
  starts_at: string
  ends_at: string
  location: string
  speaker_name: string
  speaker_bio: string
  speaker_photo_url: string
  is_mandatory: boolean
  order: number
}

export default function EditAgendaItemPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<AgendaFormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'title', label: t('competitions.agenda.title', 'Title'), type: 'text', required: true },
    { id: 'description', label: t('competitions.agenda.description', 'Description'), type: 'textarea' },
    { id: 'type', label: t('competitions.agenda.type', 'Type'), type: 'select', options: [
      { value: 'ceremony', label: 'Ceremony' }, { value: 'talk', label: 'Talk' },
      { value: 'workshop', label: 'Workshop' }, { value: 'break', label: 'Break' },
      { value: 'meal', label: 'Meal' }, { value: 'deadline', label: 'Deadline' },
      { value: 'demo_session', label: 'Demo Session' }, { value: 'custom', label: 'Custom' },
    ] },
    { id: 'starts_at', label: t('competitions.agenda.startsAt', 'Start Time'), type: 'datetime', required: true },
    { id: 'ends_at', label: t('competitions.agenda.endsAt', 'End Time'), type: 'datetime', required: true },
    { id: 'location', label: t('competitions.agenda.location', 'Location'), type: 'text' },
    { id: 'speaker_name', label: t('competitions.agenda.speakerName', 'Speaker Name'), type: 'text' },
    { id: 'speaker_bio', label: t('competitions.agenda.speakerBio', 'Speaker Bio'), type: 'text', placeholder: 'Short bio or title' },
    { id: 'speaker_photo_url', label: t('competitions.agenda.speakerPhotoUrl', 'Speaker Photo URL'), type: 'text', placeholder: 'https://...' },
    { id: 'is_mandatory', label: t('competitions.agenda.isMandatory', 'Mandatory'), type: 'checkbox' },
    { id: 'order', label: t('competitions.agenda.order', 'Sort Order'), type: 'number' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('competitions.agenda.groups.details', 'Details'), column: 1, fields: ['title', 'description', 'type'] },
    { id: 'schedule', title: t('competitions.agenda.groups.schedule', 'Schedule'), column: 2, fields: ['starts_at', 'ends_at', 'location'] },
    { id: 'speaker', title: t('competitions.agenda.groups.speaker', 'Speaker'), column: 2, fields: ['speaker_name', 'speaker_bio', 'speaker_photo_url'] },
    { id: 'settings', title: t('competitions.agenda.groups.settings', 'Settings'), column: 1, fields: ['is_mandatory', 'order'] },
  ], [t])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      setLoading(true)
      setErr(null)
      try {
        const data = await fetchCrudList<Record<string, unknown>>('competitions/agenda', { id, pageSize: '1' })
        const item = data?.items?.[0]
        if (!item) throw new Error(t('competitions.agenda.error.notFound', 'Agenda item not found'))
        if (!cancelled) {
          setInitial({
            id: String(item.id),
            competition_id: String(item.competition_id ?? ''),
            title: String(item.title ?? ''),
            description: String(item.description ?? ''),
            type: String(item.type ?? 'custom'),
            starts_at: String(item.starts_at ?? ''),
            ends_at: String(item.ends_at ?? ''),
            location: String(item.location ?? ''),
            speaker_name: String(item.speaker_name ?? ''),
            speaker_bio: String(item.speaker_bio ?? ''),
            speaker_photo_url: String(item.speaker_photo_url ?? ''),
            is_mandatory: Boolean(item.is_mandatory),
            order: Number(item.order ?? 0),
          })
        }
      } catch (error: unknown) {
        if (!cancelled) setErr(error instanceof Error ? error.message : t('competitions.agenda.error.load', 'Failed to load'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, t])

  const fallback = React.useMemo<AgendaFormValues>(() => ({
    id: id ?? '', competition_id: '', title: '', description: '', type: 'custom',
    starts_at: '', ends_at: '', location: '', speaker_name: '', speaker_bio: '', speaker_photo_url: '', is_mandatory: false, order: 0,
  }), [id])

  if (!id) return null

  return (
    <Page>
      <PageBody>
        {err ? (
          <div className="text-red-600">{err}</div>
        ) : (
          <CrudForm<AgendaFormValues>
            title={t('competitions.agenda.edit.title', 'Edit Agenda Item')}
            backHref="/backend/competitions/agenda"
            entityId="competitions:agenda_item"
            fields={fields}
            groups={groups}
            initialValues={initial ?? fallback}
            submitLabel={t('competitions.agenda.edit.submit', 'Save')}
            cancelHref="/backend/competitions/agenda"
            successRedirect={`/backend/competitions/agenda?flash=${encodeURIComponent(t('competitions.agenda.flash.saved', 'Agenda item saved'))}&type=success`}
            isLoading={loading}
            loadingMessage={t('competitions.agenda.edit.loading', 'Loading...')}
            onSubmit={async (vals) => { await updateCrud('competitions/agenda', vals) }}
            onDelete={async () => {
              if (!id) return
              try {
                await deleteCrud('competitions/agenda', String(id))
                pushWithFlash(router, '/backend/competitions/agenda', t('competitions.agenda.flash.deleted', 'Agenda item deleted'), 'success')
              } catch (error) {
                setErr(error instanceof Error ? error.message : t('competitions.agenda.error.delete', 'Delete failed'))
              }
            }}
          />
        )}
      </PageBody>
    </Page>
  )
}
