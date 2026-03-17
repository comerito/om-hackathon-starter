import { z, type ZodTypeAny } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  createCrudOpenApiFactory,
  createPagedListResponseSchema as createSharedPagedListResponseSchema,
  type CrudOpenApiOptions,
} from '@open-mercato/shared/lib/openapi/crud'

export { competitionListItemSchema } from '../data/validators'

export const competitionsTag = 'Competitions'

export const errorSchema = z.object({
  error: z.string(),
}).passthrough()

export const okSchema = z.object({
  ok: z.literal(true),
})

export const createdSchema = z.object({
  id: z.string().uuid(),
})

export function createCompetitionsPagedListResponseSchema(itemSchema: ZodTypeAny) {
  return createSharedPagedListResponseSchema(itemSchema, { paginationMetaOptional: true })
}

const buildCompetitionsCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: competitionsTag,
  defaultCreateResponseSchema: createdSchema,
  defaultOkResponseSchema: okSchema,
  makeListDescription: ({ pluralLower }) =>
    `Returns a paginated collection of ${pluralLower} in the current tenant scope.`,
})

export function createCompetitionsCrudOpenApi(options: CrudOpenApiOptions): OpenApiRouteDoc {
  return buildCompetitionsCrudOpenApi(options)
}
