"use client"
import * as React from 'react'
import { usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MarkdownContent } from '@open-mercato/ui/backend/markdown/MarkdownContent'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type ParticipationStatus = {
  cocAccepted: boolean
  privacyPolicyAccepted: boolean
  cocUrl: string | null
  cocHasContent: boolean
  privacyPolicyUrl: string | null
  privacyPolicyHasContent: boolean
  competitionName: string | null
}

type LegalDocumentKey = 'code_of_conduct' | 'privacy_policy'

type LegalDocumentResponse = {
  competition_name: string | null
  document: LegalDocumentKey
  content: string | null
  external_url: string | null
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

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
    </svg>
  )
}

function ExternalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
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
      className={`relative shrink-0 mt-0.5 h-5 w-5 rounded-md border-2 transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/40 focus-visible:ring-offset-2 ${
        checked
          ? 'border-portal-primary bg-portal-primary shadow-[0_0_0_3px_rgba(79,70,229,0.1)]'
          : 'border-gray-300 dark:border-slate-500 bg-transparent'
      }`}
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

/**
 * Reads a legal document inside the modal. Navigating to the standalone
 * /portal/legal page is not an option here: that page lives under the same
 * provider that renders this gate, so it would render *behind* the backdrop.
 */
function DocumentReader({
  competitionId,
  document,
  title,
  onBack,
}: {
  competitionId: string
  document: LegalDocumentKey
  title: string
  onBack: () => void
}) {
  const t = useT()
  const { data, isLoading, error } = useQuery({
    queryKey: ['portal-legal-document', competitionId, document],
    queryFn: async () => {
      const { ok, result } = await apiCall<LegalDocumentResponse>(
        `/api/competitions/portal/legal-document?competition_id=${competitionId}&document=${document}`,
      )
      if (!ok || !result) throw new Error('Failed to load document')
      return result
    },
  })

  const emptyMessage = document === 'code_of_conduct'
    ? t('competitions.portal.legal.codeOfConduct.empty', 'No Code of Conduct content has been published yet.')
    : t('competitions.portal.legal.privacyPolicy.empty', 'No privacy policy content has been published yet.')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 dark:border-white/10 sm:px-8">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-portal-dark transition-colors hover:border-portal-primary hover:text-portal-primary dark:border-white/10 dark:text-white"
        >
          <BackIcon className="h-3.5 w-3.5" />
          {t('competitions.portal.terms.backToTerms', 'Back to terms')}
        </button>
        <h2 className="font-display truncate text-base font-bold tracking-tight text-portal-dark dark:text-white">
          {title}
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-white/10" />
            <div className="h-4 w-full animate-pulse rounded bg-gray-100 dark:bg-white/10" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-gray-100 dark:bg-white/10" />
          </div>
        ) : error || !data ? (
          <p className="text-sm text-portal-secondary">{emptyMessage}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {data.content ? (
              <MarkdownContent
                body={data.content}
                format="markdown"
                className="prose prose-sm max-w-none text-muted-foreground dark:prose-invert prose-headings:text-foreground prose-strong:text-foreground prose-a:text-portal-primary [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              />
            ) : (
              <p className="text-sm text-portal-secondary">{emptyMessage}</p>
            )}
            {data.external_url && (
              <a
                href={data.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-portal-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-portal-primary-light"
              >
                {t('competitions.portal.legal.openExternal', 'Open external document')}
                <ExternalIcon />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function AcceptTermsGate({ children, selectedId }: { children: React.ReactNode; selectedId: string | null }) {
  const t = useT()
  const queryClient = useQueryClient()
  const pathname = usePathname()
  const [cocChecked, setCocChecked] = React.useState(false)
  const [privacyChecked, setPrivacyChecked] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [reading, setReading] = React.useState<LegalDocumentKey | null>(null)

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

  // The standalone legal pages must stay reachable even before acceptance —
  // gating them would hide the very documents the user has to read.
  const isLegalPage = !!pathname && /\/portal\/legal(\/|$)/.test(pathname)

  if (!selectedId || isLoading || !data || isLegalPage) return <>{children}</>
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
  const cocTitle = t('competitions.portal.terms.coc', 'Code of Conduct')
  const privacyTitle = t('competitions.portal.terms.privacy', 'Privacy Policy')

  // With content we open an in-modal reader; with only an external URL there is
  // nothing to render, so link straight out to it in a new tab.
  function renderDocumentTrigger(document: LegalDocumentKey, hasContent: boolean, externalUrl: string | null) {
    if (!hasContent && !externalUrl) return null
    const className = 'mt-2 inline-flex items-center gap-1 text-xs font-semibold text-portal-primary transition-colors hover:text-portal-primary-light'
    if (!hasContent && externalUrl) {
      return (
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={className}
        >
          {t('competitions.portal.terms.readDocument', 'Read the full document')}
          <ExternalIcon className="h-3 w-3" />
        </a>
      )
    }
    return (
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setReading(document) }}
        className={className}
      >
        {t('competitions.portal.terms.readDocument', 'Read the full document')}
        <ArrowIcon className="h-3 w-3" />
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-portal-dark/60 backdrop-blur-md" style={{ animation: 'fadeIn 300ms ease-out' }} />

      {/* Card */}
      <div
        className={`relative z-10 mx-auto flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800 ${reading ? 'max-w-[720px]' : 'max-w-[480px]'}`}
        style={{ animation: 'slideUp 400ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Top accent strip */}
        <div className="h-1 shrink-0 bg-gradient-to-r from-portal-primary via-portal-primary-light to-portal-primary" />

        {reading ? (
          <DocumentReader
            competitionId={selectedId}
            document={reading}
            title={reading === 'code_of_conduct' ? cocTitle : privacyTitle}
            onBack={() => setReading(null)}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {/* Header area */}
            <div className="px-8 pt-8 pb-2">
              <div className="mb-5 flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-portal-primary/10"
                >
                  <ShieldIcon className="text-portal-primary" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight text-portal-dark dark:text-white">
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
                  className={`group flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all duration-200 ${
                    cocChecked
                      ? 'border-portal-primary bg-portal-primary/5'
                      : 'border-gray-200 dark:border-slate-600 bg-transparent'
                  }`}
                >
                  <CustomCheckbox checked={cocChecked} onChange={setCocChecked} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-portal-dark dark:text-white">{cocTitle}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-portal-secondary">
                      {t('competitions.portal.terms.cocDesc', 'I have read and agree to follow the Code of Conduct.')}
                    </p>
                    {renderDocumentTrigger('code_of_conduct', data.cocHasContent, data.cocUrl)}
                  </div>
                </label>
              )}

              {needsPrivacy && (
                <label
                  className={`group flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all duration-200 ${
                    privacyChecked
                      ? 'border-portal-primary bg-portal-primary/5'
                      : 'border-gray-200 dark:border-slate-600 bg-transparent'
                  }`}
                >
                  <CustomCheckbox checked={privacyChecked} onChange={setPrivacyChecked} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <LockIcon className="h-4 w-4 text-portal-secondary" />
                      <span className="text-sm font-semibold text-portal-dark dark:text-white">{privacyTitle}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-portal-secondary">
                      {t('competitions.portal.terms.privacyDesc', 'I have read and agree to the Privacy Policy (GDPR/RODO).')}
                    </p>
                    {renderDocumentTrigger('privacy_policy', data.privacyPolicyHasContent, data.privacyPolicyUrl)}
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
                className={`group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-3.5 text-sm font-bold shadow-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed ${
                  allChecked
                    ? 'bg-gradient-to-br from-portal-primary to-portal-primary-light text-white shadow-[0_4px_14px_rgba(79,70,229,0.35)]'
                    : 'bg-gray-300 dark:bg-slate-600 text-white/70 dark:text-slate-400'
                } ${submitting ? 'scale-[0.98]' : 'scale-100'}`}
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
                {t('competitions.portal.terms.footnote', 'By continuing you agree to our terms of participation')}
              </p>
            </div>
          </div>
        )}
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
