"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { TeamRosterCard, type TeamSummary } from '../../../../components/TeamRoster'
import { TeamTracksEditor } from '../../../../components/TeamTracksEditor'

type TeamFormValues = {
  id: string
  name: string
  description: string
  table_number: number | null
  table_location: string
}

export default function EditTeamPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<TeamFormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)
  const [summary, setSummary] = React.useState<TeamSummary | null>(null)
  const [competitionId, setCompetitionId] = React.useState<string | null>(null)

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'name', label: t('teams.fields.name', 'Name'), type: 'text', required: true },
    { id: 'description', label: t('teams.fields.description', 'Description'), type: 'textarea' },
    { id: 'table_number', label: t('teams.fields.tableNumber', 'Table Number'), type: 'number' },
    { id: 'table_location', label: t('teams.fields.tableLocation', 'Table Location'), type: 'text' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'general', title: t('teams.groups.general', 'General'), column: 1, fields: ['name', 'description'] },
    { id: 'logistics', title: t('teams.groups.logistics', 'Logistics'), column: 2, fields: ['table_number', 'table_location'] },
  ], [t])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      setLoading(true)
      setErr(null)
      try {
        const data = await fetchCrudList<Record<string, unknown>>('teams/teams', { id, pageSize: '1' })
        const item = data?.items?.[0]
        if (!item) throw new Error('Team not found')
        if (!cancelled) {
          setSummary((item._teams as TeamSummary | undefined) ?? null)
          setCompetitionId(item.competition_id ? String(item.competition_id) : null)
          setInitial({
            id: String(item.id),
            name: String(item.name ?? ''),
            description: String(item.description ?? ''),
            table_number: item.table_number != null ? Number(item.table_number) : null,
            table_location: String(item.table_location ?? ''),
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

  // Tracks are saved outside the CrudForm, so only the roster is refreshed — typed-but-unsaved
  // form values must survive.
  const reloadSummary = React.useCallback(async () => {
    if (!id) return
    const data = await fetchCrudList<Record<string, unknown>>('teams/teams', { id, pageSize: '1' })
    setSummary((data?.items?.[0]?._teams as TeamSummary | undefined) ?? null)
  }, [id])

  const fallback = React.useMemo<TeamFormValues>(() => ({
    id: id ?? '', name: '', description: '',
    table_number: null, table_location: '',
  }), [id])

  if (!id) return null

  return (
    <Page>
      <PageBody>
        {err ? (
          <div className="text-red-600">{err}</div>
        ) : (
          <>
          <CrudForm<TeamFormValues>
            title={t('teams.edit.title', 'Edit Team')}
            backHref="/backend/teams"
            entityId="teams:team"
            fields={fields}
            groups={groups}
            initialValues={initial ?? fallback}
            submitLabel={t('teams.edit.submit', 'Save')}
            cancelHref="/backend/teams"
            successRedirect={`/backend/teams?flash=${encodeURIComponent(t('teams.flash.saved', 'Team saved'))}&type=success`}
            isLoading={loading}
            loadingMessage={t('teams.edit.loading', 'Loading team...')}
            onSubmit={async (vals) => { await updateCrud('teams/teams', vals) }}
            onDelete={async () => {
              if (!id) return
              try {
                await deleteCrud('teams/teams', String(id))
                pushWithFlash(router, '/backend/teams', t('teams.flash.deleted', 'Team deleted'), 'success')
              } catch (error) {
                setErr(error instanceof Error ? error.message : 'Delete failed')
              }
            }}
          />
          {/* Members + every selected track, by name */}
          {!loading && (
            <TeamRosterCard
              summary={summary}
              tracksSlot={competitionId ? (
                <TeamTracksEditor
                  teamId={id}
                  competitionId={competitionId}
                  assigned={summary?.tracks ?? []}
                  onSaved={reloadSummary}
                />
              ) : undefined}
            />
          )}
          </>
        )}
      </PageBody>
    </Page>
  )
}
