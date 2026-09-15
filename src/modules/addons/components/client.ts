'use client'
import * as React from 'react'
import { z } from 'zod'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { hasAllFeatures } from '@open-mercato/shared/lib/auth/featureMatch'

export class AddonApiError extends Error {
  constructor(public code: string, public limit?: number, public totalCount?: number) { super(code) }
}
export async function readApi<S extends z.ZodType>(path: string, schema: S, body?: Record<string, unknown>): Promise<z.infer<S>> {
  const response = await apiCall<unknown>(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined)
  if (!response.ok) {
    const error = z.object({ code: z.string().optional(), error: z.string().optional(), limit: z.number().optional(), totalCount: z.number().optional() }).safeParse(response.result)
    throw new AddonApiError(error.success ? error.data.code ?? error.data.error ?? 'request_failed' : 'request_failed', error.success ? error.data.limit : undefined, error.success ? error.data.totalCount : undefined)
  }
  return schema.parse(response.result)
}
export function useAddonPermissions(scope: string) {
  const [permissions, setPermissions] = React.useState({ canSend: false, userId: null as string | null })
  React.useEffect(() => {
    let active = true
    setPermissions({ canSend: false, userId: null })
    void readApi('/api/auth/feature-check', z.object({ granted: z.array(z.string()), userId: z.string() }), { features: ['addons.send', 'addons.view', 'competitions.participants.manage'] }).then((result) => {
      if (active) setPermissions({ canSend: hasAllFeatures(['addons.send', 'addons.view', 'competitions.participants.manage'], result.granted), userId: result.userId })
    }).catch(() => {})
    return () => { active = false }
  }, [scope])
  return permissions
}
export const batchPath = '/api/addons/mercato-sandboxes/batches'
