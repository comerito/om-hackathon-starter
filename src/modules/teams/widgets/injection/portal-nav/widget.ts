import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

function getOrgSlug(): string {
  if (typeof window === 'undefined') return ''
  const match = window.location.pathname.match(/^\/([^/]+)\/portal/)
  return match?.[1] ?? ''
}

const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'teams.portal-nav',
  },
  get menuItems() {
    const slug = getOrgSlug()
    const prefix = slug ? `/${slug}/portal` : '/portal'
    return [
      { id: 'teams.portal-my-team', label: 'My Team', labelKey: 'teams.portal.nav.myTeam', icon: 'lucide:users', href: `${prefix}/team`, groupId: 'hackathon', groupLabel: 'Hackathon', groupLabelKey: 'teams.portal.nav.groupHackathon', groupOrder: 2 },
      { id: 'teams.portal-browse-teams', label: 'Browse Teams', labelKey: 'teams.portal.nav.browseTeams', icon: 'lucide:search', href: `${prefix}/teams`, groupId: 'community', groupLabel: 'Community', groupLabelKey: 'teams.portal.nav.groupCommunity', groupOrder: 3 },
    ]
  },
}

export default widget
