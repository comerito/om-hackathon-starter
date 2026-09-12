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
    // The module has no project detail page — `/backend/projects` (list) and
    // `/backend/projects/[id]/edit` are the only registered routes — so a search hit opens
    // the edit page, as the sponsors search config already does for a sponsor.
    resolveUrl: async (ctx) => `/backend/projects/${ctx.record.id}/edit`,
  }],
}

export { config as searchConfig }
export default config
