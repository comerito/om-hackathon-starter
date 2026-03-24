"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { cn } from '@open-mercato/shared/lib/utils'
import { PortalCompetitionLayout } from '../../../../components/PortalCompetitionLayout'
import {
  PortalPageTitle,
  SectionLabel,
  PortalBadge,
  ToggleSwitch,
} from '@/components/portal'
import {
  Shield,
  ChevronRight,
  Link2,
  Briefcase,
  Mail,
  Pencil,
} from 'lucide-react'

/* ---------- role dot colors ---------- */

const roleDotColors: string[] = [
  'bg-portal-primary',
  'bg-green-400',
  'bg-amber-400',
  'bg-red-400',
  'bg-blue-400',
  'bg-purple-400',
]

/* ---------- helpers ---------- */

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/* ---------- profile content ---------- */

function ProfileContent() {
  const { auth } = usePortalContext()
  const user = auth.user!
  const roles = auth.roles
  const features = auth.resolvedFeatures

  /* engagement toggle state (local only — GAP 14) */
  const [emailUpdates, setEmailUpdates] = React.useState(true)
  const [slackNotifications, setSlackNotifications] = React.useState(false)
  const [smsAlerts, setSmsAlerts] = React.useState(false)

  return (
    <div className="space-y-6">
      {/* ===== Page Header ===== */}
      <PortalPageTitle
        label="Participant Portal"
        title="My Identity"
        rightElement={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-portal-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-portal-primary/90"
          >
            <Pencil className="size-4" />
            Edit Profile
          </button>
        }
      />

      {/* ===== Two Column Layout ===== */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ---------- Left Column ---------- */}
        <div className="space-y-4">
          {/* Profile Hero Card */}
          <div className="rounded-xl border border-gray-100 bg-white p-6">
            <div className="flex items-start gap-5">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="flex size-24 items-center justify-center rounded-xl bg-portal-primary/10 text-2xl font-bold text-portal-primary">
                  {getInitials(user.displayName)}
                </div>
                <button
                  type="button"
                  className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-gray-500 shadow-sm transition-colors hover:bg-gray-200"
                >
                  <Pencil className="size-3" />
                </button>
              </div>

              {/* Name + Email + Bio */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground truncate">
                    {user.displayName}
                  </h2>
                  <PortalBadge variant="primary">PRO</PortalBadge>
                </div>

                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm text-portal-secondary truncate">
                    {user.email}
                  </span>
                  {user.emailVerified && (
                    <span className="text-xs font-medium text-green-600">
                      Verified
                    </span>
                  )}
                </div>

                <p className="mt-3 text-sm leading-relaxed text-portal-secondary">
                  Passionate about building innovative solutions at the
                  intersection of technology and human experience. Always looking
                  for the next challenge to push boundaries.
                </p>

                {/* Social Links */}
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded-lg bg-gray-50 text-gray-400 transition-colors hover:bg-gray-100 hover:text-foreground"
                  >
                    <Link2 className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded-lg bg-gray-50 text-gray-400 transition-colors hover:bg-gray-100 hover:text-foreground"
                  >
                    <Briefcase className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded-lg bg-gray-50 text-gray-400 transition-colors hover:bg-gray-100 hover:text-foreground"
                  >
                    <Mail className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Access Permissions Card */}
          <div className="rounded-xl border border-gray-100 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-gray-50">
                  <Shield className="size-4 text-portal-secondary" />
                </div>
                <h3 className="text-sm font-bold text-foreground">
                  Access Permissions
                </h3>
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wide text-portal-secondary">
                SYSTEM AUTH V2.1
              </span>
            </div>

            {features.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {features.map((feature) => (
                  <span
                    key={feature}
                    className="inline-flex items-center rounded-md bg-gray-50 px-3 py-1.5 font-mono text-[11px] text-portal-secondary"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-portal-secondary">
                No permissions assigned.
              </p>
            )}
          </div>
        </div>

        {/* ---------- Right Column ---------- */}
        <div className="space-y-4">
          {/* Assigned Roles Card */}
          <div className="rounded-xl border border-gray-100 bg-white">
            <div className="flex items-center justify-between px-5 py-4">
              <h3 className="text-sm font-bold text-foreground">
                Assigned Roles
              </h3>
              <span className="inline-flex items-center justify-center rounded-full bg-portal-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-portal-primary">
                {String(roles.length).padStart(2, '0')}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {roles.length > 0 ? (
                roles.map((role, idx) => (
                  <div
                    key={role.id}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50"
                  >
                    <div
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        roleDotColors[idx % roleDotColors.length],
                      )}
                    />
                    <span className="flex-1 text-sm font-medium text-foreground truncate">
                      {role.name}
                    </span>
                    <ChevronRight className="size-4 text-gray-300" />
                  </div>
                ))
              ) : (
                <div className="px-5 py-4 text-sm text-portal-secondary">
                  No roles assigned.
                </div>
              )}
            </div>
          </div>

          {/* Engagement Controls Card */}
          <div className="rounded-xl border border-gray-100 bg-white p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">
              Engagement Controls
            </h3>
            <div className="space-y-4">
              {/* Email Updates */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Email Updates
                  </p>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-portal-secondary">
                    DAILY DIGEST
                  </span>
                </div>
                <ToggleSwitch
                  checked={emailUpdates}
                  onChange={setEmailUpdates}
                />
              </div>

              {/* Slack Notifications */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Slack Notifications
                  </p>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-portal-secondary">
                    INSTANT ALERT
                  </span>
                </div>
                <ToggleSwitch
                  checked={slackNotifications}
                  onChange={setSlackNotifications}
                />
              </div>

              {/* SMS Urgent Alerts */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    SMS Urgent Alerts
                  </p>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-portal-secondary">
                    TRANSACTIONAL
                  </span>
                </div>
                <ToggleSwitch
                  checked={smsAlerts}
                  onChange={setSmsAlerts}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- page component ---------- */

export default function ProfilePortalPage({ params }: { params: { orgSlug: string } }) {
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <PortalCompetitionLayout>
      <ProfileContent />
    </PortalCompetitionLayout>
  )
}
