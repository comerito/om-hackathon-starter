import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { batchesQuerySchema, prepareBatchSchema } from '../../../data/validators'
import { batchListResponseSchema, preparedBatchSchema } from '../../../data/responses'
import { addonReadFeatures, addonWriteFeatures } from '../../../lib/request-context'
import { addonRoute, queryInput, responseJson, apiErrors, jsonInput } from '../../helpers'

export const metadata = { GET: { requireAuth: true, requireFeatures: addonReadFeatures, addonWriteFeatures } }
export async function GET(req: Request) {
  return addonRoute(req, false, async (ctx, service) => responseJson(batchListResponseSchema, await service.list(ctx, batchesQuerySchema.parse(queryInput(req)))) )
}
export const openApi: OpenApiRouteDoc = { tag: 'Addons', methods: { GET: { summary: 'List scoped addon list', query: batchesQuerySchema, responses: [{ status: 200, schema: batchListResponseSchema, preparedBatchSchema }], errors: apiErrors } } }

export async function POST(req: Request) {
  return addonRoute(req, true, async (ctx, service) => {
    const result = await service.prepare(ctx, prepareBatchSchema.parse(await jsonInput(req)))
    return responseJson(preparedBatchSchema, result.batch, result.replayed ? 200 : 201)
  })
}
openApi.methods.POST = { summary: 'Freeze a guarded recipient selection for confirmation', requestBody: { schema: prepareBatchSchema }, responses: [{ status: 201, schema: preparedBatchSchema }, { status: 200, schema: preparedBatchSchema }], errors: apiErrors }
