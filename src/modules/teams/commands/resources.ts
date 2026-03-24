import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { requireId } from '@open-mercato/shared/lib/commands/helpers'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { FilterQuery } from '@mikro-orm/postgresql'
import { TeamResource } from '../data/entities'

function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}

const createResourceCommand: CommandHandler<Record<string, unknown>, TeamResource> = {
  id: 'teams.resources.create',
  async execute(rawInput, ctx) {
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const input = rawInput as Record<string, unknown>

    const resource = await de.createOrmEntity({
      entity: TeamResource,
      data: {
        teamId: String(input.team_id ?? ''),
        name: String(input.name ?? ''),
        type: String(input.type ?? 'link') as TeamResource['type'],
        url: input.url ? String(input.url) : null,
        fileId: input.file_id ? String(input.file_id) : null,
        metadata: (input.metadata as Record<string, unknown>) ?? {},
        addedBy: ctx.auth?.sub ?? '',
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    return resource
  },
}

const updateResourceCommand: CommandHandler<Record<string, unknown>, TeamResource> = {
  id: 'teams.resources.update',
  async execute(rawInput, ctx) {
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const input = rawInput as Record<string, unknown>
    const id = String(input.id ?? '')

    const resource = await de.updateOrmEntity({
      entity: TeamResource,
      where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<TeamResource>,
      apply: (entity) => {
        if (input.name !== undefined) entity.name = String(input.name)
        if (input.type !== undefined) entity.type = String(input.type) as TeamResource['type']
        if (input.url !== undefined) entity.url = input.url ? String(input.url) : null
        if (input.file_id !== undefined) entity.fileId = input.file_id ? String(input.file_id) : null
      },
    })
    if (!resource) throw new CrudHttpError(404, { error: 'Resource not found' })

    return resource
  },
}

const deleteResourceCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, TeamResource> = {
  id: 'teams.resources.delete',
  async execute(input, ctx) {
    const id = requireId(input, 'Resource id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const resource = await de.deleteOrmEntity({
      entity: TeamResource,
      where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<TeamResource>,
    })
    if (!resource) throw new CrudHttpError(404, { error: 'Resource not found' })

    return resource
  },
}

registerCommand(createResourceCommand)
registerCommand(updateResourceCommand)
registerCommand(deleteResourceCommand)
