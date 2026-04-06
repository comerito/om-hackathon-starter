import type { SearchModuleConfig } from '@open-mercato/shared/modules/search'

export const config: SearchModuleConfig = {
  entities: [
    {
      entityId: 'bounties:bounty_pull_request',
      priority: 10,
      fieldPolicy: {
        searchable: ['title', 'description', 'github_author'],
        excluded: ['diff_content'],
      },
      formatResult: async (ctx) => ({
        title: `PR #${ctx.record.github_pr_number}: ${ctx.record.title}`,
        subtitle: `@${ctx.record.github_author} — ${ctx.record.status}`,
        icon: 'git-pull-request',
        badge: 'Bounty',
      }),
      resolveUrl: async (ctx) => `/backend/bounties`,
    },
  ],
}

export { config as searchConfig }
export default config
