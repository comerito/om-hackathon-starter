import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

function getOrgSlug(): string {
  if (typeof window === 'undefined') return ''
  const match = window.location.pathname.match(/^\/([^/]+)\/portal/)
  return match?.[1] ?? ''
}

const widget: InjectionMenuItemWidget = {
  metadata: { id: 'incidents.portal-nav' },
  get menuItems() {
    const slug = getOrgSlug()
    const prefix = slug ? `/${slug}/portal` : '/portal'
    return [
      { id: 'incidents.portal-report', label: 'Report Incident', labelKey: 'incidents.portal.nav.report', icon: 'lucide:shield-alert', href: `${prefix}/incident`, groupId: 'tools', groupLabel: 'Tools', groupLabelKey: 'incidents.portal.nav.groupTools', groupOrder: 6 },
    ]
  },
}

export default widget
