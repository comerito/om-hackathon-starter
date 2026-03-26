"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Input } from '@open-mercato/ui/primitives/input'
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
  Camera,
  X,
  Plus,
  Github,
  Linkedin,
  Twitter,
  Globe,
  Save,
  Loader2,
} from 'lucide-react'

/* ---------- types ---------- */

type ProfileData = {
  id: string
  bio: string | null
  organization: string | null
  avatar_url: string | null
  portfolio_url: string | null
  office_hours_url: string | null
  specialty: string | null
  skills: string[]
  social_links: { github?: string; linkedin?: string; twitter?: string; website?: string }
  notification_preferences: { email_digest?: boolean; slack_alerts?: boolean; sms_urgent?: boolean }
}

/* ---------- role dot colors ---------- */

const roleDotColors: string[] = [
  'bg-portal-primary', 'bg-green-400', 'bg-amber-400',
  'bg-red-400', 'bg-blue-400', 'bg-purple-400',
]

/* ---------- helpers ---------- */

function getInitials(name: string): string {
  return name.split(' ').map((p) => p.charAt(0)).join('').toUpperCase().slice(0, 2)
}

/* ---------- skill input ---------- */

function SkillInput({ skills, onChange }: { skills: string[]; onChange: (s: string[]) => void }) {
  const [input, setInput] = React.useState('')

  function addSkill() {
    const trimmed = input.trim()
    if (trimmed && !skills.includes(trimmed)) {
      onChange([...skills, trimmed])
    }
    setInput('')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {skills.map((skill) => (
          <span key={skill} className="inline-flex items-center gap-1 rounded-full bg-portal-primary/10 px-2.5 py-1 text-xs font-medium text-portal-primary">
            {skill}
            <button type="button" onClick={() => onChange(skills.filter(s => s !== skill))} className="hover:text-portal-danger transition-colors">
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Add a skill..."
          value={input}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
          className="flex-1"
        />
        <button
          type="button"
          onClick={addSkill}
          className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-portal-secondary hover:bg-gray-50 transition-colors"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  )
}

/* ---------- profile content ---------- */

function ProfileContent() {
  const { auth } = usePortalContext()
  const queryClient = useQueryClient()
  const user = auth.user!
  const roles = auth.roles
  const features = auth.resolvedFeatures

  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false)
  const avatarInputRef = React.useRef<HTMLInputElement>(null)

  // Form state
  const [bio, setBio] = React.useState('')
  const [organization, setOrganization] = React.useState('')
  const [specialty, setSpecialty] = React.useState('')
  const [skills, setSkills] = React.useState<string[]>([])
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null)
  const [portfolioUrl, setPortfolioUrl] = React.useState('')
  const [officeHoursUrl, setOfficeHoursUrl] = React.useState('')
  const [socialLinks, setSocialLinks] = React.useState<{ github?: string; linkedin?: string; twitter?: string; website?: string }>({})
  const [notifPrefs, setNotifPrefs] = React.useState<{ email_digest?: boolean; slack_alerts?: boolean; sms_urgent?: boolean }>({})

  // Fetch profile
  const { data, isLoading } = useQuery({
    queryKey: ['portal-my-profile'],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ ok: boolean; profile: ProfileData | null }>(
        '/api/competitions/portal/update-profile',
      )
      return ok && result ? result.profile : null
    },
  })

  // Populate form from fetched data
  React.useEffect(() => {
    if (data) {
      setBio(data.bio ?? '')
      setOrganization(data.organization ?? '')
      setSpecialty(data.specialty ?? '')
      setSkills(data.skills ?? [])
      setAvatarUrl(data.avatar_url)
      setPortfolioUrl(data.portfolio_url ?? '')
      setOfficeHoursUrl(data.office_hours_url ?? '')
      setSocialLinks(data.social_links ?? {})
      setNotifPrefs(data.notification_preferences ?? {})
    }
  }, [data])

  // Avatar upload
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.set('entityId', 'competitions:participant-profile')
      formData.set('recordId', data?.id ?? 'new')
      formData.set('file', file)
      formData.set('fieldKey', 'avatar')

      const { ok, result } = await apiCall<{ ok: boolean; item?: { id: string; url: string } }>(
        '/api/attachments',
        { method: 'POST', body: formData },
      )

      if (ok && result?.item?.url) {
        const newAvatarUrl = result.item.url
        setAvatarUrl(newAvatarUrl)

        // Save immediately
        await apiCall('/api/competitions/portal/update-profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar_url: newAvatarUrl }),
        })
        queryClient.invalidateQueries({ queryKey: ['portal-my-profile'] })
        flash('Avatar updated', 'success')
      } else {
        flash('Failed to upload avatar', 'error')
      }
    } catch {
      flash('Upload failed', 'error')
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  // Save profile
  async function handleSave() {
    setSaving(true)
    try {
      const { ok, result } = await apiCall<{ ok: boolean; error?: string }>(
        '/api/competitions/portal/update-profile',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bio: bio || null,
            organization: organization || null,
            specialty: specialty || null,
            skills,
            portfolio_url: portfolioUrl || null,
            office_hours_url: officeHoursUrl || null,
            social_links: socialLinks,
            notification_preferences: notifPrefs,
          }),
        },
      )

      if (ok) {
        queryClient.invalidateQueries({ queryKey: ['portal-my-profile'] })
        flash('Profile updated successfully', 'success')
        setEditing(false)
      } else {
        flash(result?.error ?? 'Failed to save profile', 'error')
      }
    } catch {
      flash('Failed to save profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PortalPageTitle
        label="Participant Portal"
        title="My Identity"
        rightElement={
          editing ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs sm:text-sm font-medium text-portal-secondary hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-portal-primary px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition-colors hover:bg-portal-primary/90 disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-portal-primary px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition-colors hover:bg-portal-primary/90"
            >
              Edit Profile
            </button>
          )
        }
      />

      {isLoading ? (
        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-portal-secondary">
          Loading profile...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* ---------- Left Column ---------- */}
          <div className="space-y-4">
            {/* Profile Hero Card */}
            <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-6">
              <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-5">
                {/* Avatar */}
                <div className="relative shrink-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={user.displayName}
                      className="size-20 sm:size-24 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex size-20 sm:size-24 items-center justify-center rounded-xl bg-portal-primary/10 text-2xl font-bold text-portal-primary">
                      {getInitials(user.displayName)}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border-2 border-white bg-portal-primary text-white shadow-sm transition-colors hover:bg-portal-primary/90 disabled:opacity-60"
                  >
                    {uploadingAvatar ? <Loader2 className="size-3 animate-spin" /> : <Camera className="size-3" />}
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>

                {/* Name + Email + Bio */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <h2 className="text-xl font-bold text-foreground truncate">{user.displayName}</h2>
                    {specialty && <PortalBadge variant="primary">{specialty}</PortalBadge>}
                  </div>

                  <div className="mt-1 flex items-center gap-2 justify-center sm:justify-start">
                    <span className="text-sm text-portal-secondary truncate">{user.email}</span>
                    {user.emailVerified && <span className="text-xs font-medium text-green-600">Verified</span>}
                  </div>

                  {editing ? (
                    <div className="mt-3">
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Write a short bio about yourself..."
                        rows={3}
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-foreground placeholder:text-gray-400 focus:border-portal-primary focus:outline-none focus:ring-1 focus:ring-portal-primary/30 resize-none"
                      />
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-relaxed text-portal-secondary">
                      {bio || 'No bio yet. Click "Edit Profile" to add one.'}
                    </p>
                  )}

                  {/* Social Links */}
                  {!editing && (socialLinks.github || socialLinks.linkedin || socialLinks.twitter || socialLinks.website) && (
                    <div className="mt-4 flex items-center gap-2 justify-center sm:justify-start">
                      {socialLinks.github && (
                        <a href={socialLinks.github} target="_blank" rel="noopener noreferrer" className="flex size-8 items-center justify-center rounded-lg bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 hover:text-foreground">
                          <Github className="size-4" />
                        </a>
                      )}
                      {socialLinks.linkedin && (
                        <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="flex size-8 items-center justify-center rounded-lg bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 hover:text-foreground">
                          <Linkedin className="size-4" />
                        </a>
                      )}
                      {socialLinks.twitter && (
                        <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="flex size-8 items-center justify-center rounded-lg bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 hover:text-foreground">
                          <Twitter className="size-4" />
                        </a>
                      )}
                      {socialLinks.website && (
                        <a href={socialLinks.website} target="_blank" rel="noopener noreferrer" className="flex size-8 items-center justify-center rounded-lg bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 hover:text-foreground">
                          <Globe className="size-4" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Edit Form Sections */}
            {editing && (
              <div className="space-y-4">
                {/* Organization & Specialty */}
                <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-6 space-y-4">
                  <h3 className="text-sm font-bold text-foreground">About You</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-portal-secondary mb-1">Organization</label>
                      <Input value={organization} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrganization(e.target.value)} placeholder="Company or school" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-portal-secondary mb-1">Specialty</label>
                      <Input value={specialty} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSpecialty(e.target.value)} placeholder="e.g. Full-Stack, Design, AI" />
                    </div>
                  </div>
                </div>

                {/* Skills */}
                <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-6 space-y-3">
                  <h3 className="text-sm font-bold text-foreground">Skills</h3>
                  <SkillInput skills={skills} onChange={setSkills} />
                </div>

                {/* Social Links */}
                <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-6 space-y-4">
                  <h3 className="text-sm font-bold text-foreground">Social Links</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Github className="size-4 text-portal-secondary shrink-0" />
                      <Input
                        value={socialLinks.github ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSocialLinks(prev => ({ ...prev, github: e.target.value }))}
                        placeholder="https://github.com/username"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Linkedin className="size-4 text-portal-secondary shrink-0" />
                      <Input
                        value={socialLinks.linkedin ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSocialLinks(prev => ({ ...prev, linkedin: e.target.value }))}
                        placeholder="https://linkedin.com/in/username"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Twitter className="size-4 text-portal-secondary shrink-0" />
                      <Input
                        value={socialLinks.twitter ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSocialLinks(prev => ({ ...prev, twitter: e.target.value }))}
                        placeholder="https://twitter.com/username"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Globe className="size-4 text-portal-secondary shrink-0" />
                      <Input
                        value={socialLinks.website ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSocialLinks(prev => ({ ...prev, website: e.target.value }))}
                        placeholder="https://yourwebsite.com"
                      />
                    </div>
                  </div>
                </div>

                {/* Portfolio & Office Hours */}
                <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-6 space-y-4">
                  <h3 className="text-sm font-bold text-foreground">Links</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-portal-secondary mb-1">Portfolio URL</label>
                      <Input value={portfolioUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPortfolioUrl(e.target.value)} placeholder="https://portfolio.dev" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-portal-secondary mb-1">Office Hours</label>
                      <Input value={officeHoursUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOfficeHoursUrl(e.target.value)} placeholder="https://calendly.com/you" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Read-only: Organization + Skills + Links */}
            {!editing && (organization || skills.length > 0 || portfolioUrl) && (
              <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-6 space-y-4">
                {organization && (
                  <div>
                    <SectionLabel>Organization</SectionLabel>
                    <p className="mt-1 text-sm font-medium text-foreground">{organization}</p>
                  </div>
                )}
                {skills.length > 0 && (
                  <div>
                    <SectionLabel>Skills</SectionLabel>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {skills.map((skill) => (
                        <span key={skill} className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(portfolioUrl || officeHoursUrl) && (
                  <div>
                    <SectionLabel>Links</SectionLabel>
                    <div className="mt-2 flex flex-col gap-1">
                      {portfolioUrl && <a href={portfolioUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-portal-primary hover:underline truncate">{portfolioUrl}</a>}
                      {officeHoursUrl && <a href={officeHoursUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-portal-primary hover:underline truncate">{officeHoursUrl}</a>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Access Permissions Card */}
            <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-gray-50">
                    <Shield className="size-4 text-portal-secondary" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">Access Permissions</h3>
                </div>
              </div>
              {features.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {features.map((feature) => (
                    <span key={feature} className="inline-flex items-center rounded-md bg-gray-50 px-3 py-1.5 font-mono text-[11px] text-portal-secondary">{feature}</span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-portal-secondary">No permissions assigned.</p>
              )}
            </div>
          </div>

          {/* ---------- Right Column ---------- */}
          <div className="space-y-4">
            {/* Assigned Roles Card */}
            <div className="rounded-xl border border-gray-100 bg-white">
              <div className="flex items-center justify-between px-4 sm:px-5 py-4">
                <h3 className="text-sm font-bold text-foreground">Assigned Roles</h3>
                <span className="inline-flex items-center justify-center rounded-full bg-portal-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-portal-primary">
                  {String(roles.length).padStart(2, '0')}
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {roles.length > 0 ? (
                  roles.map((role, idx) => (
                    <div key={role.id} className="flex items-center gap-3 px-4 sm:px-5 py-3 transition-colors hover:bg-gray-50">
                      <div className={cn('size-2 shrink-0 rounded-full', roleDotColors[idx % roleDotColors.length])} />
                      <span className="flex-1 text-sm font-medium text-foreground truncate">{role.name}</span>
                      <ChevronRight className="size-4 text-gray-300" />
                    </div>
                  ))
                ) : (
                  <div className="px-4 sm:px-5 py-4 text-sm text-portal-secondary">No roles assigned.</div>
                )}
              </div>
            </div>

            {/* Engagement Controls Card */}
            <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-5">
              <h3 className="text-sm font-bold text-foreground mb-4">Notifications</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Email Digest</p>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-portal-secondary">Daily Summary</span>
                  </div>
                  <ToggleSwitch
                    checked={notifPrefs.email_digest ?? true}
                    onChange={(v) => {
                      const updated = { ...notifPrefs, email_digest: v }
                      setNotifPrefs(updated)
                      if (!editing) {
                        apiCall('/api/competitions/portal/update-profile', {
                          method: 'PUT', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ notification_preferences: updated }),
                        })
                      }
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Slack Alerts</p>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-portal-secondary">Instant</span>
                  </div>
                  <ToggleSwitch
                    checked={notifPrefs.slack_alerts ?? false}
                    onChange={(v) => {
                      const updated = { ...notifPrefs, slack_alerts: v }
                      setNotifPrefs(updated)
                      if (!editing) {
                        apiCall('/api/competitions/portal/update-profile', {
                          method: 'PUT', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ notification_preferences: updated }),
                        })
                      }
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">SMS Urgent</p>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-portal-secondary">Critical Only</span>
                  </div>
                  <ToggleSwitch
                    checked={notifPrefs.sms_urgent ?? false}
                    onChange={(v) => {
                      const updated = { ...notifPrefs, sms_urgent: v }
                      setNotifPrefs(updated)
                      if (!editing) {
                        apiCall('/api/competitions/portal/update-profile', {
                          method: 'PUT', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ notification_preferences: updated }),
                        })
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
