"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { InfoCardIconPicker } from '../../../../../components/InfoCardIconPicker'

type CompetitionInfoCardFormValues = {
  id: string
  competition_id: string
  key: string
  icon: string
  label: string
  value: string
  sort_order: number
}

export default function EditCompetitionInfoCardPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<CompetitionInfoCardFormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'key', label: t('competitions.infoCards.key', 'Key'), type: 'text', required: true },
    {
      id: 'icon',
      label: t('competitions.infoCards.icon', 'Icon'),
      type: 'custom',
      component: ({ value, setValue }) => (
        <InfoCardIconPicker value={String(value || '')} onChange={setValue} />
      ),
    },
    { id: 'label', label: t('competitions.infoCards.label', 'Label'), type: 'text', required: true },
    { id: 'value', label: t('competitions.infoCards.value', 'Value'), type: 'textarea', required: true },
    { id: 'sort_order', label: t('competitions.infoCards.sortOrder', 'Sort Order'), type: 'number' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('competitions.infoCards.groups.details', 'Details'), column: 1, fields: ['key', 'icon', 'sort_order'] },
    { id: 'content', title: t('competitions.infoCards.groups.content', 'Content'), column: 2, fields: ['label', 'value'] },
  ], [t])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      setLoading(true)
      setErr(null)
      try {
        const data = await fetchCrudList<Record<string, unknown>>('competitions/info-cards', { id, pageSize: '1' })
        const item = data?.items?.[0]
        if (!item) throw new Error(t('competitions.infoCards.error.notFound', 'Info card not found'))
        if (!cancelled) {
          setInitial({
            id: String(item.id),
            competition_id: String(item.competition_id ?? ''),
            key: String(item.key ?? ''),
            icon: String(item.icon ?? ''),
            label: String(item.label ?? ''),
            value: String(item.value ?? ''),
            sort_order: Number(item.sort_order ?? 0),
          })
        }
      } catch (error: unknown) {
        if (!cancelled) setErr(error instanceof Error ? error.message : t('competitions.infoCards.error.load', 'Failed to load info card'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, t])

  const fallback = React.useMemo<CompetitionInfoCardFormValues>(() => ({
    id: id ?? '',
    competition_id: '',
    key: '',
    icon: '',
    label: '',
    value: '',
    sort_order: 0,
  }), [id])

  if (!id) return null

  const backHref = initial?.competition_id
    ? `/backend/competitions/info-cards?competitionId=${encodeURIComponent(initial.competition_id)}`
    : '/backend/competitions/info-cards'

  return (
    <Page>
      <PageBody>
        {err ? (
          <div className="text-red-600">{err}</div>
        ) : (
          <CrudForm<CompetitionInfoCardFormValues>
            title={t('competitions.infoCards.editTitle', 'Edit Competition Info Card')}
            backHref={backHref}
            entityId="competitions:competition_info_card"
            fields={fields}
            groups={groups}
            initialValues={initial ?? fallback}
            submitLabel={t('competitions.infoCards.editSubmit', 'Save')}
            cancelHref={backHref}
            successRedirect={`${backHref}${backHref.includes('?') ? '&' : '?'}flash=${encodeURIComponent(t('competitions.infoCards.flash.saved', 'Info card saved'))}&type=success`}
            isLoading={loading}
            loadingMessage={t('competitions.infoCards.editLoading', 'Loading info card...')}
            onSubmit={async (vals) => { await updateCrud('competitions/info-cards', vals) }}
            onDelete={async () => {
              if (!id) return
              try {
                await deleteCrud('competitions/info-cards', String(id))
                pushWithFlash(router, backHref, t('competitions.infoCards.flash.deleted', 'Info card deleted'), 'success')
              } catch (error) {
                setErr(error instanceof Error ? error.message : t('competitions.infoCards.error.delete', 'Delete failed'))
              }
            }}
          />
        )}
      </PageBody>
    </Page>
  )
}
