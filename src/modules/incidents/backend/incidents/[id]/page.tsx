"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IncidentRow = {
  id: string
  competition_id: string
  reporter_id: string | null
  reported_user_id: string | null
  description: string
  severity: string
  status: string
  admin_notes: string | null
  resolved_by: string | null
  resolution_description: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const STATUS_COLORS: Record<string, string> = {
  REPORTED: 'bg-blue-100 text-blue-800',
  UNDER_REVIEW: 'bg-purple-100 text-purple-800',
  RESOLVED: 'bg-green-100 text-green-800',
  DISMISSED: 'bg-gray-100 text-gray-600',
}

function Badge({ label, colors }: { label: string; colors: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors}`}>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IncidentDetailPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const incidentId = params.id as string
  const competitionId = searchParams.get('competitionId') ?? ''

  // Fetch the incident
  const { data, isLoading, error } = useQuery({
    queryKey: ['incident-detail', incidentId],
    queryFn: async () => {
      const res = await fetchCrudList<IncidentRow>('incidents/incidents', { id: incidentId, pageSize: '1' })
      return res?.items?.[0] ?? null
    },
    enabled: !!incidentId,
  })

  // Admin notes editing
  const [editingNotes, setEditingNotes] = React.useState(false)
  const [adminNotes, setAdminNotes] = React.useState('')
  const [savingNotes, setSavingNotes] = React.useState(false)

  React.useEffect(() => {
    if (data?.admin_notes) setAdminNotes(data.admin_notes)
  }, [data?.admin_notes])

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    try {
      await apiCall('/api/incidents/incidents', {
        method: 'PUT',
        body: JSON.stringify({ id: incidentId, adminNotes }),
      })
      flash(t('incidents.detail.notesSaved', 'Notes saved'), 'success')
      setEditingNotes(false)
      queryClient.invalidateQueries({ queryKey: ['incident-detail'] })
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to save notes', 'error')
    } finally {
      setSavingNotes(false)
    }
  }

  // Resolve
  const [showResolve, setShowResolve] = React.useState(false)
  const [resolutionDesc, setResolutionDesc] = React.useState('')
  const [resolveStatus, setResolveStatus] = React.useState<'RESOLVED' | 'DISMISSED'>('RESOLVED')
  const [resolving, setResolving] = React.useState(false)

  const handleResolve = async () => {
    if (!resolutionDesc.trim()) return
    setResolving(true)
    try {
      await apiCall('/api/incidents/incidents/resolve', {
        method: 'POST',
        body: JSON.stringify({
          id: incidentId,
          resolutionDescription: resolutionDesc.trim(),
          status: resolveStatus,
        }),
      })
      flash(t('incidents.detail.resolved', 'Incident resolved'), 'success')
      setShowResolve(false)
      queryClient.invalidateQueries({ queryKey: ['incident-detail'] })
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to resolve', 'error')
    } finally {
      setResolving(false)
    }
  }

  // Status update
  const handleStatusChange = async (newStatus: string) => {
    try {
      await apiCall('/api/incidents/incidents', {
        method: 'PUT',
        body: JSON.stringify({ id: incidentId, status: newStatus }),
      })
      flash('Status updated', 'success')
      queryClient.invalidateQueries({ queryKey: ['incident-detail'] })
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to update status', 'error')
    }
  }

  if (isLoading) {
    return (
      <Page>
        <PageBody>
          <div className="flex items-center justify-center py-20">
            <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
          </div>
        </PageBody>
      </Page>
    )
  }

  if (error || !data) {
    return (
      <Page>
        <PageBody>
          <h1 className="text-2xl font-bold">{t('incidents.detail.notFound', 'Incident Not Found')}</h1>
          <p className="text-muted-foreground mt-2">The incident report could not be found.</p>
        </PageBody>
      </Page>
    )
  }

  const isOpen = data.status === 'REPORTED' || data.status === 'UNDER_REVIEW'
  const backUrl = `/backend/incidents${competitionId ? `?competitionId=${competitionId}` : ''}`

  return (
    <Page>
      <PageBody>
        <div className="flex items-start justify-between mb-6">
          <div>
            <Link href={backUrl} className="text-sm text-muted-foreground hover:underline">
              {t('incidents.detail.back', 'Back to Incidents')}
            </Link>
            <h1 className="text-2xl font-bold mt-1">
              {t('incidents.detail.title', 'Incident Detail')}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge label={data.severity} colors={SEVERITY_COLORS[data.severity] ?? ''} />
              <Badge
                label={data.status === 'UNDER_REVIEW' ? 'Under Review' : data.status}
                colors={STATUS_COLORS[data.status] ?? ''}
              />
            </div>
          </div>
          {isOpen && (
            <div className="flex items-center gap-2">
              {data.status === 'REPORTED' && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('UNDER_REVIEW')}>
                  {t('incidents.detail.markReview', 'Mark Under Review')}
                </Button>
              )}
              <Button size="sm" onClick={() => setShowResolve(true)}>
                {t('incidents.detail.resolve', 'Resolve')}
              </Button>
            </div>
          )}
        </div>

        {/* Main content grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Description */}
          <div className="rounded-lg border p-5">
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">
              {t('incidents.detail.description', 'Description')}
            </h2>
            <p className="text-sm whitespace-pre-wrap">{data.description}</p>
          </div>

          {/* Metadata */}
          <div className="rounded-lg border p-5">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">
              {t('incidents.detail.metadata', 'Details')}
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Incident ID</dt>
                <dd className="font-mono text-xs">{data.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Reporter</dt>
                <dd>{data.reporter_id ? <span className="font-mono text-xs">{data.reporter_id.slice(0, 12)}...</span> : <span className="italic">Anonymous</span>}</dd>
              </div>
              {data.reported_user_id && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Reported User</dt>
                  <dd className="font-mono text-xs">{data.reported_user_id.slice(0, 12)}...</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Competition</dt>
                <dd className="font-mono text-xs">{data.competition_id.slice(0, 12)}...</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Reported At</dt>
                <dd>{new Date(data.created_at).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Last Updated</dt>
                <dd>{new Date(data.updated_at).toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          {/* Admin Notes */}
          <div className="rounded-lg border p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {t('incidents.detail.adminNotes', 'Admin Notes')}
              </h2>
              {!editingNotes && (
                <Button size="sm" variant="ghost" onClick={() => setEditingNotes(true)}>
                  {t('incidents.detail.editNotes', 'Edit')}
                </Button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm min-h-[100px]"
                  placeholder="Internal notes about this incident..."
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes}>
                    {savingNotes ? 'Saving...' : 'Save'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditingNotes(false); setAdminNotes(data.admin_notes ?? '') }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {data.admin_notes || 'No notes yet.'}
              </p>
            )}
          </div>

          {/* Resolution */}
          <div className="rounded-lg border p-5">
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">
              {t('incidents.detail.resolution', 'Resolution')}
            </h2>
            {data.resolved_at ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd><Badge label={data.status} colors={STATUS_COLORS[data.status] ?? ''} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Resolved By</dt>
                  <dd className="font-mono text-xs">{data.resolved_by?.slice(0, 12)}...</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Resolved At</dt>
                  <dd>{new Date(data.resolved_at).toLocaleString()}</dd>
                </div>
                {data.resolution_description && (
                  <div>
                    <dt className="text-muted-foreground mb-1">Description</dt>
                    <dd className="whitespace-pre-wrap">{data.resolution_description}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground italic">Not yet resolved.</p>
            )}
          </div>
        </div>

        {/* Resolve dialog */}
        {showResolve && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background rounded-lg border p-6 w-full max-w-md shadow-lg">
              <h2 className="text-lg font-semibold mb-4">
                {t('incidents.resolve.title', 'Resolve Incident')}
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Resolution Status</label>
                  <select
                    value={resolveStatus}
                    onChange={(e) => setResolveStatus(e.target.value as 'RESOLVED' | 'DISMISSED')}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="RESOLVED">Resolved</option>
                    <option value="DISMISSED">Dismissed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Resolution Description *</label>
                  <textarea
                    value={resolutionDesc}
                    onChange={(e) => setResolutionDesc(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm min-h-[100px]"
                    placeholder="Describe the resolution or reason for dismissal..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowResolve(false)}>Cancel</Button>
                <Button onClick={handleResolve} disabled={resolving || !resolutionDesc.trim()}>
                  {resolving ? 'Saving...' : 'Submit Resolution'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </PageBody>
    </Page>
  )
}
