import type { SearchModuleConfig } from '@open-mercato/shared/modules/search'

export const searchConfig: SearchModuleConfig = {
  entities: [{
    entityId: 'teams:team',
    priority: 8,
    fieldPolicy: {
      searchable: ['name', 'description'],
      excluded: [],
    },
    formatResult: async (ctx) => ({
      title: String(ctx.record.name ?? 'Unknown'),
      subtitle: String(ctx.record.status ?? ''),
      icon: 'lucide:users',
      badge: 'Team',
    }),
    resolveUrl: async (ctx) => `/backend/teams/teams/${ctx.record.id}`,
  }],
}

export default searchConfig
