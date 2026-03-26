"use client"
import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { Zap, ArrowRight, Eye, EyeOff } from 'lucide-react'

type Props = { params: { orgSlug: string } }

export default function HackathonLoginPage({ params }: Props) {
  const t = useT()
  const orgSlug = params.orgSlug
  const { tenant } = usePortalContext()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      setError(null)

      if (!tenant.tenantId) {
        setError('Organization not found.')
        return
      }

      setSubmitting(true)
      try {
        const result = await apiCall<{ ok: boolean; error?: string }>('/api/customer_accounts/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, tenantId: tenant.tenantId }),
        })

        if (result.ok && result.result?.ok) {
          window.location.assign(`/${orgSlug}/portal/dashboard`)
          return
        }

        if (result.status === 423) {
          setError('Account locked. Try again later.')
        } else if (result.status === 401) {
          setError('Invalid email or password.')
        } else {
          setError(result.result?.error || 'Login failed. Please try again.')
        }
      } catch {
        setError('Login failed. Please try again.')
      } finally {
        setSubmitting(false)
      }
    },
    [email, password, tenant.tenantId, orgSlug],
  )

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-portal-primary via-portal-primary to-portal-primary-light relative overflow-hidden">
        {/* Decorative elements */}
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
              <span className="text-sm font-bold uppercase tracking-widest opacity-80">Hackathon Portal</span>
            </div>
          </div>

          <div>
            <h1 className="font-display text-5xl font-bold leading-tight">
              Build.<br />
              Ship.<br />
              Win.
            </h1>
            <p className="mt-6 text-lg text-white/70 max-w-md leading-relaxed">
              Join the most exciting hackathon experience. Collaborate with talented developers,
              designers, and innovators to create something extraordinary.
            </p>
            <div className="mt-8 flex items-center gap-6">
              <div>
                <p className="text-3xl font-bold">48h</p>
                <p className="text-xs text-white/50 uppercase tracking-wider">Of Building</p>
              </div>
              <div className="h-8 w-px bg-white/20" />
              <div>
                <p className="text-3xl font-bold">$25K</p>
                <p className="text-xs text-white/50 uppercase tracking-wider">In Prizes</p>
              </div>
              <div className="h-8 w-px bg-white/20" />
              <div>
                <p className="text-3xl font-bold">3</p>
                <p className="text-xs text-white/50 uppercase tracking-wider">Tracks</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} Hackathon Portal. Powered by Open Mercato.
          </p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex flex-1 items-center justify-center bg-portal-bg px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="size-8 rounded-lg bg-portal-primary flex items-center justify-center">
              <Zap className="size-4 text-white" />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-portal-primary">Hackathon Portal</span>
          </div>

          <div className="mb-8">
            <h2 className="font-display text-3xl font-bold text-foreground">Welcome back</h2>
            <p className="mt-2 text-sm text-portal-secondary">
              Sign in to your account to continue your hackathon journey.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-white/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="block text-xs font-bold uppercase tracking-widest text-foreground mb-2">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm text-foreground placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-portal-primary focus:outline-none focus:ring-2 focus:ring-portal-primary/20 disabled:opacity-50 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-bold uppercase tracking-widest text-foreground mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
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

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-portal-primary px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-portal-primary-light hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                'Signing in...'
              ) : (
                <>
                  Sign In
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>

            <p className="text-center text-sm text-portal-secondary">
              Don&apos;t have an account?{' '}
              <Link
                href={`/${orgSlug}/portal/signup`}
                className="font-semibold text-portal-primary hover:text-portal-primary-light transition-colors"
              >
                Create one
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
