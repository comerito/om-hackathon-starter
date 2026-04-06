"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { Input } from '@open-mercato/ui/primitives/input'
import { Button } from '@open-mercato/ui/primitives/button'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@open-mercato/ui/primitives/popover'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { cn } from '@open-mercato/shared/lib/utils'
import {
  MessageCircle, Search, Users, X,
  ExternalLink, Briefcase, UserPlus, Check, SlidersHorizontal,
} from 'lucide-react'
import { PortalCompetitionLayout } from '../../../../components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../components/CompetitionContext'
import { PortalPageTitle, PortalBadge } from '@/components/portal'

/* ---------- types ---------- */

type Participant = {
  customer_user_id: string
  display_name: string
  role: string
  organization: string | null
  specialty: string | null
  skills: string[]
  looking_for_team: boolean
  has_team: boolean
  bio: string | null
  avatar_url: string | null
  portfolio_url: string | null
  office_hours_url: string | null
}

/* ---------- avatar colors by role ---------- */

const avatarColorsByRole: Record<string, string> = {
  participant: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  mentor: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400',
  judge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
}

const roleBadgeVariant: Record<string, 'primary' | 'info' | 'warning'> = {
  participant: 'primary',
  mentor: 'info',
  judge: 'warning',
}

/* ---------- constants ---------- */

const PAGE_SIZE = 24

/* ---------- profile modal ---------- */

function InviteParticipantModal({
  participant,
  onClose,
  onSubmit,
  invitingId,
}: {
  participant: Participant
  onClose: () => void
  onSubmit: (userId: string, message: string) => Promise<void>
  invitingId: string | null
}) {
  const t = useT()
  const [message, setMessage] = React.useState('')
  const isSubmitting = invitingId === participant.customer_user_id

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }

      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !isSubmitting) {
        event.preventDefault()
        void onSubmit(participant.customer_user_id, message.trim())
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSubmitting, message, onClose, onSubmit, participant.customer_user_id])

  React.useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-white/10">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {t('competitions.portal.participants.inviteToTeam', 'Invite to Team')}
            </h3>
            <p className="mt-1 text-sm text-portal-secondary">
              {t('competitions.portal.participants.inviteModalDesc', 'Send an optional message to {name}.', { name: participant.display_name })}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={t('common.close', 'Close')}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-sm font-medium text-foreground">{participant.display_name}</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-portal-secondary">
              {t('competitions.portal.participants.inviteMessage', 'Message (optional)')}
            </label>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t('competitions.portal.participants.inviteMessagePlaceholder', 'Hey, want to join our team?')}
              className="w-full rounded-xl border border-gray-200 bg-background px-3 py-2 text-sm min-h-[96px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-portal-primary dark:border-white/10 dark:placeholder:text-slate-500"
              rows={4}
              autoFocus
            />
            <p className="mt-2 text-[11px] text-portal-secondary">
              {t('competitions.portal.participants.inviteModalShortcut', 'Press Ctrl/Cmd+Enter to send, Escape to cancel.')}
            </p>
          </div>
        </div>

        <div className="flex gap-2 border-t border-gray-100 px-5 py-4 dark:border-white/10">
          <Button
            type="button"
            onClick={() => void onSubmit(participant.customer_user_id, message.trim())}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            <UserPlus className="size-4" />
            {isSubmitting
              ? t('competitions.portal.participants.inviting', 'Sending...')
              : t('competitions.portal.participants.sendInvite', 'Send Invite')}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ProfileModal({ participant: p, onClose, myTeamId, onInvite, invitingId }: {
  participant: Participant
  onClose: () => void
  myTeamId: string | null
  onInvite: (userId: string) => void
  invitingId: string | null
}) {
  const t = useT()
  const initials = p.display_name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2)
  const avatarColors = avatarColorsByRole[p.role] ?? 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-slate-300'
  const canInvite = !p.has_team && myTeamId
  const roleLabel = t(`competitions.portal.participants.role.${p.role}`, p.role)

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  React.useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Safe hostname extraction
  function getHostname(url: string): string {
    try { return new URL(url).hostname } catch { return url }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact header with avatar inline */}
        <div className="relative bg-gradient-to-br from-portal-primary to-portal-primary-light px-5 pt-4 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
          >
            <X className="size-4" />
          </button>

          <div className="flex items-center gap-4">
            {p.avatar_url ? (
              <img src={p.avatar_url} alt={p.display_name} className="size-16 rounded-full object-cover border-2 border-white/30 shadow-md" />
            ) : (
              <div className={cn('flex size-16 items-center justify-center rounded-full text-xl font-bold border-2 border-white/30 shadow-md', avatarColors)}>
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white truncate">{p.display_name}</h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  {roleLabel}
                </span>
                {p.specialty && (
                  <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/80">
                    {p.specialty}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Looking for team + Organization */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
              p.has_team ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600',
            )}>
              {p.has_team ? <Check className="size-3" /> : <Users className="size-3" />}
              {p.has_team
                ? t('competitions.portal.participants.inTeam', 'In Team')
                : t('competitions.portal.participants.noTeam', 'No Team')}
            </span>
            {p.looking_for_team && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-green-700">
                <Users className="size-3" />
                {t('competitions.portal.participants.lookingForTeam', 'Looking for Team')}
              </span>
            )}
            {p.organization && (
              <span className="inline-flex items-center gap-1.5 text-sm text-portal-secondary">
                <Briefcase className="size-3.5" />
                {p.organization}
              </span>
            )}
          </div>

          {/* Bio */}
          {p.bio && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-portal-secondary">{p.bio}</p>
          )}

          {/* Skills */}
          {p.skills.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-portal-secondary mb-2">
                {t('competitions.portal.participants.skills', 'Skills')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {p.skills.map((skill) => (
                  <span key={skill} className="inline-flex items-center rounded-full bg-gray-100 dark:bg-white/10 px-2.5 py-0.5 text-xs text-gray-600 dark:text-slate-400 max-w-[200px] truncate">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          {(p.portfolio_url || p.office_hours_url) && (
            <div className="space-y-2">
              {p.portfolio_url && (
                <a
                  href={p.portfolio_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  <ExternalLink className="size-4 text-portal-primary shrink-0" />
                  {t('competitions.portal.participants.viewPortfolio', 'View Portfolio')}
                  <span className="ml-auto text-xs text-portal-secondary truncate max-w-[140px]">{getHostname(p.portfolio_url)}</span>
                </a>
              )}
              {p.office_hours_url && (
                <a
                  href={p.office_hours_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  <ExternalLink className="size-4 text-portal-primary shrink-0" />
                  {t('competitions.portal.participants.bookOfficeHours', 'Book Office Hours')}
                  <span className="ml-auto text-xs text-portal-secondary truncate max-w-[140px]">{getHostname(p.office_hours_url)}</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-white/10 flex gap-2">
          {canInvite && (
            <Button
              type="button"
              onClick={() => onInvite(p.customer_user_id)}
              disabled={invitingId === p.customer_user_id}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <UserPlus className="size-4" />
              {invitingId === p.customer_user_id
                ? t('competitions.portal.participants.inviting', 'Sending...')
                : t('competitions.portal.participants.inviteToTeam', 'Invite to Team')}
            </Button>
          )}
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            className={cn(!canInvite && 'flex-1')}
          >
            {t('competitions.portal.participants.close', 'Close')}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ---------- participant card ---------- */

function ParticipantCard({
  p,
  onViewProfile,
  canInvite,
  onInvite,
  invitingId,
}: {
  p: Participant
  onViewProfile: () => void
  canInvite: boolean
  onInvite: (userId: string) => void
  invitingId: string | null
}) {
  const t = useT()
  const initials = p.display_name
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const avatarColors = avatarColorsByRole[p.role] ?? 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-slate-300'
  const badgeVariant = roleBadgeVariant[p.role] ?? ('default' as const)
  const roleLabel = t(`competitions.portal.participants.role.${p.role}`, p.role)

  return (
    <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-3 sm:p-5">
      {/* Header: Avatar + Name + Email */}
      <div className="flex items-start gap-3 mb-3">
        <div className="shrink-0">
          {p.avatar_url ? (
            <img src={p.avatar_url} alt={p.display_name} className="size-11 rounded-full object-cover" />
          ) : (
            <div className={cn('flex size-11 items-center justify-center rounded-full text-sm font-bold', avatarColors)}>
              {initials}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate text-foreground">{p.display_name}</h3>
            {p.looking_for_team && (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-green-700">
                <Users className="size-2.5" />
                {t('competitions.portal.participants.lookingForTeamShort', 'LFT')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Role Badge + Organization */}
      <div className="flex items-center gap-2 mb-3">
        <PortalBadge variant={badgeVariant}>{roleLabel}</PortalBadge>
        {p.organization && (
          <>
            <span className="text-gray-300 dark:text-slate-600">&middot;</span>
            <span className="text-xs text-portal-secondary truncate">{p.organization}</span>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
          p.has_team ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600',
        )}>
          {p.has_team ? <Check className="size-3" /> : <Users className="size-3" />}
          {p.has_team
            ? t('competitions.portal.participants.inTeam', 'In Team')
            : t('competitions.portal.participants.noTeam', 'No Team')}
        </span>
      </div>

      {/* Skills Tags */}
      {p.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {p.skills.slice(0, 4).map((skill) => (
            <span key={skill} className="inline-flex items-center rounded-full bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-[11px] text-gray-600 dark:text-slate-400 max-w-[150px] truncate">
              {skill}
            </span>
          ))}
          {p.skills.length > 4 && (
            <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-[11px] text-gray-500 dark:text-slate-400">
              +{p.skills.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Bottom Row */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-white/5">
        <button
          type="button"
          onClick={onViewProfile}
          className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-portal-primary hover:text-portal-primary-light transition-colors"
        >
          {t('competitions.portal.participants.viewProfile', 'View Profile')}
          <span className="text-xs">&rarr;</span>
        </button>
        {canInvite ? (
          <Button
            type="button"
            onClick={() => onInvite(p.customer_user_id)}
            disabled={invitingId === p.customer_user_id}
            size="sm"
            className="bg-green-600 text-[11px] uppercase tracking-wide hover:bg-green-700"
          >
            <UserPlus className="size-3.5" />
            {invitingId === p.customer_user_id
              ? t('competitions.portal.participants.inviting', 'Sending...')
              : t('competitions.portal.participants.invite', 'Invite')}
          </Button>
        ) : (
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
            aria-label={t('competitions.portal.participants.messageAria', 'Message {name}', { name: p.display_name })}
          >
            <MessageCircle className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}

/* ---------- filter pills ---------- */

type FilterOption = { id: string; label: string; count: number }

function SkillsFilter({
  availableSkills,
  selectedSkills,
  onToggleSkill,
  onClear,
}: {
  availableSkills: string[]
  selectedSkills: string[]
  onToggleSkill: (skill: string) => void
  onClear: () => void
}) {
  const t = useT()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2 rounded-full">
          <SlidersHorizontal className="size-4" />
          {t('competitions.portal.participants.skillsFilter', 'Skills')}
          {selectedSkills.length > 0 && (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-portal-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
              {selectedSkills.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="end">
        <div className="border-b border-gray-100 px-4 py-3 dark:border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t('competitions.portal.participants.skillsFilter', 'Skills')}
              </p>
              <p className="text-xs text-portal-secondary">
                {t('competitions.portal.participants.skillsFilterHint', 'Select one or more skills')}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={selectedSkills.length === 0}
              className="h-auto px-2 py-1 text-xs"
            >
              {t('common.clear', 'Clear')}
            </Button>
          </div>
        </div>

        {availableSkills.length === 0 ? (
          <div className="px-4 py-5 text-sm text-portal-secondary">
            {t('competitions.portal.participants.skillsFilterEmpty', 'No skills available yet')}
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto px-2 py-2">
            {availableSkills.map((skill) => {
              const checked = selectedSkills.includes(skill)
              return (
                <label
                  key={skill}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <Checkbox checked={checked} onCheckedChange={() => onToggleSkill(skill)} />
                  <span className="min-w-0 flex-1 truncate text-foreground">{skill}</span>
                </label>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function FilterPills({
  filters,
  activeFilter,
  onFilterChange,
  lookingForTeamCount,
  showLookingForTeam,
  onToggleLookingForTeam,
}: {
  filters: FilterOption[]
  activeFilter: string
  onFilterChange: (id: string) => void
  lookingForTeamCount: number
  showLookingForTeam: boolean
  onToggleLookingForTeam: () => void
}) {
  const t = useT()
  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-1.5 flex-nowrap">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilterChange(f.id)}
            className={cn(
              'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors',
              activeFilter === f.id
                ? 'bg-portal-primary text-white'
                : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-white/15',
            )}
          >
            {f.label}
            <span className={cn(
              'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold',
              activeFilter === f.id ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-slate-400',
            )}>
              {f.count}
            </span>
          </button>
        ))}
        {lookingForTeamCount > 0 && (
          <button
            type="button"
            onClick={onToggleLookingForTeam}
            className={cn(
              'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors',
              showLookingForTeam
                ? 'bg-green-600 text-white'
                : 'bg-green-50 text-green-700 hover:bg-green-100',
            )}
          >
            <Users className="size-3" />
            {t('competitions.portal.participants.lookingForTeam', 'Looking for Team')}
            <span className={cn(
              'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold',
              showLookingForTeam ? 'bg-white/20 text-white' : 'bg-green-100 text-green-600',
            )}>
              {lookingForTeamCount}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

/* ---------- participants content ---------- */

function ParticipantsContent() {
  const t = useT()
  const { auth } = usePortalContext()
  const { selectedId, isLoading: contextLoading } = useCompetitionContext()
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE)
  const [roleFilter, setRoleFilter] = React.useState('all')
  const [showLookingForTeam, setShowLookingForTeam] = React.useState(false)
  const [selectedSkills, setSelectedSkills] = React.useState<string[]>([])
  const [selectedParticipant, setSelectedParticipant] = React.useState<Participant | null>(null)
  const [inviteTarget, setInviteTarget] = React.useState<Participant | null>(null)
  const [invitingId, setInvitingId] = React.useState<string | null>(null)

  // Fetch my team membership for invite functionality
  const { data: membershipData } = useQuery({
    queryKey: ['portal-my-membership-participants', selectedId],
    queryFn: async () => {
      if (!selectedId) return null
      const { ok, result } = await apiCall<{ membership: { team_id: string; role: string } | null }>(
        `/api/teams/portal/my-membership?competition_id=${selectedId}`,
      )
      return ok && result?.membership ? result.membership : null
    },
    enabled: !!selectedId,
  })

  const myTeamId = membershipData?.team_id ?? null
  const isTeamOwner = membershipData?.role === 'owner'

  async function handleInvite(userId: string, message?: string) {
    if (!myTeamId) return
    setInvitingId(userId)
    try {
      const { ok, result } = await apiCall<{ ok: boolean; error?: string }>('/api/teams/portal/invite-member', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ team_id: myTeamId, invitee_id: userId, message: message?.trim() || undefined }),
      })
      if (ok) {
        flash(t('competitions.portal.participants.flash.invitationSent', 'Invitation sent!'), 'success')
        setSelectedParticipant(null)
        setInviteTarget(null)
      } else {
        flash(result?.error ?? t('competitions.portal.participants.flash.invitationFailed', 'Failed to send invitation'), 'error')
      }
    } finally {
      setInvitingId(null)
    }
  }

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  React.useEffect(() => { setVisibleCount(PAGE_SIZE) }, [debouncedSearch, roleFilter, selectedSkills, showLookingForTeam])

  const { data, isLoading } = useQuery({
    queryKey: ['portal-participants', selectedId],
    queryFn: async () => {
      if (!selectedId) return { items: [] as Participant[] }
      const { ok, result } = await apiCall<{ items: Participant[] }>(
        `/api/competitions/portal/participants?competition_id=${selectedId}`,
      )
      if (!ok || !result) throw new Error(t('competitions.portal.participants.errors.load', 'Failed to load participants'))
      return result
    },
    enabled: !!selectedId,
  })

  const allParticipants = data?.items ?? []

  const roleFilters = React.useMemo<FilterOption[]>(() => {
    const roleCounts: Record<string, number> = {}
    for (const p of allParticipants) {
      const role = p.role || 'participant'
      roleCounts[role] = (roleCounts[role] ?? 0) + 1
    }
    const filters: FilterOption[] = [{ id: 'all', label: t('competitions.portal.participants.filter.all', 'All'), count: allParticipants.length }]
    const sortedRoles = Object.keys(roleCounts).sort((a, b) => {
      if (a === 'participant') return -1
      if (b === 'participant') return 1
      return a.localeCompare(b)
    })
    for (const role of sortedRoles) {
      filters.push({
        id: role,
        label: t(`competitions.portal.participants.filter.${role}`, role.charAt(0).toUpperCase() + role.slice(1) + 's'),
        count: roleCounts[role],
      })
    }
    return filters
  }, [allParticipants, t])

  const lookingForTeamCount = React.useMemo(() => allParticipants.filter(p => p.looking_for_team).length, [allParticipants])

  const availableSkills = React.useMemo(() => {
    const byNormalized = new Map<string, string>()

    for (const participant of allParticipants) {
      for (const skill of participant.skills) {
        const trimmed = skill.trim()
        if (!trimmed) continue
        const normalized = trimmed.toLocaleLowerCase()
        if (!byNormalized.has(normalized)) {
          byNormalized.set(normalized, trimmed)
        }
      }
    }

    return [...byNormalized.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [allParticipants])

  const filteredParticipants = React.useMemo(() => {
    let result = allParticipants
    const normalizedSearch = debouncedSearch.trim().toLowerCase()

    if (normalizedSearch.length >= 2) {
      result = result.filter((participant) => {
        const haystacks = [
          participant.display_name,
          participant.organization ?? '',
          participant.specialty ?? '',
          ...participant.skills,
        ]

        return haystacks.some(value => value.toLowerCase().includes(normalizedSearch))
      })
    }

    if (selectedSkills.length > 0) {
      result = result.filter((participant) => {
        const participantSkills = new Set(participant.skills.map(skill => skill.trim().toLocaleLowerCase()))
        return selectedSkills.some(skill => participantSkills.has(skill.toLocaleLowerCase()))
      })
    }

    if (roleFilter !== 'all') result = result.filter(p => p.role === roleFilter)
    if (showLookingForTeam) result = result.filter(p => p.looking_for_team)
    return result
  }, [allParticipants, debouncedSearch, roleFilter, selectedSkills, showLookingForTeam])

  const currentUserId = auth.user?.id ?? null

  function toggleSelectedSkill(skill: string) {
    setSelectedSkills((current) => (
      current.includes(skill)
        ? current.filter((value) => value !== skill)
        : [...current, skill].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    ))
  }

  const visibleParticipants = filteredParticipants.slice(0, visibleCount)
  const hasMore = visibleCount < filteredParticipants.length

  if (contextLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-48 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!selectedId) {
    return <PortalEmptyState title={t('competitions.portal.participants.noCompetition', 'Select a competition')} description={t('competitions.portal.participants.noCompetitionDesc', 'Choose a competition to view its participants.')} />
  }

  return (
    <div className="space-y-5">
      {inviteTarget && (
        <InviteParticipantModal
          participant={inviteTarget}
          onClose={() => setInviteTarget(null)}
          onSubmit={async (userId, message) => { await handleInvite(userId, message) }}
          invitingId={invitingId}
        />
      )}

      {/* Profile Modal */}
      {selectedParticipant && (
        <ProfileModal
          participant={selectedParticipant}
          onClose={() => setSelectedParticipant(null)}
          myTeamId={isTeamOwner ? myTeamId : null}
          onInvite={(userId) => {
            const participant = allParticipants.find(item => item.customer_user_id === userId)
            if (participant) setInviteTarget(participant)
          }}
          invitingId={invitingId}
        />
      )}

      {/* Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 dark:text-slate-500" />
          <Input
            placeholder={t('competitions.portal.participants.searchPlaceholder', 'Search participants by name or skill...')}
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <SkillsFilter
          availableSkills={availableSkills}
          selectedSkills={selectedSkills}
          onToggleSkill={toggleSelectedSkill}
          onClear={() => setSelectedSkills([])}
        />
      </div>

      {selectedSkills.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {selectedSkills.map((skill) => (
            <button
              key={skill}
              type="button"
              onClick={() => toggleSelectedSkill(skill)}
              className="inline-flex items-center gap-1 rounded-full bg-portal-primary/10 px-3 py-1 text-xs font-medium text-portal-primary transition-colors hover:bg-portal-primary/15"
            >
              {skill}
              <X className="size-3" />
            </button>
          ))}
        </div>
      )}

      {/* Dynamic Filters */}
      {!isLoading && allParticipants.length > 0 && (
        <FilterPills
          filters={roleFilters}
          activeFilter={roleFilter}
          onFilterChange={setRoleFilter}
          lookingForTeamCount={lookingForTeamCount}
          showLookingForTeam={showLookingForTeam}
          onToggleLookingForTeam={() => setShowLookingForTeam(prev => !prev)}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && filteredParticipants.length === 0 && (
        <PortalEmptyState
          title={t('competitions.portal.participants.empty', 'No participants found')}
          description={
            debouncedSearch || roleFilter !== 'all' || showLookingForTeam
              || selectedSkills.length > 0
              ? t('competitions.portal.participants.emptySearch', 'Try adjusting your search or filters.')
              : t('competitions.portal.participants.emptyDesc', 'No one has joined this competition yet.')
          }
        />
      )}

      {/* Cards Grid */}
      {!isLoading && filteredParticipants.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleParticipants.map((p) => (
              <ParticipantCard
                key={p.customer_user_id}
                p={p}
                onViewProfile={() => setSelectedParticipant(p)}
                canInvite={Boolean(isTeamOwner && myTeamId && !p.has_team && p.customer_user_id !== currentUserId)}
                onInvite={(userId) => {
                  const participant = allParticipants.find(item => item.customer_user_id === userId)
                  if (participant) setInviteTarget(participant)
                }}
                invitingId={invitingId}
              />
            ))}
          </div>

          <div className="flex flex-col items-center gap-2 pt-2">
            {hasMore && (
              <button
                type="button"
                onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                className="inline-flex items-center rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-6 py-2.5 text-sm font-medium text-foreground hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                {t('competitions.portal.participants.loadMore', 'Load More Participants')}
              </button>
            )}
            <p className="text-xs text-portal-secondary">
              {t('competitions.portal.participants.showing', 'Showing {visible} of {filtered} participants', {
                visible: visibleParticipants.length,
                filtered: filteredParticipants.length,
              })}
              {filteredParticipants.length !== allParticipants.length
                && ` ${t('competitions.portal.participants.total', '({total} total)', { total: allParticipants.length })}`}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

/* ---------- page component ---------- */

export default function ParticipantsPortalPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <PortalCompetitionLayout>
      <PortalPageTitle
        label={t('competitions.portal.participants.page.label', 'Network Hub')}
        title={t('competitions.portal.participants.page.title', 'Participants Directory')}
      />
      <ParticipantsContent />
    </PortalCompetitionLayout>
  )
}
