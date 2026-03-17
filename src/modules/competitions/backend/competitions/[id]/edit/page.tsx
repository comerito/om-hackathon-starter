"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type CompetitionItem = {
  id: string
  name: string
  slug: string
  description?: string | null
  location?: string | null
  starts_at?: string | null
  ends_at?: string | null
  timezone?: string | null
  stage?: string | null
  code_of_conduct_url?: string | null
  rules_url?: string | null
  privacy_policy_url?: string | null
}

type CompetitionFormValues = {
  id: string
  name: string
  slug: string
  description: string
  location: string
  starts_at: string
  ends_at: string
  timezone: string
  code_of_conduct_url: string
  rules_url: string
  privacy_policy_url: string
}

export default function EditCompetitionPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<CompetitionFormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)

  const baseFields = React.useMemo<CrudField[]>(() => [
    {
      id: 'name',
      label: t('competitions.form.fields.name.label', 'Name'),
      type: 'text',
      required: true,
      placeholder: t('competitions.form.fields.name.placeholder', 'e.g. HackOn 2026'),
    },
    {
      id: 'slug',
      label: t('competitions.form.fields.slug.label', 'Slug'),
      type: 'text',
      required: true,
      placeholder: t('competitions.form.fields.slug.placeholder', 'e.g. hackon-2026'),
    },
    {
      id: 'description',
      label: t('competitions.form.fields.description.label', 'Description'),
      type: 'textarea',
      placeholder: t('competitions.form.fields.description.placeholder', 'Brief description of the competition'),
    },
    {
      id: 'location',
      label: t('competitions.form.fields.location.label', 'Location'),
      type: 'text',
      placeholder: t('competitions.form.fields.location.placeholder', 'e.g. Warsaw, Poland'),
    },
    {
      id: 'starts_at',
      label: t('competitions.form.fields.startsAt.label', 'Starts at'),
      type: 'datetime',
      required: true,
    },
    {
      id: 'ends_at',
      label: t('competitions.form.fields.endsAt.label', 'Ends at'),
      type: 'datetime',
      required: true,
    },
    {
      id: 'timezone',
      label: t('competitions.form.fields.timezone.label', 'Timezone'),
      type: 'text',
      placeholder: t('competitions.form.fields.timezone.placeholder', 'e.g. Europe/Warsaw'),
    },
    {
      id: 'code_of_conduct_url',
      label: t('competitions.form.fields.codeOfConductUrl.label', 'Code of Conduct URL'),
      type: 'text',
      required: true,
      placeholder: t('competitions.form.fields.codeOfConductUrl.placeholder', 'https://...'),
    },
    {
      id: 'rules_url',
      label: t('competitions.form.fields.rulesUrl.label', 'Rules URL'),
      type: 'text',
      placeholder: t('competitions.form.fields.rulesUrl.placeholder', 'https://...'),
    },
    {
      id: 'privacy_policy_url',
      label: t('competitions.form.fields.privacyPolicyUrl.label', 'Privacy Policy URL'),
      type: 'text',
      placeholder: t('competitions.form.fields.privacyPolicyUrl.placeholder', 'https://...'),
    },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    {
      id: 'details',
      title: t('competitions.form.groups.details', 'Details'),
      column: 1,
      fields: ['name', 'slug', 'description', 'location'],
    },
    {
      id: 'schedule',
      title: t('competitions.form.groups.schedule', 'Schedule'),
      column: 2,
      fields: ['starts_at', 'ends_at', 'timezone'],
    },
    {
      id: 'legal',
      title: t('competitions.form.groups.legal', 'Legal'),
      column: 1,
      fields: ['code_of_conduct_url', 'rules_url', 'privacy_policy_url'],
    },
  ], [t])

  const successRedirect = React.useMemo(
    () => `/backend/competitions?flash=${encodeURIComponent(t('competitions.flash.saved', 'Competition saved'))}&type=success`,
    [t],
  )

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      setLoading(true)
      setErr(null)
      try {
        const data = await fetchCrudList<CompetitionItem>('competitions/competitions', { id: String(id), pageSize: 1 })
        const item = data?.items?.[0]
        if (!item) throw new Error(t('competitions.form.error.notFound', 'Competition not found'))
        const init: CompetitionFormValues = {
          id: item.id,
          name: item.name,
          slug: item.slug,
          description: item.description ?? '',
          location: item.location ?? '',
          starts_at: item.starts_at ?? '',
          ends_at: item.ends_at ?? '',
          timezone: item.timezone ?? 'Europe/Warsaw',
          code_of_conduct_url: item.code_of_conduct_url ?? '',
          rules_url: item.rules_url ?? '',
          privacy_policy_url: item.privacy_policy_url ?? '',
        }
        if (!cancelled) setInitial(init)
      } catch (error: unknown) {
        if (!cancelled) {
          const message = error instanceof Error && error.message ? error.message : t('competitions.form.error.load', 'Failed to load competition')
          setErr(message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, t])

  const fallbackInitialValues = React.useMemo<CompetitionFormValues>(() => ({
    id: id ?? '',
    name: '',
    slug: '',
    description: '',
    location: '',
    starts_at: '',
    ends_at: '',
    timezone: 'Europe/Warsaw',
    code_of_conduct_url: '',
    rules_url: '',
    privacy_policy_url: '',
  }), [id])

  if (!id) return null

  return (
    <Page>
      <PageBody>
        {err ? (
          <div className="text-red-600">{err}</div>
        ) : (
          <CrudForm<CompetitionFormValues>
            title={t('competitions.form.edit.title', 'Edit competition')}
            backHref="/backend/competitions"
            fields={baseFields}
            groups={groups}
            initialValues={initial ?? fallbackInitialValues}
            submitLabel={t('competitions.form.edit.submit', 'Save competition')}
            cancelHref="/backend/competitions"
            successRedirect={successRedirect}
            isLoading={loading}
            loadingMessage={t('competitions.form.loading', 'Loading competition...')}
            onSubmit={async (vals) => { await updateCrud('competitions/competitions', vals) }}
            onDelete={async () => {
              if (!id) return

              try {
                await deleteCrud('competitions/competitions', String(id))
                pushWithFlash(router, '/backend/competitions', t('competitions.flash.deleted', 'Competition deleted'), 'success')
              } catch (error) {
                const message =
                  error instanceof Error && error.message ? error.message : t('competitions.table.error.delete', 'Failed to delete competition')
                setErr(message)
              }
            }}
          />
        )}
      </PageBody>
    </Page>
  )
}
