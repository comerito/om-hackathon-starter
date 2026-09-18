import { NextResponse } from 'next/server'
import type { AwilixContainer } from 'awilix'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { Project, ProjectGallerySubmission } from '../../data/entities'
import { findGallerySubmissions } from './submission'

export const PROJECT_RESOURCE_KIND = 'projects:project'

export type GalleryAdminContext = {
  container: AwilixContainer
  em: EntityManager
  auth: { sub: string; tenantId: string }
  organizationId: string
  project: Project
  submission: ProjectGallerySubmission | null
}

/** Auth + organization scope + the project and its gallery sidecar, or a ready error response. */
export async function resolveGalleryAdminContext(
  req: Request,
  projectId: string,
): Promise<GalleryAdminContext | { response: Response }> {
  const auth = await getAuthFromRequest(req)
  if (!auth?.tenantId || !auth?.sub) {
    return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const organizationId = scope.selectedId ?? auth.orgId
  if (!organizationId) {
    return { response: NextResponse.json({ error: 'Organization context required' }, { status: 400 }) }
  }

  const project = await em.findOne(Project, {
    id: projectId,
    tenantId: auth.tenantId,
    organizationId,
    deletedAt: null,
  } as FilterQuery<Project>)
  if (!project) return { response: NextResponse.json({ error: 'Project not found' }, { status: 404 }) }

  const submission = (await findGallerySubmissions(em, [project.id], { tenantId: auth.tenantId, organizationId })).get(project.id) ?? null

  return { container, em, auth: { sub: auth.sub, tenantId: auth.tenantId }, organizationId, project, submission }
}

/** Mutation-guard registry for the gallery's custom write routes (AGENTS.md CRITICAL rule 5). */
export function runGalleryMutationGuards(req: Request, ctx: GalleryAdminContext, mutationPayload: Record<string, unknown>) {
  return runRouteMutationGuards({
    container: ctx.container,
    req,
    auth: { userId: ctx.auth.sub, tenantId: ctx.auth.tenantId, organizationId: ctx.organizationId },
    input: { resourceKind: PROJECT_RESOURCE_KIND, resourceId: ctx.project.id, operation: 'update', mutationPayload },
  })
}

type EventBus = { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }

export async function emitGalleryEvent(ctx: GalleryAdminContext, eventId: string, extra: Record<string, unknown> = {}) {
  try {
    const eventBus = ctx.container.resolve('eventBus') as EventBus
    await eventBus.emit(eventId, {
      projectId: ctx.project.id,
      teamId: ctx.project.teamId,
      competitionId: ctx.project.competitionId,
      tenantId: ctx.auth.tenantId,
      organizationId: ctx.organizationId,
      ...extra,
    })
  } catch (e) {
    console.error(`[projects/admin/gallery] Event emit error (${eventId}):`, e)
  }
}
