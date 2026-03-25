"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type ParticipationStatus = {
  cocAccepted: boolean
  privacyPolicyAccepted: boolean
  cocUrl: string | null
  privacyPolicyUrl: string | null
  competitionName: string | null
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  )
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6.5L4.5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  )
}

function CustomCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative shrink-0 mt-0.5 h-5 w-5 rounded-md border-2 transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/40 focus-visible:ring-offset-2"
      style={{
        borderColor: checked ? 'var(--portal-primary)' : '#D1D5DB',
        backgroundColor: checked ? 'var(--portal-primary)' : 'transparent',
        boxShadow: checked ? '0 0 0 3px rgba(79, 70, 229, 0.1)' : 'none',
      }}
    >
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-200"
        style={{ opacity: checked ? 1 : 0, transform: checked ? 'scale(1)' : 'scale(0.5)' }}
      >
        <CheckIcon />
      </span>
    </button>
  )
}

export function AcceptTermsGate({ children, selectedId }: { children: React.ReactNode; selectedId: string | null }) {
  const t = useT()
  const queryClient = useQueryClient()
  const [cocChecked, setCocChecked] = React.useState(false)
  const [privacyChecked, setPrivacyChecked] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['portal-my-participation', selectedId],
    queryFn: async () => {
      if (!selectedId) return null
      const { ok, result } = await apiCall<ParticipationStatus>(
        `/api/competitions/portal/my-participation?competition_id=${selectedId}`,
      )
      return ok ? result : null
    },
    enabled: !!selectedId,
  })

  if (!selectedId || isLoading || !data) return <>{children}</>
  if (data.cocAccepted && data.privacyPolicyAccepted) return <>{children}</>

  async function handleAccept() {
    if (!selectedId) return
    setSubmitting(true)
    try {
      await apiCall('/api/competitions/portal/accept-terms', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          competition_id: selectedId,
          accept_coc: cocChecked,
          accept_privacy: privacyChecked,
        }),
      })
      queryClient.invalidateQueries({ queryKey: ['portal-my-participation'] })
    } finally {
      setSubmitting(false)
    }
  }

  const needsCoc = !data.cocAccepted
  const needsPrivacy = !data.privacyPolicyAccepted
  const allChecked = (!needsCoc || cocChecked) && (!needsPrivacy || privacyChecked)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-portal-dark/60 backdrop-blur-md" style={{ animation: 'fadeIn 300ms ease-out' }} />

      {/* Card */}
      <div
        className="relative z-10 mx-auto w-full max-w-[480px] overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ animation: 'slideUp 400ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Top accent strip */}
        <div className="h-1 bg-gradient-to-r from-portal-primary via-portal-primary-light to-portal-primary" />

        {/* Header area */}
        <div className="px-8 pt-8 pb-2">
          <div className="mb-5 flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(79, 70, 229, 0.08)' }}
            >
              <ShieldIcon className="text-portal-primary" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-portal-dark">
                {t('competitions.portal.terms.title', 'Accept Terms to Continue')}
              </h2>
            </div>
          </div>
          <p className="text-[13px] leading-relaxed text-portal-secondary">
            {data.competitionName
              ? t('competitions.portal.terms.subtitle', 'Before accessing {name}, please review and accept the following:', { name: data.competitionName })
              : t('competitions.portal.terms.subtitleGeneric', 'Please review and accept the following to continue:')}
          </p>
        </div>

        {/* Terms cards */}
        <div className="space-y-3 px-8 py-5">
          {needsCoc && (
            <label
              className="group flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all duration-200"
              style={{
                borderColor: cocChecked ? 'var(--portal-primary)' : '#E5E7EB',
                backgroundColor: cocChecked ? 'rgba(79, 70, 229, 0.03)' : 'transparent',
              }}
            >
              <CustomCheckbox checked={cocChecked} onChange={setCocChecked} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-portal-dark">{t('competitions.portal.terms.coc', 'Code of Conduct')}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-portal-secondary">
                  {t('competitions.portal.terms.cocDesc', 'I have read and agree to follow the Code of Conduct.')}
                </p>
                {data.cocUrl && (
                  <a
                    href={data.cocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-portal-primary transition-colors hover:text-portal-primary-light"
                  >
                    {t('competitions.portal.terms.readDocument', 'Read the full document')}
                    <ArrowIcon className="h-3 w-3" />
                  </a>
                )}
              </div>
            </label>
          )}

          {needsPrivacy && (
            <label
              className="group flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all duration-200"
              style={{
                borderColor: privacyChecked ? 'var(--portal-primary)' : '#E5E7EB',
                backgroundColor: privacyChecked ? 'rgba(79, 70, 229, 0.03)' : 'transparent',
              }}
            >
              <CustomCheckbox checked={privacyChecked} onChange={setPrivacyChecked} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <LockIcon className="h-4 w-4 text-portal-secondary" />
                  <span className="text-sm font-semibold text-portal-dark">{t('competitions.portal.terms.privacy', 'Privacy Policy')}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-portal-secondary">
                  {t('competitions.portal.terms.privacyDesc', 'I have read and agree to the Privacy Policy (GDPR/RODO).')}
                </p>
                {data.privacyPolicyUrl && (
                  <a
                    href={data.privacyPolicyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-portal-primary transition-colors hover:text-portal-primary-light"
                  >
                    {t('competitions.portal.terms.readDocument', 'Read the full document')}
                    <ArrowIcon className="h-3 w-3" />
                  </a>
                )}
              </div>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 pt-1">
          <button
            type="button"
            disabled={submitting || !allChecked}
            onClick={handleAccept}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-3.5 text-sm font-bold text-white shadow-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed"
            style={{
              background: allChecked
                ? 'linear-gradient(135deg, var(--portal-primary) 0%, var(--portal-primary-light) 100%)'
                : '#D1D5DB',
              boxShadow: allChecked ? '0 4px 14px rgba(79, 70, 229, 0.35)' : 'none',
              transform: submitting ? 'scale(0.98)' : 'scale(1)',
            }}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {t('common.saving', 'Saving...')}
              </span>
            ) : (
              <>
                {t('competitions.portal.terms.continue', 'Continue')}
                <ArrowIcon className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </>
            )}
          </button>

          <p className="mt-4 text-center text-[11px] text-portal-secondary/60">
            By continuing you agree to our terms of participation
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
