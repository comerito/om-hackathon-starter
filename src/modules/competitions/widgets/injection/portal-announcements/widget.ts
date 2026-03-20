import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'competitions.portal-announcements',
  },
  menuItems: [
    {
      id: 'competitions.portal-announcements',
      label: 'Announcements',
      labelKey: 'competitions.portal.nav.announcements',
      icon: 'lucide:megaphone',
      href: '/portal/announcements',
      features: ['portal.competitions.view'],
    },
  ],
}

export default widget
