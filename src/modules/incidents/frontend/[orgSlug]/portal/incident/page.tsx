"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components/PortalCard'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { CompetitionProvider, useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { CompetitionSelector } from '../../../../../competitions/components/CompetitionSelector'

function IncidentReportContent() {
  const t = useT()
  const { selectedId: competitionId } = useCompetitionContext()
  const [description, setDescription] = React.useState('')
  const [severity, setSeverity] = React.useState('low')
  const [reportedUserId, setReportedUserId] = React.useState('')
  const [anonymous, setAnonymous] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const [showConfirm, setShowConfirm] = React.useState(false)

  async function handleSubmit() {
    if (!competitionId || !description.trim()) return
    setSubmitting(true)
    try {
      const { ok, result } = await apiCall<{ ok: boolean; error?: string }>('/api/incidents/portal/report-incident', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          competition_id: competitionId,
          description: description.trim(),
          severity,
          reported_user_id: reportedUserId.trim() || null,
          anonymous,
        }),
      })
      if (ok) {
        flash(t('incidents.portal.submitted', 'Incident reported. Thank you.'), 'success')
        setSubmitted(true)
      } else {
        flash(result?.error ?? 'Failed to submit', 'error')
      }
    } finally {
      setSubmitting(false)
      setShowConfirm(false)
    }
  }

  if (submitted) {
    return (
      <PortalCard>
        <div className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
          </div>
          <h3 className="text-lg font-semibold">{t('incidents.portal.thankYou', 'Report Submitted')}</h3>
          <p className="text-sm text-muted-foreground">{t('incidents.portal.thankYouDesc', 'Your report has been received and will be reviewed by the organizers. Thank you for helping maintain a safe environment.')}</p>
          <Button variant="outline" onClick={() => { setSubmitted(false); setDescription(''); setSeverity('low'); setReportedUserId(''); setAnonymous(false) }}>
            {t('incidents.portal.submitAnother', 'Submit Another Report')}
          </Button>
        </div>
      </PortalCard>
    )
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 shrink-0 mt-0.5">
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-800">{t('incidents.portal.infoTitle', 'Safe & Confidential')}</p>
            <p className="text-xs text-blue-700 mt-1">{t('incidents.portal.infoDesc', 'All reports are treated confidentially. You can choose to report anonymously. The organizers will review and take appropriate action.')}</p>
          </div>
        </div>
      </div>

      <PortalCard>
        <PortalCardHeader title={t('incidents.portal.formTitle', 'Report an Incident')} />
        <div className="p-6 space-y-5">
          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('incidents.fields.description', 'What happened?')} *</label>
            <textarea
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('incidents.portal.descPlaceholder', 'Describe the incident in detail. Include when and where it happened.')}
            />
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('incidents.fields.severity', 'Severity')}</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'low', label: 'Low', desc: 'Minor concern', color: 'border-gray-300 text-gray-700' },
                { value: 'medium', label: 'Medium', desc: 'Needs attention', color: 'border-yellow-400 text-yellow-700' },
                { value: 'high', label: 'High', desc: 'Serious violation', color: 'border-orange-400 text-orange-700' },
                { value: 'critical', label: 'Critical', desc: 'Immediate danger', color: 'border-red-500 text-red-700' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSeverity(opt.value)}
                  className={`rounded-lg border-2 px-4 py-2 text-left transition-all ${
                    severity === opt.value ? `${opt.color} bg-background ring-2 ring-offset-1 ring-current` : 'border-input text-muted-foreground hover:border-foreground/30'
                  }`}
                >
                  <span className="text-sm font-medium block">{opt.label}</span>
                  <span className="text-xs opacity-70">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Reported user (optional) */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('incidents.fields.reportedUser', 'Person involved (optional)')}</label>
            <Input
              value={reportedUserId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReportedUserId(e.target.value)}
              placeholder={t('incidents.portal.userPlaceholder', 'Name or email of the person (if applicable)')}
            />
          </div>

          {/* Anonymous toggle */}
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
            <button
              type="button"
              role="switch"
              aria-checked={anonymous}
              onClick={() => setAnonymous(!anonymous)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${anonymous ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${anonymous ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <div>
              <span className="text-sm font-medium">{t('incidents.portal.anonymous', 'Report anonymously')}</span>
              <p className="text-xs text-muted-foreground">{t('incidents.portal.anonymousDesc', 'Your identity will not be linked to this report.')}</p>
            </div>
          </div>
        </div>
      </PortalCard>

      {/* Submit */}
      <div className="rounded-lg border bg-card p-6">
        {!showConfirm ? (
          <Button
            onClick={() => setShowConfirm(true)}
            disabled={!description.trim() || !competitionId}
            className="w-full sm:w-auto"
          >
            {t('incidents.portal.submitBtn', 'Submit Report')}
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('incidents.portal.confirmMsg', 'Are you sure you want to submit this incident report?')}
              {anonymous && ` ${t('incidents.portal.confirmAnon', 'This report will be anonymous.')}`}
            </p>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? t('common.submitting', 'Submitting...') : t('incidents.portal.confirmSubmit', 'Yes, Submit')}
              </Button>
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function IncidentReportPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <CompetitionProvider>
      <CompetitionSelector />
      <div className="flex flex-col gap-6">
        <PortalPageHeader title={t('incidents.portal.title', 'Report Incident')} label={t('incidents.portal.label', 'Code of Conduct')} />
        <IncidentReportContent />
      </div>
    </CompetitionProvider>
  )
}
