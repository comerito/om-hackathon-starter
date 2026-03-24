import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

function getOrgSlug(): string {
  if (typeof window === 'undefined') return ''
  const match = window.location.pathname.match(/^\/([^/]+)\/portal/)
  return match?.[1] ?? ''
}

const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'judging.portal-nav',
  },
  get menuItems() {
    const slug = getOrgSlug()
    const prefix = slug ? `/${slug}/portal` : '/portal'
    return [
      { id: 'judging.portal-presentations', label: 'Presentations', labelKey: 'judging.portal.nav.presentations', icon: 'lucide:presentation', href: `${prefix}/presentations` },
      { id: 'judging.portal-judging', label: 'Judging', labelKey: 'judging.portal.nav.judging', icon: 'lucide:clipboard-check', href: `${prefix}/judging` },
      { id: 'judging.portal-results', label: 'Results', labelKey: 'judging.portal.nav.results', icon: 'lucide:trophy', href: `${prefix}/results` },
    ]
  },
}

export default widget
