import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { competitionsQuerySchema } from '../../data/validators'
import { competitionsResponseSchema } from '../../data/responses'
import { addonReadFeatures } from '../../lib/request-context'
import { addonRoute, queryInput, responseJson, apiErrors } from '../helpers'

export const metadata = { GET: { requireAuth: true, requireFeatures: addonReadFeatures } }
export async function GET(req: Request) {
  return addonRoute(req, false, async (ctx, service) => responseJson(competitionsResponseSchema, await service.competitions(ctx, competitionsQuerySchema.parse(queryInput(req)))) )
}
export const openApi: OpenApiRouteDoc = { tag: 'Addons', methods: { GET: { summary: 'List scoped addon competitions', query: competitionsQuerySchema, responses: [{ status: 200, schema: competitionsResponseSchema }], errors: apiErrors } } }
