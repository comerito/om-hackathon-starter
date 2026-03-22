import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { FilterQuery } from '@mikro-orm/postgresql'
import { Sponsor } from '../data/entities'
import { createSponsorSchema, updateSponsorSchema } from '../data/validators'

const ENTITY_ID = 'sponsors:sponsor'

export const sponsorCrudEvents: CrudEventsConfig<Sponsor> = {
  module: 'sponsors', entity: 'sponsor', persistent: true,
  buildPayload: (ctx: CrudEmitContext<Sponsor>) => ({
    id: ctx.identifiers.id, tenantId: ctx.identifiers.tenantId, organizationId: ctx.identifiers.organizationId,
  }),
}

export const sponsorCrudIndexer: CrudIndexerConfig<Sponsor> = {
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<Sponsor>) => ({ entityType: ENTITY_ID, recordId: ctx.identifiers.id, tenantId: ctx.identifiers.tenantId, organizationId: ctx.identifiers.organizationId }),
  buildDeletePayload: (ctx: CrudEmitContext<Sponsor>) => ({ entityType: ENTITY_ID, recordId: ctx.identifiers.id, tenantId: ctx.identifiers.tenantId, organizationId: ctx.identifiers.organizationId }),
}

function ensureScope(ctx: CommandRuntimeContext) {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}

registerCommand({
  id: 'sponsors.sponsors.create',
  async execute(rawInput, ctx) {
    const parsed = createSponsorSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const sponsor = await de.createOrmEntity({ entity: Sponsor, data: {
      competitionId: parsed.competition_id, name: parsed.name, tier: parsed.tier,
      logoUrl: parsed.logo_url, websiteUrl: parsed.website_url ?? null,
      description: parsed.description ?? null, challengeTitle: parsed.challenge_title ?? null,
      challengeDescription: parsed.challenge_description ?? null,
      challengeResourcesUrl: parsed.challenge_resources_url ?? null,
      contactName: parsed.contact_name ?? null, contactEmail: parsed.contact_email ?? null,
      order: parsed.order, isVisible: parsed.is_visible,
      tenantId: scope.tenantId, organizationId: scope.organizationId,
    }})
    await emitCrudSideEffects({ dataEngine: de, action: 'created', entity: sponsor,
      identifiers: { id: String(sponsor.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: sponsorCrudEvents, indexer: sponsorCrudIndexer })
    return sponsor
  },
} as CommandHandler<Record<string, unknown>, Sponsor>)

registerCommand({
  id: 'sponsors.sponsors.update',
  async execute(rawInput, ctx) {
    const parsed = updateSponsorSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const sponsor = await de.updateOrmEntity({ entity: Sponsor,
      where: { id: parsed.id, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null } as FilterQuery<Sponsor>,
      apply: (e) => {
        if (parsed.name !== undefined) e.name = parsed.name
        if (parsed.tier !== undefined) e.tier = parsed.tier
        if (parsed.logo_url !== undefined) e.logoUrl = parsed.logo_url
        if (parsed.website_url !== undefined) e.websiteUrl = parsed.website_url
        if (parsed.description !== undefined) e.description = parsed.description
        if (parsed.challenge_title !== undefined) e.challengeTitle = parsed.challenge_title
        if (parsed.challenge_description !== undefined) e.challengeDescription = parsed.challenge_description
        if (parsed.challenge_resources_url !== undefined) e.challengeResourcesUrl = parsed.challenge_resources_url
        if (parsed.contact_name !== undefined) e.contactName = parsed.contact_name
        if (parsed.contact_email !== undefined) e.contactEmail = parsed.contact_email
        if (parsed.order !== undefined) e.order = parsed.order
        if (parsed.is_visible !== undefined) e.isVisible = parsed.is_visible
      },
    })
    if (!sponsor) throw new CrudHttpError(404, { error: 'Sponsor not found' })
    await emitCrudSideEffects({ dataEngine: de, action: 'updated', entity: sponsor,
      identifiers: { id: String(sponsor.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: sponsorCrudEvents, indexer: sponsorCrudIndexer })
    return sponsor
  },
} as CommandHandler<Record<string, unknown>, Sponsor>)

registerCommand({
  id: 'sponsors.sponsors.delete',
  async execute(input, ctx) {
    const id = requireId(input, 'Sponsor id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const sponsor = await de.deleteOrmEntity({ entity: Sponsor,
      where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null } as FilterQuery<Sponsor>,
      soft: true, softDeleteField: 'deletedAt' })
    if (!sponsor) throw new CrudHttpError(404, { error: 'Sponsor not found' })
    await emitCrudSideEffects({ dataEngine: de, action: 'deleted', entity: sponsor,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: sponsorCrudEvents, indexer: sponsorCrudIndexer })
    return sponsor
  },
} as CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, Sponsor>)
