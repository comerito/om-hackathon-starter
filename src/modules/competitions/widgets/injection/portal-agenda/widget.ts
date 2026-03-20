import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'competitions.portal-agenda',
  },
  menuItems: [
    {
      id: 'competitions.portal-agenda',
      label: 'Agenda',
      labelKey: 'competitions.portal.nav.agenda',
      icon: 'lucide:calendar-clock',
      href: '/portal/agenda',
      features: ['portal.competitions.view'],
    },
  ],
}

export default widget
