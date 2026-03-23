"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud, fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Input } from '@open-mercato/ui/primitives/input'

const ICON_OPTIONS = [
  'lucide:cpu', 'lucide:brain', 'lucide:globe', 'lucide:palette', 'lucide:shield',
  'lucide:rocket', 'lucide:heart', 'lucide:zap', 'lucide:database', 'lucide:code',
  'lucide:smartphone', 'lucide:cloud', 'lucide:lock', 'lucide:music', 'lucide:camera',
  'lucide:gamepad-2', 'lucide:leaf', 'lucide:lightbulb', 'lucide:microscope', 'lucide:wifi',
]

type CompetitionOption = { id: string; name: string }

export default function CreateTrackPage() {
  const t = useT()

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
    { id: 'category', label: t('tracks.fields.category', 'Category'), type: 'text' },
    { id: 'badge', label: t('tracks.fields.badge', 'Badge'), type: 'select', options: [
      { value: '', label: 'None' },
      { value: 'new', label: 'NEW' },
      { value: 'hot', label: 'HOT' },
      { value: 'stability', label: 'STABILITY' },
    ]},
    { id: 'max_teams', label: t('tracks.fields.maxTeams', 'Max Teams'), type: 'number' },
    { id: 'order', label: t('tracks.fields.order', 'Order'), type: 'number' },
  ], [t, loadCompetitions])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'general', title: t('tracks.groups.general', 'General'), column: 1, fields: ['competition_id', 'name', 'description', 'category', 'badge'] },
    { id: 'appearance', title: t('tracks.groups.appearance', 'Appearance'), column: 2, fields: ['color', 'icon_url'] },
    { id: 'settings', title: t('tracks.groups.settings', 'Settings'), column: 1, fields: ['max_teams', 'order'] },
  ], [t])

  const successRedirect = React.useMemo(
    () => `/backend/tracks?flash=${encodeURIComponent(t('tracks.flash.created', 'Track created'))}&type=success`,
    [t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('tracks.create.title', 'Create Track')}
          backHref="/backend/tracks"
          entityId="tracks:track"
          fields={fields}
          groups={groups}
          submitLabel={t('tracks.create.submit', 'Create')}
          cancelHref="/backend/tracks"
          successRedirect={successRedirect}
          onSubmit={async (vals) => { await createCrud('tracks/tracks', vals) }}
        />
      </PageBody>
    </Page>
  )
}
