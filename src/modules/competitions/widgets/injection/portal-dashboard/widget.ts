import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'competitions.portal-dashboard',
  },
  menuItems: [
    {
      id: 'competitions.portal-dashboard',
      label: 'Dashboard',
      labelKey: 'competitions.portal.nav.dashboard',
      icon: 'lucide:layout-dashboard',
      href: '/portal/dashboard',
      features: ['portal.competitions.view'],
    },
  ],
}

export default widget
