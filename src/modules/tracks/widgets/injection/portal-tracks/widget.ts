import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'tracks.portal-tracks',
  },
  menuItems: [
    {
      id: 'tracks.portal-tracks',
      label: 'Tracks',
      labelKey: 'tracks.portal.nav.tracks',
      icon: 'lucide:git-branch',
      href: '/portal/tracks',
      features: ['portal.tracks.view'],
    },
  ],
}

export default widget
