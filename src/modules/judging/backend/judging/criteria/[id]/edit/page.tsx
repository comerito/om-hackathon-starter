"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { TrackCombobox } from '../../../../../components/TrackCombobox'

async function loadCompetitions(query?: string) {
  const params: Record<string, string> = { pageSize: '20' }
  if (query) params.name = query
  const res = await fetchCrudList<{ id: string; name: string }>('competitions/competitions', params)
  return (res?.items ?? []).map((c) => ({ value: c.id, label: c.name }))
}

type CriterionFormValues = {
  id: string
  competition_id: string
  track_id: string
  name: string
  description: string
  max_score: number
  weight: number
  round: string
  order: number
}

export default function EditCriterionPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<CriterionFormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'competition_id', label: t('judging.fields.competition', 'Competition'), type: 'combobox', required: true, loadOptions: loadCompetitions },
    {
      id: 'track_id',
      label: t('judging.fields.track', 'Track (optional)'),
      type: 'custom',
      component: (props) => (
        <TrackCombobox
          value={(props.value as string) ?? ''}
          competitionId={(props.values?.competition_id as string) ?? ''}
          onChange={props.setValue}
        />
      ),
    },
    { id: 'name', label: t('judging.fields.name', 'Criterion Name'), type: 'text', required: true },
    { id: 'description', label: t('judging.fields.description', 'Description'), type: 'textarea' },
    { id: 'max_score', label: t('judging.fields.maxScore', 'Max Score'), type: 'number', defaultValue: 10 },
    { id: 'weight', label: t('judging.fields.weight', 'Weight (0-1)'), type: 'number', defaultValue: 0.25, placeholder: '0.25 = 25%' },
    { id: 'round', label: t('judging.fields.round', 'Applicable Round'), type: 'select', defaultValue: 'both',
      options: [{ value: 'both', label: 'Both rounds' }, { value: 'preliminary', label: 'Preliminary only' }, { value: 'final', label: 'Final only' }] },
    { id: 'order', label: t('judging.fields.order', 'Display Order'), type: 'number', defaultValue: 0 },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('judging.groups.criterion', 'Criterion Details'), column: 1, fields: ['competition_id', 'track_id', 'name', 'description'] },
    { id: 'scoring', title: t('judging.groups.scoring', 'Scoring'), column: 2, fields: ['max_score', 'weight', 'round', 'order'] },
  ], [t])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      setLoading(true)
      setErr(null)
      try {
        const data = await fetchCrudList<Record<string, unknown>>('judging/criteria', { id, pageSize: '1' })
        const item = data?.items?.[0]
        if (!item) throw new Error('Criterion not found')
        if (!cancelled) {
          setInitial({
            id: String(item.id),
            competition_id: String(item.competition_id ?? ''),
            track_id: String(item.track_id ?? ''),
            name: String(item.name ?? ''),
            description: String(item.description ?? ''),
            max_score: Number(item.max_score ?? 10),
            weight: Number(item.weight ?? 0.25),
            round: String(item.round ?? 'both'),
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

  const fallback = React.useMemo<CriterionFormValues>(() => ({
    id: id ?? '', competition_id: '', track_id: '', name: '', description: '',
    max_score: 10, weight: 0.25, round: 'both', order: 0,
  }), [id])

  if (!id) return null

  return (
    <Page>
      <PageBody>
        {err ? (
          <div className="text-red-600">{err}</div>
        ) : (
          <CrudForm<CriterionFormValues>
            title={t('judging.criteria.edit.title', 'Edit Judging Criterion')}
            backHref="/backend/judging"
            entityId="judging:judging_criterion"
            fields={fields}
            groups={groups}
            initialValues={initial ?? fallback}
            submitLabel={t('judging.criteria.edit.submit', 'Save')}
            cancelHref="/backend/judging"
            successRedirect={`/backend/judging?flash=${encodeURIComponent(t('judging.flash.criterionSaved', 'Criterion saved'))}&type=success`}
            isLoading={loading}
            loadingMessage={t('judging.criteria.edit.loading', 'Loading criterion...')}
            onSubmit={async (vals) => {
              const payload = { ...vals, track_id: vals.track_id || null }
              await updateCrud('judging/criteria', payload)
            }}
            onDelete={async () => {
              if (!id) return
              try {
                await deleteCrud('judging/criteria', String(id))
                pushWithFlash(router, '/backend/judging', t('judging.flash.criterionDeleted', 'Criterion deleted'), 'success')
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
