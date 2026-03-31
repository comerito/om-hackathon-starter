import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

function getOrgSlug(): string {
  if (typeof window === 'undefined') return ''
  const match = window.location.pathname.match(/^\/([^/]+)\/portal/)
  return match?.[1] ?? ''
}

const widget: InjectionMenuItemWidget = {
  metadata: { id: 'sponsors.portal-nav' },
  get menuItems() {
    const slug = getOrgSlug()
    const prefix = slug ? `/${slug}/portal` : '/portal'
    return [
      { id: 'sponsors.portal-sponsors', label: 'Sponsors & Prizes', labelKey: 'sponsors.portal.nav.sponsors', icon: 'lucide:award', href: `${prefix}/sponsors`, groupId: 'community', groupLabel: 'Community', groupLabelKey: 'sponsors.portal.nav.groupCommunity', groupOrder: 3 },
      { id: 'sponsors.portal-voting', label: 'Vote', labelKey: 'sponsors.portal.nav.voting', icon: 'lucide:heart', href: `${prefix}/voting`, groupId: 'results', groupLabel: 'Judging & Results', groupLabelKey: 'sponsors.portal.nav.groupResults', groupOrder: 4 },
    ]
  },
}

export default widget
