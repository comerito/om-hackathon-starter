"use client"

import * as React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'om-theme'

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function PortalThemeToggle({ className }: { className?: string }) {
  const t = useT()
  const [theme, setTheme] = React.useState<Theme>('light')

  React.useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored)
    } else {
      setTheme(getSystemTheme())
    }
  }, [])

  React.useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const cycle = React.useCallback(() => {
    setTheme((prev) => prev === 'light' ? 'dark' : 'light')
  }, [])

  const Icon = theme === 'dark' ? Moon : Sun
  const currentLabel = theme === 'dark'
    ? t('common.theme.dark', 'Dark')
    : t('common.theme.light', 'Light')
  const nextLabel = theme === 'dark'
    ? t('common.theme.light', 'Light')
    : t('common.theme.dark', 'Dark')
  const title = t('common.theme.toggleTo', 'Switch to {theme} theme', { theme: nextLabel })

  return (
    <button
      type="button"
      onClick={cycle}
      className={cn(
        'rounded-lg p-1.5 text-portal-secondary hover:bg-gray-100 dark:hover:bg-white/10 transition-colors',
        className,
      )}
      aria-label={`${t('common.theme.toggle', 'Toggle theme')}: ${currentLabel}. ${title}`}
      title={title}
    >
      <Icon className="size-[18px]" />
    </button>
  )
}
