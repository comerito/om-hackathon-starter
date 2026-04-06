"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { CalendarDays, Check, ChevronRight, ClipboardList, Rocket, Trophy, Users, X } from 'lucide-react'

type CompetitionGuideDrawerProps = {
  open: boolean
  onClose: () => void
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

export function CompetitionGuideDrawer({ open, onClose, currentStage }: CompetitionGuideDrawerProps) {
  const t = useT()

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

  const currentIndex = currentStage ? stageOrder.indexOf(currentStage as typeof stageOrder[number]) : -1
  const completedCount = currentIndex === -1 ? 0 : currentIndex
  const progressPercent = Math.round((completedCount / stages.length) * 100)

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-full max-w-[760px] bg-portal-dark text-white shadow-2xl transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Floating close button — always visible */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-400 backdrop-blur-sm hover:bg-white/10 hover:text-white transition-all sm:right-6 sm:top-6"
          aria-label={t('portal.drawer.guide.close', 'Close guide')}
        >
          <X className="size-4" />
        </button>

        {/* Full-scroll container — header + stages all scroll together */}
        <div className="h-full overflow-y-auto">
          {/* Header */}
          <div className="px-5 pt-6 pb-0 sm:px-8 sm:pt-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-portal-primary-light">
              {t('portal.drawer.guide.eyebrow', 'Competition Guide')}
            </p>
            <h2 className="mt-3 pr-10 font-display text-2xl font-bold tracking-tight text-white sm:text-[28px] sm:leading-tight">
              {t('portal.drawer.guide.title', 'How the competition works')}
            </h2>
            <p className="mt-2.5 max-w-lg text-[13px] leading-relaxed text-gray-400">
              {t(
                'portal.drawer.guide.subtitle',
                'A clear walkthrough of every stage, what organizers expect, and what participants should prepare as the competition progresses.',
              )}
            </p>

            {/* Progress indicator */}
            <div className="mt-6 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                    {t('portal.drawer.guide.progress', 'Progress')}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums text-gray-400">
                    {completedCount}/{stages.length}
                  </span>
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-portal-primary to-portal-primary-light transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="mt-6 h-px bg-gradient-to-r from-white/10 via-white/5 to-transparent" />
          </div>

          {/* Stages timeline */}
          <div className="px-5 pt-5 pb-10 sm:px-8 sm:pb-14">
            <div className="relative">
              {/* Timeline spine */}
              <div className="absolute left-[15px] top-4 bottom-4 hidden w-px sm:block">
                <div className="h-full w-full bg-gradient-to-b from-portal-primary/30 via-white/10 to-white/5" />
              </div>

              <div className="space-y-3">
                {stages.map((stage, index) => {
                  const state = getStageState(stage.id, currentStage)
                  const Icon = stage.icon

                  return (
                    <div key={stage.id} className="group relative flex gap-4">
                      {/* Timeline node */}
                      <div className="relative z-10 hidden shrink-0 sm:block">
                        <div
                          className={cn(
                            'flex size-8 items-center justify-center rounded-full border transition-all',
                            state === 'completed' && 'border-emerald-500/50 bg-emerald-900 text-emerald-400',
                            state === 'current' && 'border-portal-primary bg-portal-primary text-white shadow-[0_0_12px_rgba(79,70,229,0.4)]',
                            state === 'upcoming' && 'border-white/8 bg-portal-dark text-gray-500',
                          )}
                        >
                          {state === 'completed' ? <Check className="size-3.5" strokeWidth={2.5} /> : <span className="text-[11px] font-bold tabular-nums">{index + 1}</span>}
                        </div>
                      </div>

                      {/* Stage card */}
                      <div
                        className={cn(
                          'flex-1 rounded-2xl border transition-all',
                          state === 'current' && 'border-portal-primary/30 bg-gradient-to-br from-portal-primary/[0.08] to-portal-primary/[0.02]',
                          state === 'completed' && 'border-white/8 bg-white/[0.03]',
                          state === 'upcoming' && 'border-white/8 bg-white/[0.025]',
                        )}
                      >
                        {/* Card header */}
                        <div className="px-4 pt-4 pb-3 sm:px-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em]',
                                  state === 'completed' && 'bg-emerald-500/10 text-emerald-400',
                                  state === 'current' && 'bg-portal-primary/15 text-portal-primary-light',
                                  state === 'upcoming' && 'bg-white/6 text-gray-400',
                                )}>
                                  {formatStateLabel(state, t)}
                                </span>
                              </div>
                              <h3 className={cn(
                                'mt-2 text-[15px] font-bold leading-snug sm:text-base',
                                state === 'upcoming' ? 'text-gray-300' : 'text-white',
                              )}>
                                {stage.title}
                              </h3>
                              <p className={cn(
                                'mt-1.5 text-[13px] leading-relaxed',
                                state === 'upcoming' ? 'text-gray-500' : 'text-gray-400',
                              )}>
                                {stage.summary}
                              </p>
                            </div>
                            <div className={cn(
                              'flex size-9 shrink-0 items-center justify-center rounded-xl border',
                              state === 'current' && 'border-portal-primary/30 bg-portal-primary/10 text-portal-primary-light',
                              state === 'completed' && 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400/70',
                              state === 'upcoming' && 'border-white/8 bg-white/[0.03] text-gray-500',
                            )}>
                              <Icon className="size-4" />
                            </div>
                          </div>
                        </div>

                        {/* Tasks */}
                        <div className={cn(
                          'border-t px-4 py-3 sm:px-5',
                          state === 'current' && 'border-portal-primary/15',
                          state === 'completed' && 'border-white/5',
                          state === 'upcoming' && 'border-white/5',
                        )}>
                          <div className="space-y-1.5">
                            {stage.tasks.map((task) => (
                              <div
                                key={task}
                                className="flex items-start gap-2.5"
                              >
                                <ChevronRight className={cn(
                                  'mt-0.5 size-3.5 shrink-0',
                                  state === 'completed' && 'text-emerald-500/40',
                                  state === 'current' && 'text-portal-primary-light/60',
                                  state === 'upcoming' && 'text-gray-600',
                                )} />
                                <p className={cn(
                                  'text-[12.5px] leading-relaxed',
                                  state === 'upcoming' ? 'text-gray-500' : 'text-gray-400',
                                )}>
                                  {task}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
