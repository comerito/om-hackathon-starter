"use client"
import * as React from 'react'
import { createPortal } from 'react-dom'
import { useCompetitionContext } from './CompetitionContext'
import { cn } from '@open-mercato/shared/lib/utils'

const stageLabels: Record<string, string> = {
  draft: 'Draft', open: 'Open', team_formation: 'Formation',
  track_selection: 'Tracks', hacking: 'Hacking', demos: 'Demos',
  deliberation: 'Judging', finished: 'Done', archived: 'Archived',
}

const stageColors: Record<string, string> = {
  draft: '#94a3b8', open: '#059669', team_formation: '#4F46E5',
  track_selection: '#4F46E5', hacking: '#D97706', demos: '#E11D48',
  deliberation: '#7C3AED', finished: '#059669', archived: '#94a3b8',
}

export function CompetitionSelector() {
  const { competitions, selected, selectedId, setSelectedId, isLoading } = useCompetitionContext()
  const [headerEl, setHeaderEl] = React.useState<Element | null>(null)
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const right = document.querySelector('[data-portal-handle="section:portal:header:actions"]')
    if (right) {
      setHeaderEl(right)
    } else {
      const header = document.querySelector('[data-portal-handle="section:portal:header"]')
      if (header) setHeaderEl(header)
    }
  }, [])

  React.useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  if (isLoading || competitions.length === 0) return null

  const stage = selected?.stage ?? 'draft'
  const dot = stageColors[stage] ?? '#94a3b8'

  const content = (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-all',
          open ? 'border-portal-primary/30 bg-portal-primary/5 shadow-sm' : 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-gray-300 dark:hover:border-white/20 hover:shadow-sm',
        )}
        aria-label="Select competition"
        aria-expanded={open}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40" style={{ backgroundColor: dot }} />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />
        </span>
        <span className="hidden sm:inline max-w-[120px] truncate font-medium text-foreground">{selected?.name ?? 'Select...'}</span>
        <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: dot }}>
          {stageLabels[stage] ?? stage}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={cn('text-gray-400 dark:text-slate-500 transition-transform', open && 'rotate-180')}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-slate-800 shadow-xl" style={{ animation: 'cssFadeIn 150ms ease-out' }}>
          <div className="px-3 py-2 border-b border-gray-50 dark:border-white/5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-portal-secondary/50">Switch Competition</p>
          </div>
          <div className="py-1 max-h-64 overflow-y-auto">
            {competitions.map((c) => {
              const active = c.id === selectedId
              const cc = stageColors[c.stage] ?? '#94a3b8'
              return (
                <button
                  key={c.id} type="button"
                  onClick={() => { setSelectedId(c.id); setOpen(false) }}
                  className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors', active ? 'bg-portal-primary/5' : 'hover:bg-gray-50 dark:hover:bg-white/5')}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cc }} />
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-medium truncate', active ? 'text-portal-primary' : 'text-foreground')}>{c.name}</p>
                    <p className="text-[10px] text-portal-secondary">{stageLabels[c.stage] ?? c.stage}{c.location ? ` · ${c.location}` : ''}</p>
                  </div>
                  {active && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-portal-primary"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <style>{`@keyframes cssFadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )

  if (headerEl) return createPortal(content, headerEl)
  return null
}
