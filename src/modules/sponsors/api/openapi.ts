import { z, type ZodTypeAny } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  createCrudOpenApiFactory,
  createPagedListResponseSchema as createSharedPagedListResponseSchema,
  type CrudOpenApiOptions,
} from '@open-mercato/shared/lib/openapi/crud'

export { sponsorListItemSchema, prizeListItemSchema } from '../data/validators'

export const sponsorsTag = 'Sponsors'

export const errorSchema = z.object({
  error: z.string(),
}).passthrough()

export const okSchema = z.object({
  ok: z.literal(true),
})

export const createdSchema = z.object({
  id: z.string().uuid(),
})

export function createSponsorsPagedListResponseSchema(itemSchema: ZodTypeAny) {
  return createSharedPagedListResponseSchema(itemSchema, { paginationMetaOptional: true })
}

const buildSponsorsCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: sponsorsTag,
  defaultCreateResponseSchema: createdSchema,
  defaultOkResponseSchema: okSchema,
  makeListDescription: ({ pluralLower }) =>
    `Returns a paginated collection of ${pluralLower} in the current tenant scope.`,
})

export function createSponsorsCrudOpenApi(options: CrudOpenApiOptions): OpenApiRouteDoc {
  return buildSponsorsCrudOpenApi(options)
}
