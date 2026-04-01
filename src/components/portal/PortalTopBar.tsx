"use client"

import * as React from 'react'
import Link from 'next/link'
import { Settings, ArrowLeft, LogOut, Menu, X } from 'lucide-react'
import { PortalLocaleSwitcher } from './PortalLocaleSwitcher'
import { PortalThemeToggle } from './PortalThemeToggle'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalNotificationBell } from '@open-mercato/ui/portal/components/PortalNotificationBell'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'

type PortalTopBarProps = {
  variant?: 'full' | 'minimal' | 'topnav'
  /** Competition/section title shown in the top bar */
  title?: string
  /** User display name */
  userName?: string
  /** User role label */
  userRole?: string
  /** Back link for minimal variant */
  backHref?: string
  /** Inline nav links for topnav variant */
  navLinks?: Array<{ label: string; href: string; active?: boolean }>
  /** Toggle mobile menu */
  onMenuToggle?: () => void
  /** Whether mobile menu is open */
  mobileMenuOpen?: boolean
}

export function PortalTopBar({
  variant = 'full',
  title,
  userName,
  userRole,
  backHref,
  navLinks,
  onMenuToggle,
  mobileMenuOpen,
}: PortalTopBarProps) {
  const { auth, orgSlug } = usePortalContext()
  const t = useT()
  const displayName = userName || auth.user?.displayName || auth.user?.email || ''

  // Read participation role from CompetitionContext's localStorage (set by CompetitionProvider)
  const [participationRole, setParticipationRole] = React.useState<string | null>(null)
  React.useEffect(() => {
    setParticipationRole(localStorage.getItem('hackon:selected-competition-role'))
    function onStorage(e: StorageEvent) {
      if (e.key === 'hackon:selected-competition-role') setParticipationRole(e.newValue)
    }
    function onRoleChanged(e: Event) {
      const detail = (e as CustomEvent).detail as { role?: string } | undefined
      if (detail?.role) setParticipationRole(detail.role)
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('competition-role-changed', onRoleChanged)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('competition-role-changed', onRoleChanged)
    }
  }, [])
  const displayRole = userRole || participationRole || t('competitions.portal.topBar.defaultRole', 'Participant')
  const prefix = `/${orgSlug}/portal`
  return (
    <header className="sticky top-0 z-30 flex h-12 sm:h-14 items-center gap-2 sm:gap-4 border-b border-gray-100 dark:border-white/10 bg-white dark:bg-slate-900 px-3 sm:px-6" data-portal-handle="section:portal:header">
      {/* Hamburger toggle — visible below lg */}
      {onMenuToggle && (
        <button
          type="button"
          onClick={onMenuToggle}
          className="lg:hidden rounded-lg p-1.5 text-portal-secondary hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          aria-label={mobileMenuOpen
            ? t('competitions.portal.topBar.closeMenu', 'Close menu')
            : t('competitions.portal.topBar.openMenu', 'Open menu')}
        >
          {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      )}

      {/* Left section */}
      <div className="flex items-center gap-3 min-w-0">
        {variant === 'minimal' && backHref && (
          <Link href={backHref} className="text-portal-secondary hover:text-foreground transition-colors">
            <ArrowLeft className="size-5" />
          </Link>
        )}
        {title && (
          <span className="text-sm font-semibold text-foreground">{title}</span>
        )}
        {variant === 'topnav' && navLinks && (
          <nav className="flex items-center gap-1 ml-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors',
                  link.active
                    ? 'text-foreground border-b-2 border-foreground'
                    : 'text-portal-secondary hover:text-foreground'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: Actions */}
      <div className="ml-auto flex shrink-0 items-center gap-3" data-portal-handle="section:portal:header:actions">
        <PortalLocaleSwitcher />

        {/* Notification bell + panel */}
        <PortalNotificationBell t={t} />

        {/* Theme toggle */}
        <PortalThemeToggle />

        {/* User avatar + dropdown */}
        <div className="relative group">
          <button type="button" className="flex items-center gap-2">
            {variant === 'full' && displayName && (
              <div className="text-right hidden sm:block">
                <p className="text-xs font-medium text-foreground leading-tight">{displayName}</p>
                <p className="text-[10px] uppercase tracking-wide text-portal-secondary">{displayRole}</p>
              </div>
            )}
            <div className="size-8 rounded-full bg-portal-primary/10 border border-portal-primary/20 flex items-center justify-center text-xs font-bold text-portal-primary">
              {displayName.charAt(0).toUpperCase()}
            </div>
          </button>
          {/* Dropdown */}
          <div className="invisible group-focus-within:visible absolute right-0 top-full mt-1 w-48 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-slate-800 py-1 shadow-lg z-50">
            <Link
              href={`${prefix}/profile`}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              <Settings className="size-4 text-portal-secondary" />
              {t('competitions.portal.topBar.profile', 'My Profile')}
            </Link>
            <div className="mx-3 h-px bg-gray-100 dark:bg-white/10" />
            <button
              type="button"
              onClick={() => auth.logout()}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="size-4" />
              {t('competitions.portal.topBar.signOut', 'Sign Out')}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
