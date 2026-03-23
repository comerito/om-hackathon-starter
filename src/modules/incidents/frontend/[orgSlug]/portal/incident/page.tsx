"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { PortalCompetitionLayout } from '../../../../../competitions/components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { cn } from '@open-mercato/shared/lib/utils'
import { Shield, Lock } from 'lucide-react'
import { ToggleSwitch } from '@/components/portal'

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low', desc: 'Minor disruption or inconvenience.', color: 'bg-gray-400' },
  { value: 'medium', label: 'Medium', desc: 'Significant concern needing review.', color: 'bg-yellow-400' },
  { value: 'high', label: 'High', desc: 'Immediate action required.', color: 'bg-orange-400' },
  { value: 'critical', label: 'Critical', desc: 'Severe safety or security breach.', color: 'bg-red-500' },
]

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
      <div className="rounded-xl border border-gray-100 bg-white p-8 text-center space-y-4">
        <div className="flex justify-center">
          <div className="size-16 rounded-full bg-green-50 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
        </div>
        <h3 className="text-lg font-bold text-foreground">Report Submitted</h3>
        <p className="text-sm text-portal-secondary max-w-md mx-auto">
          Your report has been received and will be reviewed by the organizers. Thank you for helping maintain a safe environment.
        </p>
        <Button
          variant="outline"
          onClick={() => { setSubmitted(false); setDescription(''); setSeverity('low'); setReportedUserId(''); setAnonymous(false) }}
        >
          Submit Another Report
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Safe & Confidential Banner */}
      <div className="rounded-xl bg-portal-primary/5 border border-portal-primary/10 p-4 flex items-start gap-3">
        <div className="size-10 rounded-full bg-portal-primary/10 flex items-center justify-center shrink-0">
          <Shield className="size-5 text-portal-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Safe & Confidential</p>
          <p className="text-xs text-portal-secondary mt-0.5">
            Your report is encrypted and handled with extreme care by our safety committee. Your well-being and privacy are our absolute priority.
          </p>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Incident Report</h2>
          <p className="text-sm text-portal-secondary mt-1">
            Provide as much detail as possible. This information helps us maintain a professional, inclusive, and safe environment for all hackathon participants.
          </p>
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-widest text-foreground">
              What Happened? <span className="text-portal-danger">*</span>
            </label>
            <span className="text-[10px] font-medium uppercase tracking-wide text-portal-secondary">Required</span>
          </div>
          <textarea
            className="flex min-h-[160px] w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm placeholder:text-gray-400 focus:border-portal-primary focus:outline-none focus:ring-1 focus:ring-portal-primary/30 resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the incident in detail... Include dates, times, and specific actions."
          />
        </div>

        {/* Severity Level */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-foreground mb-3">
            Severity Level
          </label>
          <div className="grid grid-cols-4 gap-3">
            {SEVERITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSeverity(opt.value)}
                className={cn(
                  'rounded-xl border-2 p-3 text-left transition-all',
                  severity === opt.value
                    ? 'border-portal-primary bg-portal-primary/5'
                    : 'border-gray-100 bg-white hover:border-gray-200',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn('size-2.5 rounded-full', opt.color)} />
                  <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                </div>
                <p className="text-[11px] text-portal-secondary leading-snug">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Reported Person + Privacy row */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-foreground mb-2">
              Reported Person (Optional)
            </label>
            <input
              type="text"
              value={reportedUserId}
              onChange={(e) => setReportedUserId(e.target.value)}
              placeholder="Full name or User ID"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm placeholder:text-gray-400 focus:border-portal-primary focus:outline-none focus:ring-1 focus:ring-portal-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-foreground mb-2">
              Privacy Preference
            </label>
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">Report Anonymously</p>
                <p className="text-[11px] text-portal-secondary">Your name will not be shared with the reported party.</p>
              </div>
              <ToggleSwitch checked={anonymous} onChange={setAnonymous} />
            </div>
          </div>
        </div>
      </div>

      {/* Submit */}
      {!showConfirm ? (
        <div>
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={!description.trim() || !competitionId}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-colors',
              description.trim() && competitionId
                ? 'bg-portal-primary text-white hover:bg-portal-primary-light'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed',
            )}
          >
            <Lock className="size-4" />
            Submit Confidential Report
          </button>
          {!description.trim() && (
            <p className="mt-2 text-center text-[11px] font-medium uppercase tracking-widest text-portal-secondary">
              Description is required to submit
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white p-6 space-y-4">
          <h3 className="text-lg font-bold text-foreground">Final Confirmation</h3>
          <p className="text-xs text-portal-secondary uppercase tracking-wide">Step 2 of 2: Submission Intent</p>
          <div className="rounded-lg bg-portal-primary/5 border border-portal-primary/10 p-4">
            <p className="text-sm text-foreground">
              <strong>Your report will be submitted to the safety committee.</strong>
              {anonymous && ' This report will be filed anonymously.'}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-portal-primary py-3 text-sm font-semibold text-white hover:bg-portal-primary-light transition-colors disabled:opacity-50"
            >
              <Lock className="size-4" />
              {submitting ? 'Submitting...' : 'Submit Confidential Report'}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="text-sm text-portal-secondary hover:text-foreground transition-colors"
            >
              Return to Edit
            </button>
          </div>
        </div>
      )}
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
    <PortalCompetitionLayout>
      <IncidentReportContent />
    </PortalCompetitionLayout>
  )
}
