import { InjectionPosition } from '@open-mercato/shared/modules/widgets/injection-position'
import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

/**
 * Portal sidebar navigation items.
 *
 * NOTE: hrefs must include the /:orgSlug prefix to work under the portal
 * layout (e.g. /acme-corp/portal/dashboard). The PortalShell does not
 * auto-prefix injected menu item hrefs — only built-in items get prefixed.
 *
 * As a workaround the hrefs start with /portal/ which works for direct
 * links but NOT for client-side navigation inside the portal shell.
 * TODO: Upstream fix in PortalShell to auto-prefix injected hrefs.
 */
const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'competitions.injection.portal-nav',
  },
  menuItems: [
    {
      id: 'hackon-dashboard',
      labelKey: 'competitions.portal.nav.dashboard',
      icon: 'lucide:layout-dashboard',
      href: '/acme-corp/portal/dashboard',
      placement: { position: InjectionPosition.Start },
    },
    {
      id: 'hackon-competition',
      labelKey: 'competitions.portal.nav.competition',
      icon: 'lucide:trophy',
      href: '/acme-corp/portal/competition',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-dashboard' },
    },
    {
      id: 'hackon-agenda',
      labelKey: 'competitions.portal.nav.agenda',
      icon: 'lucide:calendar',
      href: '/acme-corp/portal/agenda',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-competition' },
    },
    {
      id: 'hackon-participants',
      labelKey: 'competitions.portal.nav.participants',
      icon: 'lucide:users',
      href: '/acme-corp/portal/participants',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-agenda' },
    },
    {
      id: 'hackon-announcements',
      labelKey: 'competitions.portal.nav.announcements',
      icon: 'lucide:megaphone',
      href: '/acme-corp/portal/announcements',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-participants' },
    },
  ],
}

export default widget
