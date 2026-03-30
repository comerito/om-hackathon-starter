"use client"
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Zap, ArrowRight, Eye, EyeOff } from 'lucide-react'

type Props = { params: { orgSlug: string } }

type InviteInfo = {
  display_name: string | null
  email_masked: string
  competition_name: string | null
  role: string | null
  expires_at: string
}

export default function AcceptInvitePage({ params }: Props) {
  const t = useT()
  const orgSlug = params.orgSlug
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const roleLabels: Record<string, string> = {
    participant: t('competitions.portal.acceptInvite.role.participant', 'Participant'),
    mentor: t('competitions.portal.acceptInvite.role.mentor', 'Mentor'),
    judge: t('competitions.portal.acceptInvite.role.judge', 'Judge'),
  }

  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [infoError, setInfoError] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setInfoError(t('competitions.portal.acceptInvite.errors.noToken', 'No invitation token provided.'))
      setLoadingInfo(false)
      return
    }
    async function load() {
      // Logout any existing session so the invite starts fresh
      await apiCall('/api/customer_accounts/portal/logout', { method: 'POST' }).catch(() => {})

      const { ok, result } = await apiCall<InviteInfo>(
        `/api/competitions/portal/invite-info?token=${encodeURIComponent(token!)}`,
      )
      if (ok && result) {
        setInfo(result)
        if (result.display_name) setDisplayName(result.display_name)
      } else {
        setInfoError((result as any)?.error ?? t('competitions.portal.acceptInvite.errors.invalidOrExpired', 'This invitation link is invalid or has expired.'))
      }
      setLoadingInfo(false)
    }
    load()
  }, [token, t])

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      setError(null)

      if (password.length < 8) {
        setError(t('competitions.portal.acceptInvite.errors.passwordLength', 'Password must be at least 8 characters.'))
        return
      }
      if (password !== confirmPassword) {
        setError(t('competitions.portal.acceptInvite.errors.passwordMismatch', 'Passwords do not match.'))
        return
      }
      if (!displayName.trim()) {
        setError(t('competitions.portal.acceptInvite.errors.displayNameRequired', 'Display name is required.'))
        return
      }

      setSubmitting(true)
      try {
        const result = await apiCall<{ ok: boolean; error?: string; user?: { id: string } }>(
          '/api/customer_accounts/invitations/accept',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password, displayName: displayName.trim() }),
          },
        )

        if (result.ok && result.result?.user) {
          window.location.assign(`/${orgSlug}/portal/dashboard`)
          return
        }

        setError(result.result?.error || t('competitions.portal.acceptInvite.errors.acceptFailed', 'Failed to accept invitation. The link may have expired.'))
      } catch {
        setError(t('competitions.portal.acceptInvite.errors.generic', 'Something went wrong. Please try again.'))
      } finally {
        setSubmitting(false)
      }
    },
    [token, password, confirmPassword, displayName, orgSlug, t],
  )

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-portal-primary via-portal-primary to-portal-primary-light relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute -bottom-20 -left-20 size-80 rounded-full bg-white/5" />
        <div className="absolute -top-10 -right-10 size-60 rounded-full bg-white/5" />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="size-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Zap className="size-4" />
              </div>
              <span className="text-sm font-bold uppercase tracking-widest opacity-80">
                {t('competitions.portal.acceptInvite.badge', 'Hackathon Portal')}
              </span>
            </div>
          </div>

          <div>
            <h1 className="font-display text-5xl font-bold leading-tight">
              {t('competitions.portal.acceptInvite.hero.title', "You're Invited.")}
            </h1>
            <p className="mt-6 text-lg text-white/70 max-w-md leading-relaxed">
              {info?.competition_name
                ? t(
                  'competitions.portal.acceptInvite.hero.description.withCompetition',
                  'Join {competition} and be part of something extraordinary.',
                  { competition: info.competition_name },
                )
                : t('competitions.portal.acceptInvite.hero.description.fallback', 'Set up your account and join the hackathon.')}
            </p>
            {info?.role && (
              <div className="mt-8 flex items-center gap-3">
                <div className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-bold uppercase tracking-wider">
                  {roleLabels[info.role] ?? info.role}
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-white/30">
            {t(
              'competitions.portal.acceptInvite.footer',
              '© {year} Hackathon Portal. Powered by Open Mercato.',
              { year: new Date().getFullYear() },
            )}
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center bg-portal-bg px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="size-8 rounded-lg bg-portal-primary flex items-center justify-center">
              <Zap className="size-4 text-white" />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-portal-primary">
              {t('competitions.portal.acceptInvite.badge', 'Hackathon Portal')}
            </span>
          </div>

          {loadingInfo ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-portal-primary/20 border-t-portal-primary" />
              <p className="mt-4 text-sm text-portal-secondary">
                {t('competitions.portal.acceptInvite.loading', 'Validating your invitation...')}
              </p>
            </div>
          ) : infoError ? (
            <div className="text-center py-12">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-portal-danger/10">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-portal-danger">
                  <circle cx="12" cy="12" r="10" /><line x1="15" x2="9" y1="9" y2="15" /><line x1="9" x2="15" y1="9" y2="15" />
                </svg>
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                {t('competitions.portal.acceptInvite.invalidTitle', 'Invitation Invalid')}
              </h2>
              <p className="text-sm text-portal-secondary">{infoError}</p>
              <a
                href={`/${orgSlug}/portal/login`}
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-portal-primary hover:text-portal-primary-light transition-colors"
              >
                {t('competitions.portal.acceptInvite.goToLogin', 'Go to Login')} <ArrowRight className="size-4" />
              </a>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="font-display text-3xl font-bold text-foreground">
                  {t('competitions.portal.acceptInvite.title', 'Complete your account')}
                </h2>
                <p className="mt-2 text-sm text-portal-secondary">
                  {info?.competition_name && info?.role
                    ? t(
                      'competitions.portal.acceptInvite.description.withRole',
                      "You've been invited to {competition} as a {role}.",
                      { competition: info.competition_name, role: roleLabels[info.role] ?? info.role },
                    )
                    : t('competitions.portal.acceptInvite.description.fallback', 'Set up your password to get started.')}
                </p>
                {info?.email_masked && (
                  <p className="mt-1 text-xs text-portal-secondary/70">
                    {t('competitions.portal.acceptInvite.account', 'Account: {email}', { email: info.email_masked })}
                  </p>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="rounded-xl bg-portal-danger/5 border border-portal-danger/20 px-4 py-3 text-sm text-portal-danger">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="accept-name" className="block text-xs font-bold uppercase tracking-widest text-foreground mb-2">
                    {t('competitions.portal.acceptInvite.displayName.label', 'Display Name')}
                  </label>
                  <input
                    id="accept-name"
                    type="text"
                    required
                    placeholder={t('competitions.portal.acceptInvite.displayName.placeholder', 'Your name')}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={submitting}
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm text-foreground placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-portal-primary focus:outline-none focus:ring-2 focus:ring-portal-primary/20 disabled:opacity-50 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="accept-password" className="block text-xs font-bold uppercase tracking-widest text-foreground mb-2">
                    {t('competitions.portal.acceptInvite.password.label', 'Password')}
                  </label>
                  <div className="relative">
                    <input
                      id="accept-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      placeholder={t('competitions.portal.acceptInvite.password.placeholder', 'Min. 8 characters')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={submitting}
                      className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 pr-11 text-sm text-foreground placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-portal-primary focus:outline-none focus:ring-2 focus:ring-portal-primary/20 disabled:opacity-50 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="accept-confirm" className="block text-xs font-bold uppercase tracking-widest text-foreground mb-2">
                    {t('competitions.portal.acceptInvite.confirmPassword.label', 'Confirm Password')}
                  </label>
                  <input
                    id="accept-confirm"
                    type="password"
                    required
                    minLength={8}
                    placeholder={t('competitions.portal.acceptInvite.confirmPassword.placeholder', 'Repeat your password')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={submitting}
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm text-foreground placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-portal-primary focus:outline-none focus:ring-2 focus:ring-portal-primary/20 disabled:opacity-50 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-portal-primary px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-portal-primary-light hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      {t('competitions.portal.acceptInvite.submitting', 'Setting up...')}
                    </span>
                  ) : (
                    <>
                      {t('competitions.portal.acceptInvite.submit', 'Accept & Get Started')}
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
