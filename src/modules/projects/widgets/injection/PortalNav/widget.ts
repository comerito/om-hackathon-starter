import { InjectionPosition } from '@open-mercato/shared/modules/widgets/injection-position'
import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'projects.injection.portal-nav',
  },
  menuItems: [
    {
      id: 'hackon-my-project',
      labelKey: 'projects.portal.nav.myProject',
      icon: 'lucide:folder-code',
      href: '/portal/project',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-browse-teams' },
    },
  ],
}

export default widget
