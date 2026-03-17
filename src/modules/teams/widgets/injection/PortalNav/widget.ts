import { InjectionPosition } from '@open-mercato/shared/modules/widgets/injection-position'
import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'teams.injection.portal-nav',
  },
  menuItems: [
    {
      id: 'hackon-my-team',
      labelKey: 'teams.portal.nav.myTeam',
      icon: 'lucide:users',
      href: '/portal/team',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-announcements' },
    },
    {
      id: 'hackon-browse-teams',
      labelKey: 'teams.portal.nav.browseTeams',
      icon: 'lucide:search',
      href: '/portal/teams/browse',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-my-team' },
    },
  ],
}

export default widget
