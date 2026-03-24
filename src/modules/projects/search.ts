import type { SearchModuleConfig } from '@open-mercato/shared/modules/search'

export const config: SearchModuleConfig = {
  entities: [{
    entityId: 'projects:project',
    priority: 9,
    fieldPolicy: {
      searchable: ['title', 'tagline', 'description', 'problem_statement', 'solution'],
      excluded: [],
    },
    formatResult: async (ctx) => ({
      title: ctx.record.title as string,
      subtitle: (ctx.record.tagline as string) ?? (ctx.record.status as string),
      icon: 'lucide:folder-code',
      badge: 'Project',
    }),
    resolveUrl: async (ctx) => `/backend/projects/${ctx.record.id}`,
  }],
}

export { config as searchConfig }
export default config
