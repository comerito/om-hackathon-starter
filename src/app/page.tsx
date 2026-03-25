import type { Metadata } from 'next'
import { resolveLocalizedAppMetadata } from '@/lib/metadata'
import Link from 'next/link'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'

export async function generateMetadata(): Promise<Metadata> {
  return resolveLocalizedAppMetadata()
}

export default async function Home() {
  let orgSlug = 'portal'
  let orgName = 'Hackathon'
  try {
    const container = await createRequestContainer()
    const em = container.resolve<EntityManager>('em')
    const org = await em.findOne('Organization' as any, { deletedAt: null } as any)
    if (org) {
      orgSlug = (org as any).slug ?? orgSlug
      orgName = (org as any).name ?? orgName
    }
  } catch {
    // Fallback
  }

  const portalHref = `/${orgSlug}/portal/login`

  return (
    <main className="flex min-h-svh">
      {/* Left panel — branding */}
      <div className="relative hidden w-[55%] overflow-hidden bg-gradient-to-br from-portal-primary via-portal-primary to-portal-primary-light lg:flex">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-white/5" />
        <div className="absolute -top-16 right-1/4 size-72 rounded-full bg-white/5" />
        <div className="absolute bottom-1/3 right-0 h-40 w-40 rounded-full bg-white/[0.03]" />

        <div className="relative z-10 flex flex-1 flex-col justify-between p-14">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-white/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
              </svg>
            </div>
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-white/80">Hackathon Portal</span>
          </div>

          {/* Hero text */}
          <div>
            <h1 className="font-display text-6xl font-bold leading-[1.1] text-white xl:text-7xl">
              Build.<br />
              Ship.<br />
              Win.
            </h1>
            <p className="mt-8 max-w-sm text-lg leading-relaxed text-white/60">
              Join the most exciting hackathon experience. Collaborate with talented developers, designers, and innovators to create something extraordinary.
            </p>
          </div>

          {/* Footer */}
          <p className="text-xs text-white/25">
            &copy; {new Date().getFullYear()} {orgName}. Powered by Open Mercato.
          </p>
        </div>
      </div>

      {/* Right panel — portal entry */}
      <div className="flex flex-1 flex-col items-center justify-center bg-portal-bg px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-2 lg:hidden">
            <div className="flex size-8 items-center justify-center rounded-lg bg-portal-primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
              </svg>
            </div>
            <span className="text-sm font-bold uppercase tracking-[0.15em] text-portal-primary">Hackathon Portal</span>
          </div>

          {/* Heading */}
          <div className="mb-10">
            <h2 className="font-display text-3xl font-bold text-foreground">
              Welcome to {orgName}
            </h2>
            <p className="mt-2 text-sm text-portal-secondary">
              The hackathon portal for participants, mentors, and judges.
            </p>
          </div>

          {/* Portal CTA */}
          <Link
            href={portalHref}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-portal-primary px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-portal-primary-light hover:shadow-md"
          >
            Enter Portal
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </Link>

          {/* Divider */}
          <div className="mt-8 mb-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-gray-300">or</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* Admin login — secondary */}
          <Link
            href="/login"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-portal-secondary transition-colors hover:border-gray-300 hover:text-foreground"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Admin Backoffice
          </Link>
        </div>
      </div>
    </main>
  )
}
