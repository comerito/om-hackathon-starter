import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { paginationSchema } from '../../../../data/validators'
import { batchDetailResponseSchema } from '../../../../data/responses'
import { addonReadFeatures } from '../../../../lib/request-context'
import { addonRoute, queryInput, responseJson, apiErrors, batchId, pathParamsSchema, type RouteContext } from '../../../helpers'

export const metadata = { GET: { requireAuth: true, requireFeatures: addonReadFeatures } }
export async function GET(req: Request, context: RouteContext) {
  return addonRoute(req, false, async (ctx, service) => responseJson(batchDetailResponseSchema, await service.detail(ctx, await batchId(context), paginationSchema.parse(queryInput(req)))) )
}
export const openApi: OpenApiRouteDoc = { tag: 'Addons', methods: { GET: { summary: 'List scoped addon detail', query: paginationSchema, pathParams: pathParamsSchema, responses: [{ status: 200, schema: batchDetailResponseSchema }], errors: apiErrors } } }
