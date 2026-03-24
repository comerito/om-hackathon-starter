import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { requireId } from '@open-mercato/shared/lib/commands/helpers'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { FilterQuery } from '@mikro-orm/postgresql'
import { Milestone } from '../data/entities'
import { createMilestoneSchema, updateMilestoneSchema } from '../data/validators'

function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}

const createMilestoneCommand: CommandHandler<Record<string, unknown>, Milestone> = {
  id: 'competitions.milestones.create',
  async execute(rawInput, ctx) {
    const parsed = createMilestoneSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const milestone = await de.createOrmEntity({
      entity: Milestone,
      data: {
        competitionId: parsed.competition_id,
        name: parsed.name,
        description: parsed.description ?? null,
        dueDate: new Date(parsed.due_date),
        status: parsed.status,
        sortOrder: parsed.sort_order,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    return milestone
  },
}

const updateMilestoneCommand: CommandHandler<Record<string, unknown>, Milestone> = {
  id: 'competitions.milestones.update',
  async execute(rawInput, ctx) {
    const parsed = updateMilestoneSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const milestone = await de.updateOrmEntity({
      entity: Milestone,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<Milestone>,
      apply: (entity) => {
        if (parsed.name !== undefined) entity.name = parsed.name
        if (parsed.description !== undefined) entity.description = parsed.description
        if (parsed.due_date !== undefined) entity.dueDate = new Date(parsed.due_date)
        if (parsed.status !== undefined) entity.status = parsed.status
        if (parsed.sort_order !== undefined) entity.sortOrder = parsed.sort_order
      },
    })
    if (!milestone) throw new CrudHttpError(404, { error: 'Milestone not found' })

    return milestone
  },
}

const deleteMilestoneCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, Milestone> = {
  id: 'competitions.milestones.delete',
  async execute(input, ctx) {
    const id = requireId(input, 'Milestone id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const milestone = await de.deleteOrmEntity({
      entity: Milestone,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<Milestone>,
    })
    if (!milestone) throw new CrudHttpError(404, { error: 'Milestone not found' })

    return milestone
  },
}

registerCommand(createMilestoneCommand)
registerCommand(updateMilestoneCommand)
registerCommand(deleteMilestoneCommand)
