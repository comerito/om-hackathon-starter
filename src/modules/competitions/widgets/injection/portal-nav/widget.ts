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
      { id: 'competitions.portal-dashboard', label: 'Dashboard', labelKey: 'competitions.portal.nav.dashboard', icon: 'lucide:layout-dashboard', href: `${prefix}/dashboard`, groupId: 'main', groupLabel: '', groupOrder: 1 },
      { id: 'competitions.portal-agenda', label: 'Schedule', labelKey: 'competitions.portal.nav.agenda', icon: 'lucide:calendar-clock', href: `${prefix}/agenda`, groupId: 'main', groupOrder: 1 },
      { id: 'competitions.portal-announcements', label: 'Announcements', labelKey: 'competitions.portal.nav.announcements', icon: 'lucide:megaphone', href: `${prefix}/announcements`, groupId: 'main', groupOrder: 1 },
      { id: 'competitions.portal-competition', label: 'Competition', labelKey: 'competitions.portal.nav.competition', icon: 'lucide:trophy', href: `${prefix}/competition`, groupId: 'hackathon', groupLabel: 'Hackathon', groupLabelKey: 'competitions.portal.nav.groupHackathon', groupOrder: 2 },
      { id: 'competitions.portal-participants', label: 'Participants', labelKey: 'competitions.portal.nav.participants', icon: 'lucide:users', href: `${prefix}/participants`, groupId: 'community', groupLabel: 'Community', groupLabelKey: 'competitions.portal.nav.groupCommunity', groupOrder: 4 },
      { id: 'competitions.portal-chat', label: 'Chat', labelKey: 'competitions.portal.nav.chat', icon: 'lucide:message-circle', href: `${prefix}/chat`, groupId: 'community', groupLabel: 'Community', groupLabelKey: 'competitions.portal.nav.groupCommunity', groupOrder: 4 },
      { id: 'competitions.portal-qr', label: 'My QR Code', labelKey: 'competitions.portal.nav.qr', icon: 'lucide:qr-code', href: `${prefix}/qr`, groupId: 'tools', groupLabel: 'Tools', groupLabelKey: 'competitions.portal.nav.groupTools', groupOrder: 6 },
    ]
  },
}

export default widget
