import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'teams.portal-my-team',
  },
  menuItems: [
    {
      id: 'teams.portal-my-team',
      label: 'My Team',
      labelKey: 'teams.portal.nav.myTeam',
      icon: 'lucide:users',
      href: '/portal/team',
      features: ['portal.teams.view'],
    },
  ],
}

export default widget
