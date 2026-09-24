import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { DemoSession, DemoStatus } from '../data/entities'
import { advanceDemoSchema, reorderDemoSchema } from '../data/validators'
import { planDemoReorder } from '../lib/demoOrder'
import { loadDemoDurationResolver, pickDurations } from '../lib/demoDurationSync'
import { Project, ProjectStatus } from '../../projects/data/entities'

function ensureScope(ctx: CommandRuntimeContext) {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}

// ── Advance Demo Status ─────────────────────────────────────────

const advanceDemoCommand: CommandHandler<Record<string, unknown>, DemoSession> = {
  id: 'judging.demos.advance',
  async execute(rawInput, ctx) {
    const parsed = advanceDemoSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const em = ctx.container.resolve('em') as EntityManager

    const demo = await em.findOne(DemoSession, {
      id: parsed.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    } as FilterQuery<DemoSession>)

    if (!demo) throw new CrudHttpError(404, { error: 'Demo session not found' })

    const now = new Date()
    demo.status = parsed.status as DemoStatus

    if (parsed.status === 'presenting') {
      demo.actualStart = now
    } else if (parsed.status === 'completed' || parsed.status === 'skipped') {
      demo.actualEnd = now
    }

    em.persist(demo)
    await em.flush()

    // Emit SSE event for live timer sync
    try {
      const eventBus = ctx.container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
      await eventBus.emit('judging.demo.status_changed', {
        demoId: demo.id,
        status: demo.status,
        actualStart: demo.actualStart?.toISOString() ?? null,
        durationMinutes: demo.presentationDurationMinutes,
        qaDurationMinutes: demo.qaDurationMinutes,
        teamId: demo.teamId,
        projectId: demo.projectId,
        competitionId: demo.competitionId,
        serverTime: Date.now(),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      })
    } catch (e) {
      console.error('[judging:demos.advance] Event emit error:', e)
    }

    return demo
  },
}

// ── Reorder Demo ────────────────────────────────────────────────

const reorderDemoCommand: CommandHandler<Record<string, unknown>, DemoSession> = {
  id: 'judging.demos.reorder',
  async execute(rawInput, ctx) {
    const parsed = reorderDemoSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const em = ctx.container.resolve('em') as EntityManager

    const demo = await em.findOne(DemoSession, {
      id: parsed.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    } as FilterQuery<DemoSession>)
    if (!demo) throw new CrudHttpError(404, { error: 'Demo session not found' })

    // Read the whole queue BEFORE mutating: MikroORM 7 drops a pending UPDATE when a find is
    // interleaved with it (this command used to set the order first, then query).
    const queue = await em.find(DemoSession, {
      competitionId: demo.competitionId,
      round: demo.round,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    } as FilterQuery<DemoSession>, { orderBy: { presentationOrder: 'ASC' } })

    const plan = planDemoReorder(queue, parsed.id, parsed.new_order)
    if (!plan.ok) {
      throw new CrudHttpError(plan.reason === 'not_found' ? 404 : 409, {
        error: plan.reason === 'not_found'
          ? 'Demo session not found'
          : 'Demos that have already started or finished keep their position',
      })
    }

    const byId = new Map(queue.map((session) => [session.id, session]))
    for (const row of plan.order) {
      const session = byId.get(row.id)
      if (!session || session.presentationOrder === row.presentationOrder) continue
      session.presentationOrder = row.presentationOrder
      em.persist(session)
    }
    if (plan.changed) await em.flush()

    try {
      const eventBus = ctx.container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
      await eventBus.emit('judging.demo.queue_updated', {
        competitionId: demo.competitionId,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      })
    } catch (e) {
      console.error('[judging:demos.reorder] Event emit error:', e)
    }

    return demo
  },
}

// ── Generate Demo Queue ─────────────────────────────────────────

const generateDemoQueueCommand: CommandHandler<Record<string, unknown>, { count: number }> = {
  id: 'judging.demos.generate',
  async execute(rawInput, ctx) {
    const { competition_id, round = 'preliminary' } = rawInput as { competition_id: string; round?: string }
    if (!competition_id) throw new CrudHttpError(400, { error: 'competition_id required' })
    const scope = ensureScope(ctx)
    const em = ctx.container.resolve('em') as EntityManager

    // Find all published projects
    const projects = await em.find(Project, {
      competitionId: competition_id,
      status: ProjectStatus.PUBLISHED,
      deletedAt: null,
      tenantId: scope.tenantId,
    } as FilterQuery<Project>, { orderBy: { trackId: 'ASC', createdAt: 'ASC' } })

    const resolveDurations = await loadDemoDurationResolver(em, competition_id, scope)

    let order = 0
    const created: DemoSession[] = []
    for (const project of projects) {
      // Check if session already exists (idempotency)
      const existing = await em.findOne(DemoSession, {
        projectId: project.id,
        competitionId: competition_id,
        round,
      } as FilterQuery<DemoSession>)
      if (existing) continue

      const now = new Date()
      const session = em.create(DemoSession, {
        competitionId: competition_id,
        teamId: project.teamId,
        projectId: project.id,
        trackId: project.trackId,
        presentationOrder: order++,
        ...pickDurations(resolveDurations({ trackId: project.trackId, round })),
        status: DemoStatus.QUEUED,
        round: round as 'preliminary' | 'final',
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        createdAt: now,
        updatedAt: now,
      })
      em.persist(session)
      created.push(session)
    }

    if (created.length > 0) {
      await em.flush()
    }

    try {
      const eventBus = ctx.container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
      await eventBus.emit('judging.demo.queue_updated', {
        competitionId: competition_id,
        count: created.length,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      })
    } catch (e) {
      console.error('[judging:demos.generate] Event emit error:', e)
    }

    return { count: created.length }
  },
}

registerCommand(advanceDemoCommand)
registerCommand(reorderDemoCommand)
registerCommand(generateDemoQueueCommand)
