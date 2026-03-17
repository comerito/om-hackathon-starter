import { InjectionPosition } from '@open-mercato/shared/modules/widgets/injection-position'
import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'judging.injection.portal-nav',
  },
  menuItems: [
    {
      id: 'hackon-presentations',
      labelKey: 'judging.portal.nav.presentations',
      icon: 'lucide:presentation',
      href: '/portal/presentations',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-my-project' },
    },
    {
      id: 'hackon-judging',
      labelKey: 'judging.portal.nav.judging',
      icon: 'lucide:gavel',
      href: '/portal/judging',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-presentations' },
      requireFeatures: ['portal.judging.score'],
    },
    {
      id: 'hackon-results',
      labelKey: 'judging.portal.nav.results',
      icon: 'lucide:trophy',
      href: '/portal/results',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-judging' },
    },
  ],
}

export default widget
