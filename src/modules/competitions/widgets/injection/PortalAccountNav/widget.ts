import { InjectionPosition } from '@open-mercato/shared/modules/widgets/injection-position'
import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'competitions.injection.portal-account-nav',
  },
  menuItems: [
    {
      id: 'hackon-qr',
      labelKey: 'competitions.portal.nav.qr_code',
      icon: 'lucide:qr-code',
      href: '/portal/qr',
      placement: { position: InjectionPosition.Start },
    },
  ],
}

export default widget
