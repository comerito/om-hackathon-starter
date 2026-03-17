import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'projects.project.created', label: 'Project Created', entity: 'project', category: 'crud', clientBroadcast: true },
  { id: 'projects.project.updated', label: 'Project Updated', entity: 'project', category: 'crud', clientBroadcast: true },
  { id: 'projects.project.deleted', label: 'Project Deleted', entity: 'project', category: 'crud', clientBroadcast: true },
  { id: 'projects.project.submitted', label: 'Project Submitted', entity: 'project', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'projects.project.flagged', label: 'Project Flagged', entity: 'project', category: 'lifecycle', clientBroadcast: true },
  { id: 'projects.batch.auto_published', label: 'Projects Auto-Published', entity: 'project', category: 'lifecycle', clientBroadcast: true },
] as const

export const eventsConfig = createModuleEvents({ moduleId: 'projects', events })
export const emitProjectsEvent = eventsConfig.emit
export default eventsConfig
