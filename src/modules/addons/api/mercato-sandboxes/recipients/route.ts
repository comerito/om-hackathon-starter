import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { recipientsQuerySchema } from '../../../data/validators'
import { recipientsResponseSchema } from '../../../data/responses'
import { addonReadFeatures } from '../../../lib/request-context'
import { addonRoute, queryInput, responseJson, apiErrors } from '../../helpers'

export const metadata = { GET: { requireAuth: true, requireFeatures: addonReadFeatures } }
export async function GET(req: Request) {
  return addonRoute(req, false, async (ctx, service) => responseJson(recipientsResponseSchema, await service.recipients(ctx, recipientsQuerySchema.parse(queryInput(req, true)))) )
}
export const openApi: OpenApiRouteDoc = { tag: 'Addons', methods: { GET: { summary: 'List scoped addon recipients', query: recipientsQuerySchema, responses: [{ status: 200, schema: recipientsResponseSchema }], errors: apiErrors } } }
