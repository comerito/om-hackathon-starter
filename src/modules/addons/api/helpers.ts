import { z } from 'zod'
import type { OpenApiResponseDoc } from '@open-mercato/shared/lib/openapi'
import { AddonError } from '../lib/errors'
import { resolveAddonContext, type AddonRequestContext } from '../lib/request-context'
import type { AddonBatchService } from '../lib/batch-service'

export const pathParamsSchema = z.object({ id: z.string().uuid() }).strict()
export type RouteContext = { params: Promise<{ id: string }> | { id: string } }
export async function batchId(context: RouteContext): Promise<string> { return pathParamsSchema.parse(await context.params).id.toLowerCase() }
export function queryInput(req: Request, repeatedRoles = false): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null)
  for (const [key, value] of new URL(req.url).searchParams) {
    if (key === 'roles' && repeatedRoles) {
      const roles = result.roles as string[] | undefined
      result.roles = [...(roles ?? []), value]
    } else {
      if (Object.hasOwn(result, key)) throw new AddonError('invalid_request', 400)
      result[key] = value
    }
  }
  return result
}
export async function jsonInput(req: Request): Promise<unknown> {
  // The largest legal explicit selection is under 400 KiB. Bound streaming bodies too.
  if (Number(req.headers.get('content-length')) > 512_000) throw new AddonError('invalid_request', 400)
  const reader = req.body?.getReader()
  if (!reader) throw new AddonError('invalid_request', 400)
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const next = await reader.read()
    if (next.done) break
    size += next.value.byteLength
    if (size > 512_000) { await reader.cancel(); throw new AddonError('invalid_request', 400) }
    chunks.push(next.value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown } catch { throw new AddonError('invalid_request', 400) }
}
export function responseJson<T>(schema: z.ZodType<T>, value: unknown, status = 200): Response {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new AddonError('internal_error', 500)
  return Response.json(parsed.data, { status })
}
export async function addonRoute(req: Request, write: boolean, handler: (ctx: AddonRequestContext, service: AddonBatchService) => Promise<Response>): Promise<Response> {
  try {
    const ctx = await resolveAddonContext(req, write)
    // The service runs runRouteMutationGuards for batch AND child writes within its transaction.
    return await handler(ctx, ctx.container.resolve<AddonBatchService>('addonBatchService'))
  } catch (error) {
    if (error instanceof Response) return error
    if (error instanceof AddonError) return Response.json({ error: error.code, ...error.details }, { status: error.status })
    if (error instanceof z.ZodError) return Response.json({ error: 'invalid_request' }, { status: 400 })
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '55P03') return Response.json({ error: 'operation_in_progress' }, { status: 409 })
    console.error('[addons.api] request_failed')
    return Response.json({ error: 'internal_error' }, { status: 500 })
  }
}
const errorSchema = z.object({ error: z.string(), limit: z.number().optional(), totalCount: z.number().optional() })
export const apiErrors: OpenApiResponseDoc[] = [400, 401, 403, 404, 409, 422, 500, 503].map((status) => ({ status, schema: errorSchema, description: 'Safe operation error code; no account information.' }))
