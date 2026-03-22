import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

function getOrgSlug(): string {
  if (typeof window === 'undefined') return ''
  const match = window.location.pathname.match(/^\/([^/]+)\/portal/)
  return match?.[1] ?? ''
}

const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'competitions.portal-nav',
  },
  get menuItems() {
    const slug = getOrgSlug()
    const prefix = slug ? `/${slug}/portal` : '/portal'
    return [
      { id: 'competitions.portal-dashboard', label: 'Dashboard', labelKey: 'competitions.portal.nav.dashboard', icon: 'lucide:layout-dashboard', href: `${prefix}/dashboard` },
      { id: 'competitions.portal-competition', label: 'Competition', labelKey: 'competitions.portal.nav.competition', icon: 'lucide:trophy', href: `${prefix}/competition` },
      { id: 'competitions.portal-agenda', label: 'Agenda', labelKey: 'competitions.portal.nav.agenda', icon: 'lucide:calendar-clock', href: `${prefix}/agenda` },
      { id: 'competitions.portal-announcements', label: 'Announcements', labelKey: 'competitions.portal.nav.announcements', icon: 'lucide:megaphone', href: `${prefix}/announcements` },
    ]
  },
}

export default widget
