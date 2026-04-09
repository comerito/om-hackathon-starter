import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

function getOrgSlug(): string {
  if (typeof window === 'undefined') return ''
  const match = window.location.pathname.match(/^\/([^/]+)\/portal/)
  return match?.[1] ?? ''
}

const widget: InjectionMenuItemWidget = {
  metadata: { id: 'bounties.portal-nav' },
  get menuItems() {
    const slug = getOrgSlug()
    const prefix = slug ? `/${slug}/portal` : '/portal'
    return [
      {
        id: 'bounties.portal-leaderboard',
        label: 'Bounty Leaderboard',
        labelKey: 'bounties.portal.nav.leaderboard',
        icon: 'lucide:trophy',
        href: `${prefix}/bounties/leaderboard`,
        groupId: 'bounties',
        groupLabel: 'Bounty Hunting',
        groupLabelKey: 'bounties.portal.nav.group',
        groupOrder: 5,
      },
      {
        id: 'bounties.portal-my-prs',
        label: 'My Bounty PRs',
        labelKey: 'bounties.portal.nav.myPrs',
        icon: 'lucide:git-pull-request',
        href: `${prefix}/bounties/my-prs`,
        groupId: 'bounties',
        groupLabel: 'Bounty Hunting',
        groupLabelKey: 'bounties.portal.nav.group',
        groupOrder: 5,
      },
      {
        id: 'bounties.portal-judge',
        label: 'Bounty Judge Panel',
        labelKey: 'bounties.portal.nav.judge',
        icon: 'lucide:shield-check',
        href: `${prefix}/bounties/judge`,
        features: ['portal.bounties.judge'],
        groupId: 'bounties',
        groupLabel: 'Bounty Hunting',
        groupLabelKey: 'bounties.portal.nav.group',
        groupOrder: 5,
      },
    ]
  },
}

export default widget
