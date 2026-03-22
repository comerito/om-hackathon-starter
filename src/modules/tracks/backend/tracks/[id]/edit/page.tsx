"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Input } from '@open-mercato/ui/primitives/input'

const ICON_OPTIONS = [
  'lucide:cpu', 'lucide:brain', 'lucide:globe', 'lucide:palette', 'lucide:shield',
  'lucide:rocket', 'lucide:heart', 'lucide:zap', 'lucide:database', 'lucide:code',
  'lucide:smartphone', 'lucide:cloud', 'lucide:lock', 'lucide:music', 'lucide:camera',
  'lucide:gamepad-2', 'lucide:leaf', 'lucide:lightbulb', 'lucide:microscope', 'lucide:wifi',
]

type CompetitionOption = { id: string; name: string }

type TrackFormValues = {
  id: string
  competition_id: string
  name: string
  description: string
  color: string
  icon_url: string
  max_teams: number | null
  order: number
}

export default function EditTrackPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<TrackFormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)

  const loadCompetitions = React.useCallback(async (query?: string) => {
    const params: Record<string, string> = { pageSize: '50' }
    if (query) params.name = query
    const data = await fetchCrudList<CompetitionOption>('competitions/competitions', params)
    return (data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))
  }, [])

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'competition_id', label: t('tracks.fields.competition', 'Competition'), type: 'combobox', required: true, loadOptions: loadCompetitions },
    { id: 'name', label: t('tracks.fields.name', 'Name'), type: 'text', required: true },
    { id: 'description', label: t('tracks.fields.description', 'Description'), type: 'textarea' },
    {
      id: 'color', label: t('tracks.fields.color', 'Color'), type: 'custom',
      component: ({ value, setValue }) => (
        <div className="flex items-center gap-3">
          <input type="color" value={String(value || '#6366f1')} onChange={(e) => setValue(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-input bg-background p-1" />
          <Input value={String(value || '#6366f1')}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
            placeholder="#6366f1" className="max-w-[140px] font-mono text-sm" />
          <div className="h-6 w-6 rounded-full border" style={{ backgroundColor: String(value || '#6366f1') }} />
        </div>
      ),
    },
    {
      id: 'icon_url', label: t('tracks.fields.iconUrl', 'Icon'), type: 'custom',
      component: ({ value, setValue }) => (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {ICON_OPTIONS.map((icon) => {
              const name = icon.replace('lucide:', '')
              return (
                <button key={icon} type="button" onClick={() => setValue(icon)} title={name}
                  className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm transition-colors ${
                    value === icon ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30' : 'border-input hover:bg-muted'
                  }`}>
                  <span className="text-xs">{name.substring(0, 2).toUpperCase()}</span>
                </button>
              )
            })}
          </div>
          <Input value={String(value || '')}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
            placeholder="lucide:icon-name or URL" className="max-w-[300px] text-sm" />
        </div>
      ),
    },
    { id: 'max_teams', label: t('tracks.fields.maxTeams', 'Max Teams'), type: 'number' },
    { id: 'order', label: t('tracks.fields.order', 'Order'), type: 'number' },
  ], [t, loadCompetitions])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'general', title: t('tracks.groups.general', 'General'), column: 1, fields: ['competition_id', 'name', 'description'] },
    { id: 'appearance', title: t('tracks.groups.appearance', 'Appearance'), column: 2, fields: ['color', 'icon_url'] },
    { id: 'settings', title: t('tracks.groups.settings', 'Settings'), column: 1, fields: ['max_teams', 'order'] },
  ], [t])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      setLoading(true)
      setErr(null)
      try {
        const data = await fetchCrudList<Record<string, unknown>>('tracks/tracks', { id, pageSize: '1' })
        const item = data?.items?.[0]
        if (!item) throw new Error('Track not found')
        if (!cancelled) {
          setInitial({
            id: String(item.id),
            competition_id: String(item.competition_id ?? ''),
            name: String(item.name ?? ''),
            description: String(item.description ?? ''),
            color: String(item.color ?? '#6366f1'),
            icon_url: String(item.icon_url ?? ''),
            max_teams: item.max_teams != null ? Number(item.max_teams) : null,
            order: Number(item.order ?? 0),
          })
        }
      } catch (error: unknown) {
        if (!cancelled) setErr(error instanceof Error ? error.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  const fallback = React.useMemo<TrackFormValues>(() => ({
    id: id ?? '', competition_id: '', name: '', description: '',
    color: '#6366f1', icon_url: '', max_teams: null, order: 0,
  }), [id])

  if (!id) return null

  return (
    <Page>
      <PageBody>
        {err ? (
          <div className="text-red-600">{err}</div>
        ) : (
          <CrudForm<TrackFormValues>
            title={t('tracks.edit.title', 'Edit Track')}
            backHref="/backend/tracks"
            entityId="tracks:track"
            fields={fields}
            groups={groups}
            initialValues={initial ?? fallback}
            submitLabel={t('tracks.edit.submit', 'Save')}
            cancelHref="/backend/tracks"
            successRedirect={`/backend/tracks?flash=${encodeURIComponent(t('tracks.flash.saved', 'Track saved'))}&type=success`}
            isLoading={loading}
            loadingMessage={t('tracks.edit.loading', 'Loading track...')}
            onSubmit={async (vals) => { await updateCrud('tracks/tracks', vals) }}
            onDelete={async () => {
              if (!id) return
              try {
                await deleteCrud('tracks/tracks', String(id))
                pushWithFlash(router, '/backend/tracks', t('tracks.flash.deleted', 'Track deleted'), 'success')
              } catch (error) {
                setErr(error instanceof Error ? error.message : 'Delete failed')
              }
            }}
          />
        )}
      </PageBody>
    </Page>
  )
}
