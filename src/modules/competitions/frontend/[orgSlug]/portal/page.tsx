"use client"
import Link from 'next/link'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import {
  Zap, Users, Trophy, Calendar, Code, Rocket, ArrowRight,
} from 'lucide-react'

type Props = { params: { orgSlug: string } }

const features = [
  {
    icon: Code,
    title: 'Build Together',
    description: 'Collaborate in real-time with your team. Submit code, demos, and presentations all in one place.',
  },
  {
    icon: Trophy,
    title: 'Compete & Win',
    description: 'Multiple tracks, expert judges, and a prize pool. Show what you can build in 48 hours.',
  },
  {
    icon: Users,
    title: 'Find Your Team',
    description: 'Connect with developers, designers, and strategists. Form the perfect team for your challenge.',
  },
]

const stats = [
  { value: '48h', label: 'Of Hacking' },
  { value: '3', label: 'Tracks' },
  { value: '$25K', label: 'In Prizes' },
  { value: '∞', label: 'Ideas' },
]

export default function HackathonLandingPage({ params }: Props) {
  const { auth } = usePortalContext()
  const orgSlug = params.orgSlug
  const isLoggedIn = !!auth.user

  return (
    <div className="min-h-screen bg-portal-bg">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-portal-primary via-portal-primary to-portal-primary-light">
        {/* Dot pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute -bottom-32 -right-32 size-96 rounded-full bg-white/5" />
        <div className="absolute -top-20 -left-20 size-72 rounded-full bg-white/5" />

        <div className="relative z-10 mx-auto max-w-5xl px-6 py-20 text-center text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 backdrop-blur-sm mb-6">
            <Zap className="size-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Hackathon Portal</span>
          </div>

          <h1 className="font-display text-5xl font-bold leading-tight sm:text-6xl lg:text-7xl">
            Where Ideas<br />Become Reality
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-white/70 leading-relaxed">
            Join the hackathon, form your team, build something amazing, and compete for prizes.
            Everything you need in one portal.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            {isLoggedIn ? (
              <Link
                href={`/${orgSlug}/portal/dashboard`}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-portal-primary shadow-lg hover:shadow-xl transition-all"
              >
                Go to Dashboard
                <ArrowRight className="size-4" />
              </Link>
            ) : (
              <>
                <Link
                  href={`/${orgSlug}/portal/login`}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-portal-primary shadow-lg hover:shadow-xl transition-all"
                >
                  Sign In
                  <ArrowRight className="size-4" />
                </Link>
              </>
            )}
          </div>

          {/* Stats bar */}
          <div className="mt-16 flex items-center justify-center gap-8 sm:gap-12">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl font-bold sm:text-4xl">{stat.value}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-widest text-white/50">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-portal-primary">Everything You Need</span>
          <h2 className="mt-2 font-display text-3xl font-bold text-foreground">One Portal, Full Experience</h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-gray-100 bg-white p-7 transition-all hover:shadow-lg hover:border-portal-primary/20">
              <div className="size-12 rounded-xl bg-portal-primary/10 flex items-center justify-center mb-5">
                <feature.icon className="size-6 text-portal-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm text-portal-secondary leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mx-auto max-w-5xl px-6 pb-20">
        <div className="rounded-2xl bg-gradient-to-r from-portal-primary to-portal-primary-light p-10 text-center text-white">
          <Rocket className="size-8 mx-auto mb-4 opacity-80" />
          <h2 className="font-display text-2xl font-bold">Ready to Build?</h2>
          <p className="mt-2 text-sm text-white/70 max-w-md mx-auto">
            Sign in to access the hackathon dashboard, form your team, and start building.
          </p>
          <Link
            href={isLoggedIn ? `/${orgSlug}/portal/dashboard` : `/${orgSlug}/portal/login`}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white/20 px-6 py-3 text-sm font-bold backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            {isLoggedIn ? 'Go to Dashboard' : 'Get Started'}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 text-center text-xs text-portal-secondary">
        &copy; {new Date().getFullYear()} Hackathon Portal &middot; Powered by Open Mercato
      </footer>
    </div>
  )
}
