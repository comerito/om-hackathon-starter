"use client"
import Link from 'next/link'
import { ShieldCheck, ArrowLeft } from 'lucide-react'

type Props = { params: { orgSlug: string } }

export default function SignupBlockedPage({ params }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-portal-bg px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 size-16 rounded-2xl bg-portal-primary/10 flex items-center justify-center">
          <ShieldCheck className="size-8 text-portal-primary" />
        </div>

        <h1 className="font-display text-2xl font-bold text-foreground">
          Registration is invite-only
        </h1>

        <p className="mt-3 text-sm text-portal-secondary leading-relaxed max-w-sm mx-auto">
          This hackathon uses invite-only registration. If you&apos;ve been invited, check your email for a registration link. Otherwise, contact the organizer to request access.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href={`/${params.orgSlug}/portal/login`}
            className="flex items-center justify-center gap-2 rounded-xl bg-portal-primary px-6 py-3 text-sm font-bold text-white hover:bg-portal-primary-light transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
