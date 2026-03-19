"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type CompetitionFormValues = {
  id: string
  name: string
  slug: string
  description: string
  location: string
  starts_at: string
  ends_at: string
  timezone: string
  min_team_size: number
  max_team_size: number
  code_of_conduct_url: string
  rules_url: string
  privacy_policy_url: string
  cover_image_url: string
  stage: string
}

export default function EditCompetitionPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<CompetitionFormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'name', label: t('competitions.fields.name', 'Name'), type: 'text', required: true },
    { id: 'slug', label: t('competitions.fields.slug', 'Slug'), type: 'text', required: true },
    { id: 'description', label: t('competitions.fields.description', 'Description'), type: 'textarea' },
    { id: 'location', label: t('competitions.fields.location', 'Location'), type: 'text' },
    { id: 'starts_at', label: t('competitions.fields.startsAt', 'Starts At'), type: 'datetime', required: true },
    { id: 'ends_at', label: t('competitions.fields.endsAt', 'Ends At'), type: 'datetime', required: true },
    { id: 'timezone', label: t('competitions.fields.timezone', 'Timezone'), type: 'text' },
    { id: 'min_team_size', label: t('competitions.fields.minTeamSize', 'Min Team Size'), type: 'number' },
    { id: 'max_team_size', label: t('competitions.fields.maxTeamSize', 'Max Team Size'), type: 'number' },
    { id: 'code_of_conduct_url', label: t('competitions.fields.cocUrl', 'Code of Conduct URL'), type: 'text', required: true },
    { id: 'rules_url', label: t('competitions.fields.rulesUrl', 'Rules URL'), type: 'text' },
    { id: 'privacy_policy_url', label: t('competitions.fields.privacyPolicyUrl', 'Privacy Policy URL'), type: 'text' },
    { id: 'cover_image_url', label: t('competitions.fields.coverImageUrl', 'Cover Image URL'), type: 'text' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'general', title: t('competitions.groups.general', 'General'), column: 1, fields: ['name', 'slug', 'description', 'location'] },
    { id: 'schedule', title: t('competitions.groups.schedule', 'Schedule'), column: 2, fields: ['starts_at', 'ends_at', 'timezone'] },
    { id: 'teams', title: t('competitions.groups.teams', 'Team Settings'), column: 1, fields: ['min_team_size', 'max_team_size'] },
    { id: 'legal', title: t('competitions.groups.legal', 'Legal & Media'), column: 2, fields: ['code_of_conduct_url', 'rules_url', 'privacy_policy_url', 'cover_image_url'] },
  ], [t])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      setLoading(true)
      setErr(null)
      try {
        const data = await fetchCrudList<Record<string, unknown>>('competitions/competitions', { id, pageSize: '1' })
        const item = data?.items?.[0]
        if (!item) throw new Error('Competition not found')
        if (!cancelled) {
          setInitial({
            id: String(item.id),
            name: String(item.name ?? ''),
            slug: String(item.slug ?? ''),
            description: String(item.description ?? ''),
            location: String(item.location ?? ''),
            starts_at: String(item.starts_at ?? ''),
            ends_at: String(item.ends_at ?? ''),
            timezone: String(item.timezone ?? 'Europe/Warsaw'),
            min_team_size: Number(item.min_team_size ?? 2),
            max_team_size: Number(item.max_team_size ?? 5),
            code_of_conduct_url: String(item.code_of_conduct_url ?? ''),
            rules_url: String(item.rules_url ?? ''),
            privacy_policy_url: String(item.privacy_policy_url ?? ''),
            cover_image_url: String(item.cover_image_url ?? ''),
            stage: String(item.stage ?? 'draft'),
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

  const fallback = React.useMemo<CompetitionFormValues>(() => ({
    id: id ?? '', name: '', slug: '', description: '', location: '',
    starts_at: '', ends_at: '', timezone: 'Europe/Warsaw',
    min_team_size: 2, max_team_size: 5,
    code_of_conduct_url: '', rules_url: '', privacy_policy_url: '', cover_image_url: '', stage: 'draft',
  }), [id])

  if (!id) return null

  return (
    <Page>
      <PageBody>
        {err ? (
          <div className="text-red-600">{err}</div>
        ) : (
          <CrudForm<CompetitionFormValues>
            title={t('competitions.edit.title', 'Edit Competition')}
            backHref="/backend/competitions/competitions"
            entityId="competitions:competition"
            fields={fields}
            groups={groups}
            initialValues={initial ?? fallback}
            submitLabel={t('competitions.edit.submit', 'Save')}
            cancelHref="/backend/competitions/competitions"
            successRedirect={`/backend/competitions/competitions?flash=${encodeURIComponent(t('competitions.flash.saved', 'Competition saved'))}&type=success`}
            isLoading={loading}
            loadingMessage={t('competitions.edit.loading', 'Loading competition...')}
            onSubmit={async (vals) => { await updateCrud('competitions/competitions', vals) }}
            onDelete={async () => {
              if (!id) return
              try {
                await deleteCrud('competitions/competitions', String(id))
                pushWithFlash(router, '/backend/competitions/competitions', t('competitions.flash.deleted', 'Competition deleted'), 'success')
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
