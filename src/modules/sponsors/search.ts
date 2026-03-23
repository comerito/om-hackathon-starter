import type { SearchModuleConfig } from '@open-mercato/shared/modules/search'

export const config: SearchModuleConfig = {
  entities: [{
    entityId: 'sponsors:sponsor',
    priority: 6,
    fieldPolicy: {
      searchable: ['name', 'description', 'challenge_title'],
      excluded: [],
    },
    formatResult: async (ctx) => ({
      title: ctx.record.name as string,
      subtitle: ctx.record.tier as string,
      icon: 'lucide:award',
      badge: 'Sponsor',
    }),
    resolveUrl: async (ctx) => `/backend/sponsors/${ctx.record.id}/edit`,
  }],
}

export { config as searchConfig }
export default config
