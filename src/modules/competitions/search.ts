import type { SearchModuleConfig } from '@open-mercato/shared/modules/search'

export const searchConfig: SearchModuleConfig = {
  entities: [{
    entityId: 'competitions:competition',
    priority: 10,
    fieldPolicy: {
      searchable: ['name', 'description', 'location'],
      excluded: [],
    },
    formatResult: async (ctx) => ({
      title: String(ctx.record.name ?? 'Unknown'),
      subtitle: String(ctx.record.stage ?? ''),
      icon: 'lucide:trophy',
      badge: 'Competition',
    }),
    resolveUrl: async (ctx) => `/backend/competitions/${ctx.record.id}/edit`,
  }],
}

export default searchConfig
export const config = searchConfig
