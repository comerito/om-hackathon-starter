"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { useT } from '@open-mercato/shared/lib/i18n/context'

async function loadTeams(query?: string) {
  const params: Record<string, string> = { pageSize: '20' }
  if (query) params.name = query
  const res = await fetchCrudList<{ id: string; name: string }>('teams/teams', params)
  return (res?.items ?? []).map((t) => ({ value: t.id, label: t.name }))
}

type ResourceFormValues = {
  id: string
  team_id: string
  name: string
  type: string
  url: string
}

export default function EditResourcePage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<ResourceFormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'team_id', label: t('teams.resources.fields.team', 'Team'), type: 'combobox', required: true, loadOptions: loadTeams },
    { id: 'name', label: t('teams.resources.fields.name', 'Name'), type: 'text', required: true },
    {
      id: 'type',
      label: t('teams.resources.fields.type', 'Type'),
      type: 'select',
      options: [
        { value: 'file', label: t('teams.resources.types.file', 'File') },
        { value: 'link', label: t('teams.resources.types.link', 'Link') },
        { value: 'repository', label: t('teams.resources.types.repository', 'Repository') },
      ],
    },
    { id: 'url', label: t('teams.resources.fields.url', 'URL'), type: 'text' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('teams.resources.groups.details', 'Details'), column: 1, fields: ['team_id', 'name', 'type', 'url'] },
  ], [t])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      setLoading(true)
      setErr(null)
      try {
        const data = await fetchCrudList<Record<string, unknown>>('teams/resources', { id, pageSize: '1' })
        const item = data?.items?.[0]
        if (!item) throw new Error('Resource not found')
        if (!cancelled) {
          setInitial({
            id: String(item.id),
            team_id: String(item.team_id ?? ''),
            name: String(item.name ?? ''),
            type: String(item.type ?? 'link'),
            url: String(item.url ?? ''),
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

  const fallback = React.useMemo<ResourceFormValues>(() => ({
    id: id ?? '', team_id: '', name: '', type: 'link', url: '',
  }), [id])

  if (!id) return null

  return (
    <Page>
      <PageBody>
        {err ? (
          <div className="text-red-600">{err}</div>
        ) : (
          <CrudForm<ResourceFormValues>
            title={t('teams.resources.edit.title', 'Edit Resource')}
            backHref="/backend/teams/resources"
            entityId="teams:resource"
            fields={fields}
            groups={groups}
            initialValues={initial ?? fallback}
            submitLabel={t('teams.resources.edit.submit', 'Save')}
            cancelHref="/backend/teams/resources"
            successRedirect={`/backend/teams/resources?flash=${encodeURIComponent(t('teams.resources.flash.saved', 'Resource saved'))}&type=success`}
            isLoading={loading}
            loadingMessage={t('teams.resources.edit.loading', 'Loading resource...')}
            onSubmit={async (vals) => { await updateCrud('teams/resources', vals) }}
            onDelete={async () => {
              if (!id) return
              try {
                await deleteCrud('teams/resources', String(id))
                pushWithFlash(router, '/backend/teams/resources', t('teams.resources.flash.deleted', 'Resource deleted'), 'success')
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
