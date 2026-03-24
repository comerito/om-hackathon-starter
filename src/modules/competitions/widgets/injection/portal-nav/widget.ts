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
      { id: 'competitions.portal-participants', label: 'Participants', labelKey: 'competitions.portal.nav.participants', icon: 'lucide:users', href: `${prefix}/participants` },
      { id: 'competitions.portal-qr', label: 'My QR Code', labelKey: 'competitions.portal.nav.qr', icon: 'lucide:qr-code', href: `${prefix}/qr` },
    ]
  },
}

export default widget
