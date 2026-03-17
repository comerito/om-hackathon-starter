import { InjectionPosition } from '@open-mercato/shared/modules/widgets/injection-position'
import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'competitions.injection.portal-nav',
  },
  menuItems: [
    {
      id: 'hackon-dashboard',
      labelKey: 'competitions.portal.nav.dashboard',
      icon: 'lucide:layout-dashboard',
      href: '/portal/dashboard',
      placement: { position: InjectionPosition.Start },
    },
    {
      id: 'hackon-competition',
      labelKey: 'competitions.portal.nav.competition',
      icon: 'lucide:trophy',
      href: '/portal/competition',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-dashboard' },
    },
    {
      id: 'hackon-agenda',
      labelKey: 'competitions.portal.nav.agenda',
      icon: 'lucide:calendar',
      href: '/portal/agenda',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-competition' },
    },
    {
      id: 'hackon-participants',
      labelKey: 'competitions.portal.nav.participants',
      icon: 'lucide:users',
      href: '/portal/participants',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-agenda' },
    },
    {
      id: 'hackon-announcements',
      labelKey: 'competitions.portal.nav.announcements',
      icon: 'lucide:megaphone',
      href: '/portal/announcements',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-participants' },
    },
  ],
}

export default widget
