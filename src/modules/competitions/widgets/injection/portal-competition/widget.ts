import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'competitions.portal-competition',
  },
  menuItems: [
    {
      id: 'competitions.portal-competition',
      label: 'Competition',
      labelKey: 'competitions.portal.nav.competition',
      icon: 'lucide:trophy',
      href: '/portal/competition',
      features: ['portal.competitions.view'],
    },
  ],
}

export default widget
