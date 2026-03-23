"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { fetchCrudList, updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type IncidentFormValues = {
  id: string; description: string; severity: string; status: string
  admin_notes: string; resolution_description: string
  reporter_id: string; reported_user_id: string
}

export default function EditIncidentPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<IncidentFormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'description', label: t('incidents.fields.description', 'Description'), type: 'textarea', disabled: true },
    { id: 'severity', label: t('incidents.fields.severity', 'Severity'), type: 'select',
      options: [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }] },
    { id: 'status', label: t('incidents.fields.status', 'Status'), type: 'select',
      options: [{ value: 'reported', label: 'Reported' }, { value: 'under_review', label: 'Under Review' }, { value: 'resolved', label: 'Resolved' }, { value: 'dismissed', label: 'Dismissed' }] },
    { id: 'admin_notes', label: t('incidents.fields.adminNotes', 'Admin Notes'), type: 'textarea' },
    { id: 'resolution_description', label: t('incidents.fields.resolution', 'Resolution Description'), type: 'textarea' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'report', title: t('incidents.groups.report', 'Report'), column: 1, fields: ['description', 'severity', 'status'] },
    { id: 'resolution', title: t('incidents.groups.resolution', 'Resolution'), column: 2, fields: ['admin_notes', 'resolution_description'] },
  ], [t])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      setLoading(true)
      try {
        const data = await fetchCrudList<Record<string, unknown>>('incidents/incidents', { id, pageSize: '1' })
        const item = data?.items?.[0]
        if (!item) throw new Error('Incident not found')
        if (!cancelled) {
          setInitial({
            id: String(item.id), description: String(item.description ?? ''),
            severity: String(item.severity ?? 'low'), status: String(item.status ?? 'reported'),
            admin_notes: String(item.admin_notes ?? ''), resolution_description: String(item.resolution_description ?? ''),
            reporter_id: String(item.reporter_id ?? 'Anonymous'),
            reported_user_id: String(item.reported_user_id ?? ''),
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

  const fallback = React.useMemo<IncidentFormValues>(() => ({
    id: id ?? '', description: '', severity: 'low', status: 'reported',
    admin_notes: '', resolution_description: '', reporter_id: '', reported_user_id: '',
  }), [id])

  if (!id) return null

  return (
    <Page>
      <PageBody>
        {err ? <div className="text-red-600">{err}</div> : (
          <CrudForm<IncidentFormValues>
            title={t('incidents.edit.title', 'Manage Incident')}
            backHref="/backend/incidents" entityId="incidents:incident_report"
            fields={fields} groups={groups}
            initialValues={initial ?? fallback}
            submitLabel={t('incidents.edit.submit', 'Save')}
            cancelHref="/backend/incidents"
            successRedirect={`/backend/incidents?flash=${encodeURIComponent(t('incidents.flash.saved', 'Incident updated'))}&type=success`}
            isLoading={loading}
            loadingMessage={t('incidents.edit.loading', 'Loading incident...')}
            onSubmit={async (vals) => { await updateCrud('incidents/incidents', vals) }}
          />
        )}
      </PageBody>
    </Page>
  )
}
