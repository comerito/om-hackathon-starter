import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'teams.portal-browse-teams',
  },
  menuItems: [
    {
      id: 'teams.portal-browse-teams',
      label: 'Browse Teams',
      labelKey: 'teams.portal.nav.browseTeams',
      icon: 'lucide:search',
      href: '/portal/teams',
      features: ['portal.teams.view'],
    },
  ],
}

export default widget
