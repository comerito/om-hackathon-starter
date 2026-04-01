"use client"

import * as React from 'react'
import Link from 'next/link'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { ArrowRight, CalendarDays, Check, ClipboardList, Rocket, Trophy, Users, X } from 'lucide-react'

type CompetitionGuideDrawerProps = {
  open: boolean
  onClose: () => void
  orgSlug: string
  currentStage?: string | null
}

const stageOrder = ['open', 'team_formation', 'track_selection', 'hacking', 'demos', 'deliberation', 'finished'] as const

function getStageState(stageId: string, currentStage?: string | null): 'completed' | 'current' | 'upcoming' {
  const currentIndex = currentStage ? stageOrder.indexOf(currentStage as typeof stageOrder[number]) : -1
  const stageIndex = stageOrder.indexOf(stageId as typeof stageOrder[number])

  if (currentIndex === -1 || stageIndex === -1) {
    return 'upcoming'
  }
  if (stageIndex < currentIndex) return 'completed'
  if (stageIndex === currentIndex) return 'current'
  return 'upcoming'
}

function formatStateLabel(
  state: 'completed' | 'current' | 'upcoming',
  t: ReturnType<typeof useT>,
): string {
  if (state === 'completed') return t('portal.drawer.guide.state.completed', 'Completed')
  if (state === 'current') return t('portal.drawer.guide.state.current', 'Current Stage')
  return t('portal.drawer.guide.state.upcoming', 'Upcoming')
}

export function CompetitionGuideDrawer({
  open,
  onClose,
  orgSlug,
  currentStage,
}: CompetitionGuideDrawerProps) {
  const t = useT()
  const locale = useLocale()

  const stages = [
    {
      id: 'open',
      icon: ClipboardList,
      title: t('portal.drawer.guide.stages.open.title', 'Registration & Onboarding'),
      summary: t(
        'portal.drawer.guide.stages.open.summary',
        'Participants join the competition, accept the rules, and get access to the portal, announcements, and core resources.',
      ),
      tasks: [
        t('portal.drawer.guide.stages.open.task1', 'Complete your profile and review the competition rules.'),
        t('portal.drawer.guide.stages.open.task2', 'Check announcements, agenda items, and key deadlines.'),
        t('portal.drawer.guide.stages.open.task3', 'Confirm participation before the active work stages begin.'),
      ],
    },
    {
      id: 'team_formation',
      icon: Users,
      title: t('portal.drawer.guide.stages.teamFormation.title', 'Team Formation'),
      summary: t(
        'portal.drawer.guide.stages.teamFormation.summary',
        'Participants connect with others, form teams, and make sure each team has the right mix of skills before building starts.',
      ),
      tasks: [
        t('portal.drawer.guide.stages.teamFormation.task1', 'Create or join a team in the portal.'),
        t('portal.drawer.guide.stages.teamFormation.task2', 'Invite teammates and align on your working plan.'),
        t('portal.drawer.guide.stages.teamFormation.task3', 'Define ownership for product, design, and technical work.'),
      ],
    },
    {
      id: 'track_selection',
      icon: CalendarDays,
      title: t('portal.drawer.guide.stages.trackSelection.title', 'Track Selection'),
      summary: t(
        'portal.drawer.guide.stages.trackSelection.summary',
        'Teams choose the challenge or track they want to compete in and validate that their idea matches the track expectations.',
      ),
      tasks: [
        t('portal.drawer.guide.stages.trackSelection.task1', 'Review available tracks, themes, and judging criteria.'),
        t('portal.drawer.guide.stages.trackSelection.task2', 'Select the track that best fits your solution.'),
        t('portal.drawer.guide.stages.trackSelection.task3', 'Refine the project direction around the chosen challenge.'),
      ],
    },
    {
      id: 'hacking',
      icon: Rocket,
      title: t('portal.drawer.guide.stages.hacking.title', 'Build & Iterate'),
      summary: t(
        'portal.drawer.guide.stages.hacking.summary',
        'This is the main execution phase: teams validate the idea, build the solution, collect feedback, and prepare the final deliverables.',
      ),
      tasks: [
        t('portal.drawer.guide.stages.hacking.task1', 'Build the MVP and document the problem, solution, and impact.'),
        t('portal.drawer.guide.stages.hacking.task2', 'Track milestone deadlines and respond to organizer updates.'),
        t('portal.drawer.guide.stages.hacking.task3', 'Prepare your repository, demo story, and submission materials.'),
      ],
    },
    {
      id: 'demos',
      icon: Trophy,
      title: t('portal.drawer.guide.stages.demos.title', 'Submission & Demo Day'),
      summary: t(
        'portal.drawer.guide.stages.demos.summary',
        'Teams finalize the project submission, deliver the required assets, and present their work during the demo stage.',
      ),
      tasks: [
        t('portal.drawer.guide.stages.demos.task1', 'Submit the final project information before the deadline.'),
        t('portal.drawer.guide.stages.demos.task2', 'Make sure the repository, links, and presentation assets are complete.'),
        t('portal.drawer.guide.stages.demos.task3', 'Present the project clearly, focusing on value, execution, and outcomes.'),
      ],
    },
    {
      id: 'deliberation',
      icon: Check,
      title: t('portal.drawer.guide.stages.deliberation.title', 'Judging & Review'),
      summary: t(
        'portal.drawer.guide.stages.deliberation.summary',
        'Judges review submissions, compare teams against the criteria, and determine finalists or winners for each track.',
      ),
      tasks: [
        t('portal.drawer.guide.stages.deliberation.task1', 'Stay available in case organizers or judges request clarification.'),
        t('portal.drawer.guide.stages.deliberation.task2', 'Monitor announcements for finalist updates or next steps.'),
        t('portal.drawer.guide.stages.deliberation.task3', 'Keep your submission materials accessible until scoring is closed.'),
      ],
    },
    {
      id: 'finished',
      icon: Trophy,
      title: t('portal.drawer.guide.stages.finished.title', 'Results & Wrap-Up'),
      summary: t(
        'portal.drawer.guide.stages.finished.summary',
        'The competition closes with results, recognition, and any follow-up actions such as prize collection or post-event communication.',
      ),
      tasks: [
        t('portal.drawer.guide.stages.finished.task1', 'Review the published results and feedback.'),
        t('portal.drawer.guide.stages.finished.task2', 'Complete any organizer follow-up steps after the event.'),
        t('portal.drawer.guide.stages.finished.task3', 'Use the final materials to continue improving or sharing the project.'),
      ],
    },
  ]

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        className={cn(
          'fixed top-0 right-0 z-50 flex h-full w-full max-w-[760px] flex-col bg-portal-dark text-white shadow-2xl transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="border-b border-white/10 px-5 pb-5 pt-6 sm:px-8 sm:pb-6 sm:pt-8">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-portal-primary-light/90">
                {t('portal.drawer.guide.eyebrow', 'Competition Guide')}
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {t('portal.drawer.guide.title', 'How the competition works')}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-300">
                {t(
                  'portal.drawer.guide.subtitle',
                  'A clear walkthrough of every stage, what organizers expect, and what participants should prepare as the competition progresses.',
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
              aria-label={t('portal.drawer.guide.close', 'Close guide')}
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                {t('portal.drawer.guide.overview.structure', 'Structure')}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {t('portal.drawer.guide.overview.structureValue', '{count} key stages', { count: stages.length })}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                {t('portal.drawer.guide.overview.focus', 'Focus')}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {t('portal.drawer.guide.overview.focusValue', 'Deadlines, submissions, and stage expectations')}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                {t('portal.drawer.guide.overview.locale', 'Timezone')}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{locale}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
          <div className="relative">
            <div className="absolute left-[15px] top-3 bottom-3 hidden w-px bg-white/10 sm:block" />

            <div className="space-y-4">
              {stages.map((stage, index) => {
                const state = getStageState(stage.id, currentStage)
                const Icon = stage.icon

                return (
                  <div key={stage.id} className="relative flex gap-4">
                    <div className="relative z-10 hidden shrink-0 sm:block">
                      <div
                        className={cn(
                          'flex size-8 items-center justify-center rounded-full border',
                          state === 'completed' && 'border-portal-primary bg-portal-primary text-white',
                          state === 'current' && 'border-portal-primary bg-white text-portal-primary shadow-[0_0_0_5px_rgba(110,101,255,0.18)]',
                          state === 'upcoming' && 'border-white/10 bg-white/5 text-gray-400',
                        )}
                      >
                        {state === 'completed' ? <Check className="size-4" strokeWidth={3} /> : <Icon className="size-4" />}
                      </div>
                    </div>

                    <div
                      className={cn(
                        'flex-1 rounded-3xl border px-4 py-4 sm:px-5',
                        state === 'current' && 'border-portal-primary/40 bg-gradient-to-br from-white/10 to-portal-primary/10',
                        state === 'completed' && 'border-white/10 bg-white/5',
                        state === 'upcoming' && 'border-white/10 bg-white/[0.03]',
                      )}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-300">
                              {t('portal.drawer.guide.stageLabel', 'Stage')} {index + 1}
                            </span>
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
                                state === 'current' && 'bg-portal-primary/20 text-portal-primary-light',
                                state === 'completed' && 'bg-emerald-500/15 text-emerald-300',
                                state === 'upcoming' && 'bg-white/5 text-gray-400',
                              )}
                            >
                              {formatStateLabel(state, t)}
                            </span>
                          </div>
                          <h3 className="mt-3 text-lg font-bold text-white sm:text-xl">{stage.title}</h3>
                          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-300">{stage.summary}</p>
                        </div>
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-portal-primary-light">
                          <Icon className="size-5" />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2">
                        {stage.tasks.map((task) => (
                          <div
                            key={task}
                            className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/10 px-3 py-3"
                          >
                            <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-portal-primary-light">
                              <Check className="size-3.5" />
                            </div>
                            <p className="text-sm leading-relaxed text-gray-200">{task}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 px-5 py-5 sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-sm leading-relaxed text-gray-300">
              {t(
                'portal.drawer.guide.footer',
                'Use the dashboard for announcements and deadlines, the competition page for tracks and rules, and the project page when it is time to submit your final work.',
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/${orgSlug}/portal/competition`}
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              >
                {t('portal.drawer.guide.actions.viewCompetition', 'View Competition')}
              </Link>
              <Link
                href={`/${orgSlug}/portal/project`}
                className="inline-flex items-center justify-center rounded-xl bg-portal-primary px-4 py-2 text-sm font-semibold text-white hover:bg-portal-primary-light transition-colors"
              >
                {t('portal.drawer.guide.actions.openProject', 'Open Project')}
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
