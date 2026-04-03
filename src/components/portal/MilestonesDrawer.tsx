"use client"

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { Check, X, ExternalLink } from 'lucide-react'

type Milestone = {
  id: string
  name: string
  description: string | null
  due_date: string
  status: 'upcoming' | 'active' | 'completed'
}

type MilestonesDrawerProps = {
  competitionId: string | null
  open: boolean
  onClose: () => void
  orgSlug: string
  rulesUrl?: string | null
}

function formatDate(dateStr: string, locale: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' }).toUpperCase() + ', ' +
    d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

export function MilestonesDrawer({ competitionId, open, onClose, orgSlug, rulesUrl }: MilestonesDrawerProps) {
  const t = useT()
  const locale = useLocale()
  const { data } = useQuery({
    queryKey: ['portal-milestones-drawer', competitionId],
    queryFn: async () => {
      if (!competitionId) return { items: [] }
      const { ok, result } = await apiCall<{ items: Milestone[] }>(
        `/api/competitions/portal/competition-data?competition_id=${competitionId}&type=milestones`,
      )
      return ok && result ? result : { items: [] }
    },
    enabled: !!competitionId && open,
  })

  const milestones = data?.items ?? []

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer panel */}
      <div
        className={cn(
          'fixed top-0 right-0 z-50 flex h-full w-[calc(100vw-48px)] sm:w-[340px] flex-col bg-portal-dark text-white shadow-2xl transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 sm:px-6 pt-6 sm:pt-8 pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">{t('portal.drawer.milestones.title', 'Milestones')}</h2>
            <p className="text-sm text-gray-400 mt-1">{t('portal.drawer.milestones.subtitle', 'Hackathon Progress Journey')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {milestones.length === 0 ? (
            <p className="text-sm text-gray-500">{t('portal.drawer.milestones.empty', 'No milestones configured yet.')}</p>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[15px] top-3 bottom-3 w-[2px] bg-gray-700" />

              <div className="space-y-1">
                {milestones.map((milestone, i) => {
                  const isCompleted = milestone.status === 'completed'
                  const isActive = milestone.status === 'active'
                  const isUpcoming = milestone.status === 'upcoming'

                  return (
                    <div key={milestone.id} className="relative flex gap-4">
                      {/* Dot / check icon */}
                      <div className="relative z-10 shrink-0">
                        {isCompleted ? (
                          <div className="size-8 rounded-full bg-portal-primary flex items-center justify-center">
                            <Check className="size-4 text-white" strokeWidth={3} />
                          </div>
                        ) : isActive ? (
                          <div className="size-8 rounded-full bg-portal-primary flex items-center justify-center ring-4 ring-portal-primary/20">
                            <div className="size-3 rounded-full bg-white" />
                          </div>
                        ) : (
                          <div className="size-8 rounded-full bg-gray-700/60 flex items-center justify-center">
                            <div className="size-2.5 rounded-full bg-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Content card */}
                      <div
                        className={cn(
                          'flex-1 rounded-xl px-4 py-3 mb-4 transition-colors',
                          isActive
                            ? 'bg-white/10 border border-white/10'
                            : '',
                        )}
                      >
                        <h4
                          className={cn(
                            'text-sm font-bold',
                            isCompleted ? 'text-white' : isActive ? 'text-white' : 'text-gray-300',
                          )}
                        >
                          {milestone.name}
                        </h4>
                        <p
                          className={cn(
                            'text-[11px] font-medium mt-0.5',
                            isActive ? 'text-portal-primary-light' : 'text-gray-500',
                          )}
                        >
                          {isActive && (
                            <>
                              <span className="font-bold text-portal-primary-light">{formatDate(milestone.due_date, locale)}</span>
                              <span className="block uppercase tracking-wide text-portal-primary-light mt-0.5">{t('portal.drawer.milestones.currentPhase', 'Current Phase')}</span>
                            </>
                          )}
                          {!isActive && formatDate(milestone.due_date, locale)}
                        </p>
                        {milestone.description && (
                          <p className={cn(
                            'text-xs mt-1.5 leading-relaxed',
                            isUpcoming ? 'text-gray-500' : 'text-gray-400',
                          )}>
                            {milestone.description}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 space-y-4">
          {rulesUrl && (
            <a
              href={rulesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15 transition-colors"
            >
              {t('portal.drawer.milestones.viewRules', 'View Rules')} <ExternalLink className="size-4" />
            </a>
          )}
        </div>

        {/* Dot pattern decoration */}
        <div className="absolute bottom-0 right-0 w-24 h-24 opacity-10 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '8px 8px',
          }}
        />
      </div>
    </>
  )
}
