import { InjectionPosition } from '@open-mercato/shared/modules/widgets/injection-position'
import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

/**
 * Consolidated portal sidebar navigation for all HackOn modules.
 * Hardcoded /acme-corp/ prefix — TODO: update when framework adds auto-prefixing.
 */
const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'competitions.injection.portal-nav',
  },
  menuItems: [
    // --- Competitions ---
    {
      id: 'hackon-competition',
      labelKey: 'competitions.portal.nav.competition',
      icon: 'lucide:trophy',
      href: '/acme-corp/portal/competition',
      placement: { position: InjectionPosition.After, relativeTo: 'portal-dashboard' },
    },
    {
      id: 'hackon-agenda',
      labelKey: 'competitions.portal.nav.agenda',
      icon: 'lucide:calendar',
      href: '/acme-corp/portal/agenda',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-competition' },
    },
    {
      id: 'hackon-announcements',
      labelKey: 'competitions.portal.nav.announcements',
      icon: 'lucide:megaphone',
      href: '/acme-corp/portal/announcements',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-agenda' },
    },
    {
      id: 'hackon-participants',
      labelKey: 'competitions.portal.nav.participants',
      icon: 'lucide:contact',
      href: '/acme-corp/portal/participants',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-announcements' },
    },
    // --- Teams ---
    {
      id: 'hackon-my-team',
      labelKey: 'teams.portal.nav.myTeam',
      icon: 'lucide:users',
      href: '/acme-corp/portal/team',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-participants' },
    },
    {
      id: 'hackon-browse-teams',
      labelKey: 'teams.portal.nav.browseTeams',
      icon: 'lucide:search',
      href: '/acme-corp/portal/teams/browse',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-my-team' },
    },
    // --- Projects ---
    {
      id: 'hackon-my-project',
      labelKey: 'projects.portal.nav.myProject',
      icon: 'lucide:folder-code',
      href: '/acme-corp/portal/project',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-browse-teams' },
    },
    // --- Judging ---
    {
      id: 'hackon-presentations',
      labelKey: 'judging.portal.nav.presentations',
      icon: 'lucide:presentation',
      href: '/acme-corp/portal/presentations',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-my-project' },
    },
    {
      id: 'hackon-judging',
      labelKey: 'judging.portal.nav.judging',
      icon: 'lucide:gavel',
      href: '/acme-corp/portal/judging',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-presentations' },
    },
    // --- Sponsors & Results ---
    {
      id: 'hackon-sponsors',
      labelKey: 'sponsors.portal.nav.sponsors',
      icon: 'lucide:award',
      href: '/acme-corp/portal/sponsors',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-judging' },
    },
    {
      id: 'hackon-voting',
      labelKey: 'sponsors.portal.nav.voting',
      icon: 'lucide:heart',
      href: '/acme-corp/portal/voting',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-sponsors' },
    },
    {
      id: 'hackon-results',
      labelKey: 'sponsors.portal.nav.results',
      icon: 'lucide:bar-chart-3',
      href: '/acme-corp/portal/results',
      placement: { position: InjectionPosition.After, relativeTo: 'hackon-voting' },
    },
  ],
}

export default widget
