import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

// Backend pages are mounted at `/backend/<path under backend/>` — the module id is NOT part of
// the URL. This module's pages live in `bounties/backend/bounties-leaderboard/` and
// `bounties/backend/bounties-settings/`, so the hyphen in those hrefs is part of the directory
// name, not a `/backend/bounties/...` sub-path (issue #129).

const widget: InjectionMenuItemWidget = {
  metadata: { id: 'bounties.backend-nav' },
  menuItems: [
    {
      id: 'bounties.judge-panel',
      label: 'Bounty Hunting',
      labelKey: 'bounties.nav.judgePanel',
      icon: 'lucide:trophy',
      href: '/backend/bounties',
      groupId: 'hackon',
      groupLabel: 'HackOn',
      groupLabelKey: 'competitions.nav.group',
      groupOrder: 3,
    },
    {
      id: 'bounties.leaderboard',
      label: 'Leaderboard',
      labelKey: 'bounties.nav.leaderboard',
      icon: 'lucide:bar-chart-3',
      href: '/backend/bounties-leaderboard',
      groupId: 'hackon',
      groupLabel: 'HackOn',
      groupLabelKey: 'competitions.nav.group',
      groupOrder: 3,
    },
    {
      id: 'bounties.settings',
      label: 'Bounty Settings',
      labelKey: 'bounties.nav.settings',
      icon: 'lucide:settings',
      href: '/backend/bounties-settings',
      groupId: 'hackon',
      groupLabel: 'HackOn',
      groupLabelKey: 'competitions.nav.group',
      groupOrder: 3,
    },
  ],
}

export default widget
