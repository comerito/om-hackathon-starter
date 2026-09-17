"use client"
import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Search } from 'lucide-react'
import { SectionLabel, PortalBadge, ToggleSwitch } from '@/components/portal'
import { MAX_RECRUITMENT_NOTE_LENGTH, normalizeNeededSkills } from '../lib/recruitment'
import { SkillTagInput } from './SkillTagInput'

export type TeamRecruitment = {
  looking_for_members: boolean
  needed_skills: string[]
  recruitment_note: string | null
}

/**
 * The team-side counterpart of a participant's "I'm looking for a team" toggle.
 *
 * Owners edit it; everyone on the team can see what the team is advertising, because a member
 * who does not know what the team is asking for cannot help fill the gap.
 */
export function TeamRecruitmentCard({
  teamId,
  isOwner,
  recruitment,
}: {
  teamId: string
  isOwner: boolean
  recruitment: TeamRecruitment
}) {
  const t = useT()
  const queryClient = useQueryClient()

  const [lookingForMembers, setLookingForMembers] = React.useState(recruitment.looking_for_members)
  const [skills, setSkills] = React.useState<string[]>(() => normalizeNeededSkills(recruitment.needed_skills))
  const [note, setNote] = React.useState(recruitment.recruitment_note ?? '')
  const [saving, setSaving] = React.useState(false)

  // The posting can also change from elsewhere (another owner tab, a refetch), so follow the
  // server value whenever it actually differs from what is on screen.
  const serverSnapshot = JSON.stringify([
    recruitment.looking_for_members,
    normalizeNeededSkills(recruitment.needed_skills),
    recruitment.recruitment_note ?? '',
  ])
  React.useEffect(() => {
    const [nextLooking, nextSkills, nextNote] = JSON.parse(serverSnapshot) as [boolean, string[], string]
    setLookingForMembers(nextLooking)
    setSkills(nextSkills)
    setNote(nextNote)
  }, [serverSnapshot])

  const dirty = JSON.stringify([lookingForMembers, skills, note]) !== JSON.stringify([
    recruitment.looking_for_members,
    normalizeNeededSkills(recruitment.needed_skills),
    recruitment.recruitment_note ?? '',
  ])

  async function save(next: { lookingForMembers: boolean; skills: string[]; note: string }) {
    setSaving(true)
    try {
      const { ok, result } = await apiCall<{ ok?: boolean; error?: string }>('/api/teams/portal/update-recruitment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          team_id: teamId,
          looking_for_members: next.lookingForMembers,
          needed_skills: next.skills,
          recruitment_note: next.note.trim() || null,
        }),
      })
      if (ok) {
        flash(next.lookingForMembers
          ? t('teams.portal.recruitment.saved', 'Your team is listed as looking for members.')
          : t('teams.portal.recruitment.closed', 'Your team is no longer listed as recruiting.'), 'success')
        queryClient.invalidateQueries({ queryKey: ['portal-my-membership'] })
        queryClient.invalidateQueries({ queryKey: ['portal-teams'] })
      } else {
        flash(result?.error ?? t('teams.portal.recruitment.saveFailed', 'Failed to update the posting'), 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  function handleToggle(checked: boolean) {
    setLookingForMembers(checked)
    // The toggle is the whole feature for somebody who just wants to say "we have room", so it
    // saves on its own instead of waiting for a Save press they may never make.
    void save({ lookingForMembers: checked, skills, note })
  }

  if (!isOwner) {
    if (!recruitment.looking_for_members) return null
    const shownSkills = normalizeNeededSkills(recruitment.needed_skills)
    return (
      <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6">
        <div className="mb-3 flex items-center gap-3">
          <SectionLabel>{t('teams.portal.recruitment.title', 'Looking for teammates')}</SectionLabel>
          <PortalBadge variant="primary">{t('teams.portal.recruitment.open', 'Open')}</PortalBadge>
        </div>
        {shownSkills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {shownSkills.map((skill) => (
              <span key={skill} className="inline-flex items-center rounded-full bg-portal-primary/10 px-2.5 py-1 text-xs font-medium text-portal-primary">
                {skill}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-portal-secondary">
            {t('teams.portal.recruitment.openNoSkills', 'Your team is open to new members.')}
          </p>
        )}
        {recruitment.recruitment_note && (
          <p className="mt-3 text-sm text-portal-secondary">{recruitment.recruitment_note}</p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <SectionLabel className="block">{t('teams.portal.recruitment.title', 'Looking for teammates')}</SectionLabel>
          <p className="mt-1 text-xs text-portal-secondary">
            {t(
              'teams.portal.recruitment.subtitle',
              'Say which skills you need and your team shows up for everyone browsing teams — no need to know anyone by name.',
            )}
          </p>
        </div>
        <ToggleSwitch checked={lookingForMembers} onChange={handleToggle} disabled={saving} />
      </div>

      {lookingForMembers && (
        <div className="space-y-4">
          <div>
            <label htmlFor="team-needed-skills" className="mb-1 block text-xs font-medium text-portal-secondary">
              {t('teams.portal.recruitment.skillsLabel', 'Skills you are looking for')}
            </label>
            <SkillTagInput inputId="team-needed-skills" value={skills} onChange={setSkills} disabled={saving} />
          </div>

          <div>
            <label htmlFor="team-recruitment-note" className="mb-1 block text-xs font-medium text-portal-secondary">
              {t('teams.portal.recruitment.noteLabel', 'Anything else? (optional)')}
            </label>
            <textarea
              id="team-recruitment-note"
              value={note}
              maxLength={MAX_RECRUITMENT_NOTE_LENGTH}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t('teams.portal.recruitment.notePlaceholder', 'We are building a logistics dashboard and need a frontend dev.')}
              className="min-h-[60px] w-full rounded-xl border border-gray-200 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-portal-primary dark:border-white/10 dark:placeholder:text-slate-500"
              rows={2}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => void save({ lookingForMembers, skills, note })}
              disabled={saving || !dirty}
              className="bg-portal-primary hover:bg-portal-primary/90"
            >
              {saving ? t('common.saving', 'Saving...') : t('teams.portal.recruitment.save', 'Save posting')}
            </Button>
            {skills.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-portal-secondary">
                <Search className="size-3.5" />
                {t('teams.portal.recruitment.matchHint', 'Matching people appear under Invite Member.')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
