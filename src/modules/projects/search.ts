import type { SearchModuleConfig, SearchBuildContext } from '@open-mercato/shared/modules/search'

export const searchConfig: SearchModuleConfig = {
  entities: [{
    entityId: 'projects:project',
    priority: 9,
    fieldPolicy: {
      searchable: ['title', 'tagline', 'description', 'problem_statement', 'solution'],
      excluded: [],
    },
    buildSource: async (ctx: SearchBuildContext) => {
      const techStack = Array.isArray(ctx.record.techStack)
        ? (ctx.record.techStack as string[]).join(', ')
        : ''
      return {
        text: [
          `Title: ${ctx.record.title ?? ''}`,
          `Tagline: ${ctx.record.tagline ?? ''}`,
          `Description: ${ctx.record.description ?? ''}`,
          `Problem: ${ctx.record.problemStatement ?? ''}`,
          `Solution: ${ctx.record.solution ?? ''}`,
          techStack ? `Tech Stack: ${techStack}` : '',
        ].filter(Boolean),
        presenter: {
          title: String(ctx.record.title ?? 'Untitled Project'),
          subtitle: String(ctx.record.tagline ?? ''),
          icon: 'lucide:folder-code',
          badge: 'Project',
        },
        links: [{ href: `/backend/projects/projects/${ctx.record.id}`, label: 'View', kind: 'primary' as const }],
        checksumSource: { record: ctx.record, customFields: ctx.customFields },
      }
    },
    formatResult: async (ctx) => ({
      title: String(ctx.record.title ?? 'Untitled Project'),
      subtitle: String(ctx.record.tagline ?? ctx.record.status ?? ''),
      icon: 'lucide:folder-code',
      badge: 'Project',
    }),
    resolveUrl: async (ctx) => `/backend/projects/projects/${ctx.record.id}`,
  }],
}

export default searchConfig
export const config = searchConfig
