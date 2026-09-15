import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { emptyMutationSchema } from '../../../../../data/validators'
import { batchSummarySchema } from '../../../../../data/responses'
import { addonWriteFeatures } from '../../../../../lib/request-context'
import { addonRoute, queryInput, jsonInput, responseJson, batchId, pathParamsSchema, apiErrors, type RouteContext } from '../../../../helpers'
export const metadata = { POST: { requireAuth: true, requireFeatures: addonWriteFeatures } }
export async function POST(req: Request, context: RouteContext) {
  return addonRoute(req, true, async (ctx, service) => {
    emptyMutationSchema.parse(queryInput(req))
    emptyMutationSchema.parse(await jsonInput(req))
    return responseJson(batchSummarySchema, await service.cancel(ctx, await batchId(context)))
  })
}
export const openApi: OpenApiRouteDoc = { tag: 'Addons', methods: { POST: { summary: 'Cancel a frozen addon batch owned by the operator', pathParams: pathParamsSchema, requestBody: { schema: emptyMutationSchema }, responses: [{ status: 200, schema: batchSummarySchema }], errors: apiErrors } } }
