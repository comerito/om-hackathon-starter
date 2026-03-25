import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

function getOrgSlug(): string {
  if (typeof window === 'undefined') return ''
  const match = window.location.pathname.match(/^\/([^/]+)\/portal/)
  return match?.[1] ?? ''
}

const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'tracks.portal-nav',
  },
  get menuItems() {
    const slug = getOrgSlug()
    const prefix = slug ? `/${slug}/portal` : '/portal'
    return [
      { id: 'tracks.portal-tracks', label: 'Tracks', labelKey: 'tracks.portal.nav.tracks', icon: 'lucide:git-branch', href: `${prefix}/tracks`, groupId: 'hackathon', groupLabel: 'Hackathon', groupOrder: 2 },
    ]
  },
}

export default widget
