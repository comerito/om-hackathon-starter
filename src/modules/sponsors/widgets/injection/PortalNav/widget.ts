import { InjectionPosition } from '@open-mercato/shared/modules/widgets/injection-position'
import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'sponsors.injection.portal-nav',
  },
  menuItems: [
    {
      id: 'hackon-sponsors',
      labelKey: 'sponsors.portal.nav.sponsors',
      icon: 'lucide:award',
      href: '/portal/sponsors',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-results' },
    },
    {
      id: 'hackon-voting',
      labelKey: 'sponsors.portal.nav.voting',
      icon: 'lucide:heart',
      href: '/portal/voting',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-sponsors' },
    },
    {
      id: 'hackon-final-results',
      labelKey: 'sponsors.portal.nav.results',
      icon: 'lucide:bar-chart-3',
      href: '/portal/results',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-voting' },
    },
  ],
}

export default widget
