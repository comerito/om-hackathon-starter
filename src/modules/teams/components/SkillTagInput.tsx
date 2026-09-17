"use client"
import * as React from 'react'
import { Input } from '@open-mercato/ui/primitives/input'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { X } from 'lucide-react'
import { MAX_NEEDED_SKILLS, normalizeNeededSkills } from '../lib/recruitment'

/**
 * Chip editor for the skills a team is recruiting for.
 *
 * Enter, Tab and comma all commit the current word — people type skills as a comma-separated
 * list out of habit, and losing "React, Go" to a single chip is the kind of small betrayal that
 * makes a form feel broken. Backspace on an empty input removes the last chip.
 *
 * Normalisation is delegated to `lib/recruitment` so the chip you see is exactly the value the
 * API will store.
 */
export function SkillTagInput({
  value,
  onChange,
  disabled = false,
  placeholder,
  inputId,
}: {
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  placeholder?: string
  inputId?: string
}) {
  const t = useT()
  const [draft, setDraft] = React.useState('')
  const atCapacity = value.length >= MAX_NEEDED_SKILLS

  function commit(raw: string) {
    const next = normalizeNeededSkills([...value, raw])
    if (next.length !== value.length) onChange(next)
    setDraft('')
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
      if (!draft.trim()) return
      // Tab still moves focus when there is nothing to commit; only swallow it when it means
      // "finish this chip".
      event.preventDefault()
      commit(draft)
      return
    }
    if (event.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value
    // Pasting "React, Go, Postgres" should produce three chips, not one long one.
    if (raw.includes(',')) {
      const parts = raw.split(',')
      const tail = parts.pop() ?? ''
      const next = normalizeNeededSkills([...value, ...parts])
      if (next.length !== value.length) onChange(next)
      setDraft(tail)
      return
    }
    setDraft(raw)
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 rounded-full bg-portal-primary/10 px-2.5 py-1 text-xs font-medium text-portal-primary"
            >
              <span className="max-w-[160px] truncate">{skill}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((entry) => entry !== skill))}
                disabled={disabled}
                aria-label={t('teams.portal.recruitment.removeSkill', 'Remove {skill}', { skill })}
                className="text-portal-primary/70 transition-colors hover:text-portal-primary disabled:cursor-not-allowed"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        id={inputId}
        type="text"
        autoComplete="off"
        value={draft}
        disabled={disabled || atCapacity}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (draft.trim()) commit(draft) }}
        placeholder={atCapacity
          ? t('teams.portal.recruitment.skillsFull', 'Maximum {max} skills', { max: MAX_NEEDED_SKILLS })
          : placeholder ?? t('teams.portal.recruitment.skillsPlaceholder', 'e.g. React, Postgres, Figma')}
        className="rounded-xl text-sm"
      />
      <p className="mt-1 text-[11px] text-portal-secondary">
        {t('teams.portal.recruitment.skillsHint', 'Press Enter or comma after each skill.')}
      </p>
    </div>
  )
}
