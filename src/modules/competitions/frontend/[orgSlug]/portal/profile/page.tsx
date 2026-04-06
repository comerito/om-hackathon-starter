"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
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
  ProfileCompletionCard,
} from '@/components/portal'
import {
  ChevronRight,
  Camera,
  X,
  Plus,
  Github,
  Linkedin,
  Twitter,
  Globe,
  MessageCircle,
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
  social_links: { github?: string; linkedin?: string; x?: string; website?: string; discord?: string }
  github_username: string | null
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

/* ---------- predefined skills ---------- */

const HACKATHON_SKILLS = [
  // Programming languages
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'Swift',
  'Kotlin', 'PHP', 'SQL', 'HTML/CSS', 'Solidity',
  // Frameworks & libraries
  'React', 'Next.js', 'Vue.js', 'Angular', 'Svelte', 'Node.js', 'Express', 'Django', 'Flask', 'Spring Boot',
  'React Native', 'Flutter', 'iOS Development', 'Android Development',
  // APIs & protocols
  'REST APIs', 'GraphQL', 'WebSockets',
  // Databases
  'PostgreSQL', 'MongoDB', 'Redis', 'Firebase',
  // Cloud & infrastructure
  'AWS', 'Google Cloud', 'Azure', 'Docker', 'Kubernetes', 'CI/CD',
  // AI & data
  'Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision', 'LLM/AI Agents',
  'Data Analysis', 'Data Visualization', 'Data Engineering',
  // Web3
  'Blockchain', 'Smart Contracts', 'Web3',
  // Architecture & engineering
  'Software Architecture', 'System Design', 'API Design', 'Microservices',
  // Design
  'UI/UX Design', 'Figma', 'Graphic Design', 'Prototyping', 'User Research',
  'Interaction Design', 'Design Systems', 'Accessibility',
  // Testing & QA
  'Manual Testing', 'Test Automation', 'Performance Testing', 'Security Testing',
  // Management & soft skills
  'Product Management', 'Project Management', 'Agile/Scrum', 'Technical Writing',
  'Public Speaking', 'Pitch/Presentation', 'Business Strategy', 'Marketing',
  // Other technical
  'Cybersecurity', 'DevOps', 'Embedded Systems', 'IoT',
] as const

const MAX_SKILLS = 10

/* ---------- skill input ---------- */

function SkillInput({ skills, onChange }: { skills: string[]; onChange: (s: string[]) => void }) {
  const t = useT()
  const [search, setSearch] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return HACKATHON_SKILLS.filter(s => !skills.includes(s))
    return HACKATHON_SKILLS.filter(s => !skills.includes(s) && s.toLowerCase().includes(q))
  }, [search, skills])

  function addSkill(skill: string) {
    if (!skills.includes(skill) && skills.length < MAX_SKILLS) {
      onChange([...skills, skill])
    }
    setSearch('')
  }

  return (
    <div>
      {/* Selected skills */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {skills.map((skill) => (
          <span key={skill} className="inline-flex items-center gap-1 rounded-full bg-portal-primary/10 px-2.5 py-1 text-xs font-medium text-portal-primary max-w-[200px]">
            <span className="truncate">{skill}</span>
            <button type="button" onClick={() => onChange(skills.filter(s => s !== skill))} className="shrink-0 hover:text-portal-danger transition-colors">
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Search / picker */}
      {skills.length < MAX_SKILLS && (
        <div ref={wrapperRef} className="relative">
          <Input
            placeholder={t('competitions.portal.profile.skills.placeholder', 'Search skills...')}
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            className="w-full"
          />
          {open && filtered.length > 0 && (
            <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 shadow-lg">
              {filtered.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  className="flex w-full items-center px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  onClick={() => { addSkill(skill); setOpen(false) }}
                >
                  <Plus className="size-3.5 mr-2 text-portal-primary shrink-0" />
                  {skill}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {skills.length >= MAX_SKILLS && (
        <p className="text-xs text-muted-foreground">
          {t('competitions.portal.profile.skills.max', 'Maximum {count} skills reached', { count: MAX_SKILLS })}
        </p>
      )}
    </div>
  )
}

/* ---------- profile content ---------- */

function ProfileContent() {
  const t = useT()
  const { auth } = usePortalContext()
  const queryClient = useQueryClient()
  const user = auth.user!
  const roles = auth.roles

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
  const [socialLinks, setSocialLinks] = React.useState<{ github?: string; linkedin?: string; x?: string; website?: string; discord?: string }>({})
  const [githubUsername, setGithubUsername] = React.useState('')

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
      setGithubUsername(data.github_username ?? '')
    }
  }, [data])

  // Avatar upload
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.set('file', file)

      const { ok, result } = await apiCall<{ ok: boolean; avatar_url?: string; error?: string }>(
        '/api/competitions/portal/profile-avatar',
        { method: 'POST', body: formData },
      )

      if (ok && result?.avatar_url) {
        const newAvatarUrl = result.avatar_url
        setAvatarUrl(newAvatarUrl)
        queryClient.invalidateQueries({ queryKey: ['portal-my-profile'] })
        flash(t('competitions.portal.profile.flash.avatarUpdated', 'Avatar updated'), 'success')
      } else {
        flash(result?.error ?? t('competitions.portal.profile.flash.avatarFailed', 'Failed to upload avatar'), 'error')
      }
    } catch {
      flash(t('competitions.portal.profile.flash.uploadFailed', 'Upload failed'), 'error')
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
            github_username: githubUsername || null,
          }),
        },
      )

      if (ok) {
        queryClient.invalidateQueries({ queryKey: ['portal-my-profile'] })
        flash(t('competitions.portal.profile.flash.saved', 'Profile updated successfully'), 'success')
        setEditing(false)
      } else {
        flash(result?.error ?? t('competitions.portal.profile.flash.saveFailed', 'Failed to save profile'), 'error')
      }
    } catch {
      flash(t('competitions.portal.profile.flash.saveFailed', 'Failed to save profile'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PortalPageTitle
        label={t('competitions.portal.profile.page.label', 'Participant Portal')}
        title={t('competitions.portal.profile.page.title', 'My Identity')}
        rightElement={
          editing ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-xs sm:text-sm font-medium text-portal-secondary hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                {t('competitions.portal.profile.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-portal-primary px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition-colors hover:bg-portal-primary/90 disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {t('competitions.portal.profile.save', 'Save')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-portal-primary px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition-colors hover:bg-portal-primary/90"
            >
              {t('competitions.portal.profile.edit', 'Edit Profile')}
            </button>
          )
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-48 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
          <div className="h-32 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* ---------- Left Column ---------- */}
          <div className="space-y-4">
            {/* Profile Hero Card */}
            <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6">
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
                    className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 bg-portal-primary text-white shadow-sm transition-colors hover:bg-portal-primary/90 disabled:opacity-60"
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
                    {user.emailVerified && <span className="text-xs font-medium text-green-600">{t('competitions.portal.profile.verified', 'Verified')}</span>}
                  </div>

                  {editing ? (
                    <div className="mt-3">
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder={t('competitions.portal.profile.bio.placeholder', 'Write a short bio about yourself...')}
                        rows={3}
                        className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-portal-primary focus:outline-none focus:ring-1 focus:ring-portal-primary/30 resize-none"
                      />
                    </div>
                  ) : (
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-portal-secondary">
                      {bio || t('competitions.portal.profile.bio.empty', 'No bio yet. Click "Edit Profile" to add one.')}
                    </p>
                  )}

                  {/* Social Links */}
                  {!editing && (socialLinks.github || socialLinks.linkedin || socialLinks.x || socialLinks.website || socialLinks.discord) && (
                    <div className="mt-4 flex items-center gap-2 justify-center sm:justify-start">
                      {socialLinks.github && (
                        <a href={socialLinks.github} target="_blank" rel="noopener noreferrer" className="flex size-8 items-center justify-center rounded-lg bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-slate-400 transition-colors hover:bg-gray-100 dark:hover:bg-white/10 hover:text-foreground">
                          <Github className="size-4" />
                        </a>
                      )}
                      {socialLinks.linkedin && (
                        <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="flex size-8 items-center justify-center rounded-lg bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-slate-400 transition-colors hover:bg-gray-100 dark:hover:bg-white/10 hover:text-foreground">
                          <Linkedin className="size-4" />
                        </a>
                      )}
                      {socialLinks.x && (
                        <a href={socialLinks.x} target="_blank" rel="noopener noreferrer" className="flex size-8 items-center justify-center rounded-lg bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-slate-400 transition-colors hover:bg-gray-100 dark:hover:bg-white/10 hover:text-foreground">
                          <Twitter className="size-4" />
                        </a>
                      )}
                      {socialLinks.website && (
                        <a href={socialLinks.website} target="_blank" rel="noopener noreferrer" className="flex size-8 items-center justify-center rounded-lg bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-slate-400 transition-colors hover:bg-gray-100 dark:hover:bg-white/10 hover:text-foreground">
                          <Globe className="size-4" />
                        </a>
                      )}
                      {socialLinks.discord && (
                        <span className="flex items-center gap-1.5 rounded-lg bg-gray-50 dark:bg-white/5 px-2.5 py-1.5 text-xs text-gray-500 dark:text-slate-400">
                          <MessageCircle className="size-4" />
                          {socialLinks.discord}
                        </span>
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
                <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6 space-y-4">
                  <h3 className="text-sm font-bold text-foreground">{t('competitions.portal.profile.about.title', 'About You')}</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-portal-secondary mb-1">{t('competitions.portal.profile.organization.label', 'Organization')}</label>
                      <Input value={organization} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrganization(e.target.value)} placeholder={t('competitions.portal.profile.organization.placeholder', 'Company or school')} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-portal-secondary mb-1">{t('competitions.portal.profile.specialty.label', 'Specialty')}</label>
                      <Input value={specialty} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSpecialty(e.target.value)} placeholder={t('competitions.portal.profile.specialty.placeholder', 'e.g. Full-Stack, Design, AI')} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-portal-secondary mb-1">{t('competitions.portal.profile.github.label', 'GitHub Username')}</label>
                    <Input value={githubUsername} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGithubUsername(e.target.value)} placeholder={t('competitions.portal.profile.github.placeholder', 'e.g. octocat (for Bounty Hunting track)')} />
                    <p className="mt-1 text-xs text-portal-secondary">{t('competitions.portal.profile.github.hint', 'Required for the Bounty Hunting track. Your GitHub PRs will be matched using this username.')}</p>
                  </div>
                </div>

                {/* Skills */}
                <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6 space-y-3">
                  <h3 className="text-sm font-bold text-foreground">{t('competitions.portal.profile.skills.title', 'Skills')}</h3>
                  <SkillInput skills={skills} onChange={setSkills} />
                </div>

                {/* Social Links */}
                <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6 space-y-4">
                  <h3 className="text-sm font-bold text-foreground">{t('competitions.portal.profile.social.title', 'Social Links')}</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Github className="size-4 text-portal-secondary shrink-0" />
                      <Input
                        value={socialLinks.github ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSocialLinks(prev => ({ ...prev, github: e.target.value }))}
                        placeholder={t('competitions.portal.profile.social.github.placeholder', 'https://github.com/username')}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Linkedin className="size-4 text-portal-secondary shrink-0" />
                      <Input
                        value={socialLinks.linkedin ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSocialLinks(prev => ({ ...prev, linkedin: e.target.value }))}
                        placeholder={t('competitions.portal.profile.social.linkedin.placeholder', 'https://linkedin.com/in/username')}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Twitter className="size-4 text-portal-secondary shrink-0" />
                      <Input
                        value={socialLinks.x ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSocialLinks(prev => ({ ...prev, x: e.target.value }))}
                        placeholder={t('competitions.portal.profile.social.x.placeholder', 'https://x.com/username')}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Globe className="size-4 text-portal-secondary shrink-0" />
                      <Input
                        value={socialLinks.website ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSocialLinks(prev => ({ ...prev, website: e.target.value }))}
                        placeholder={t('competitions.portal.profile.social.website.placeholder', 'https://yourwebsite.com')}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <MessageCircle className="size-4 text-portal-secondary shrink-0" />
                      <Input
                        value={socialLinks.discord ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSocialLinks(prev => ({ ...prev, discord: e.target.value }))}
                        placeholder={t('competitions.portal.profile.social.discord.placeholder', 'Discord nick')}
                      />
                    </div>
                  </div>
                </div>

                {/* Portfolio & Office Hours */}
                <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6 space-y-4">
                  <h3 className="text-sm font-bold text-foreground">{t('competitions.portal.profile.links.title', 'Links')}</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-portal-secondary mb-1">{t('competitions.portal.profile.links.portfolio.label', 'Portfolio URL')}</label>
                      <Input value={portfolioUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPortfolioUrl(e.target.value)} placeholder={t('competitions.portal.profile.links.portfolio.placeholder', 'https://portfolio.dev')} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-portal-secondary mb-1">{t('competitions.portal.profile.links.officeHours.label', 'Office Hours')}</label>
                      <Input value={officeHoursUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOfficeHoursUrl(e.target.value)} placeholder={t('competitions.portal.profile.links.officeHours.placeholder', 'https://calendly.com/you')} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Read-only: Organization + Skills + Links */}
            {!editing && (organization || skills.length > 0 || portfolioUrl) && (
              <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6 space-y-4">
                {organization && (
                  <div>
                    <SectionLabel>{t('competitions.portal.profile.organization.label', 'Organization')}</SectionLabel>
                    <p className="mt-1 text-sm font-medium text-foreground">{organization}</p>
                  </div>
                )}
                {skills.length > 0 && (
                  <div>
                    <SectionLabel>{t('competitions.portal.profile.skills.title', 'Skills')}</SectionLabel>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {skills.map((skill) => (
                        <span key={skill} className="inline-flex items-center rounded-full bg-gray-100 dark:bg-white/10 px-2.5 py-0.5 text-xs text-gray-600 dark:text-slate-400 max-w-[200px] truncate">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(portfolioUrl || officeHoursUrl) && (
                  <div>
                    <SectionLabel>{t('competitions.portal.profile.links.title', 'Links')}</SectionLabel>
                    <div className="mt-2 flex flex-col gap-1">
                      {portfolioUrl && <a href={portfolioUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-portal-primary hover:underline truncate">{portfolioUrl}</a>}
                      {officeHoursUrl && <a href={officeHoursUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-portal-primary hover:underline truncate">{officeHoursUrl}</a>}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* ---------- Right Column ---------- */}
          <div className="space-y-4">
            {/* Profile Completion */}
            {!editing && (
              <ProfileCompletionCard
                profileLink="#"
                onAction={() => setEditing(true)}
              />
            )}

            {/* Assigned Roles Card */}
            <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5">
              <div className="flex items-center justify-between px-4 sm:px-5 py-4">
                <h3 className="text-sm font-bold text-foreground">{t('competitions.portal.profile.roles.title', 'Assigned Roles')}</h3>
                <span className="inline-flex items-center justify-center rounded-full bg-portal-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-portal-primary">
                  {String(roles.length).padStart(2, '0')}
                </span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-white/5">
                {roles.length > 0 ? (
                  roles.map((role, idx) => (
                    <div key={role.id} className="flex items-center gap-3 px-4 sm:px-5 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-white/5">
                      <div className={cn('size-2 shrink-0 rounded-full', roleDotColors[idx % roleDotColors.length])} />
                      <span className="flex-1 text-sm font-medium text-foreground truncate">{role.name}</span>
                      <ChevronRight className="size-4 text-gray-300 dark:text-slate-600" />
                    </div>
                  ))
                ) : (
                  <div className="px-4 sm:px-5 py-4 text-sm text-portal-secondary">{t('competitions.portal.profile.roles.empty', 'No roles assigned.')}</div>
                )}
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
