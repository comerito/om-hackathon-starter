"use client"

import * as React from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@open-mercato/shared/lib/utils'

type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'om-theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export function PortalThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = React.useState<Theme>('system')

  React.useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored)
    } else {
      setTheme('system')
    }
  }, [])

  React.useEffect(() => {
    applyTheme(theme)
    if (theme === 'system') {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, theme)
    }

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => applyTheme('system')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  const cycle = React.useCallback(() => {
    setTheme((prev) => {
      if (prev === 'light') return 'dark'
      if (prev === 'dark') return 'system'
      return 'light'
    })
  }, [])

  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor
  const label = theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'Auto'

  return (
    <button
      type="button"
      onClick={cycle}
      className={cn(
        'rounded-lg p-1.5 text-portal-secondary hover:bg-gray-100 dark:hover:bg-white/10 transition-colors',
        className,
      )}
      aria-label={`Theme: ${label}. Click to change.`}
      title={`Theme: ${label}`}
    >
      <Icon className="size-[18px]" />
    </button>
  )
}
