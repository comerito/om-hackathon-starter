import { z } from 'zod'

export const MERCATO_SANDBOXES_SOURCE_KEY = 'hackathon_09_2026' as const

export type OmCrmSandboxInvitationConfig = {
  baseUrl: string
  apiKey: string
}

export type OmCrmSandboxInvitationCustomer = {
  email: string
  source_key: typeof MERCATO_SANDBOXES_SOURCE_KEY
}

export type OmCrmInvitationStatus = 'accepted' | 'conflict' | 'failed'

export type OmCrmItemOutcome = {
  index: number
  invitationStatus: OmCrmInvitationStatus
}

export type OmCrmBulkSuccess = {
  ok: true
  httpStatus: 200 | 207
  status: 'complete' | 'partial'
  results: OmCrmItemOutcome[]
}

export type OmCrmBulkFailure = {
  ok: false
  httpStatus?: number
  error: string
}

export type OmCrmBulkResult = OmCrmBulkSuccess | OmCrmBulkFailure

const omCrmItemSchema = z.object({
  index: z.number().int().min(0),
  invitationStatus: z.enum(['accepted', 'conflict', 'failed']),
}).passthrough()

const omCrmSuccessSchema = z.object({
  ok: z.boolean(),
  status: z.enum(['complete', 'partial']),
  results: z.array(omCrmItemSchema),
}).passthrough()

export function readOmCrmSandboxInvitationConfig(
  env: Record<string, string | undefined> = process.env,
): { ok: true; config: OmCrmSandboxInvitationConfig } | { ok: false; error: string } {
  const baseUrl = env.OM_CRM_BASE_URL?.trim()
  const apiKey = env.OM_CRM_API_KEY?.trim()
  if (!baseUrl || !apiKey) {
    return { ok: false, error: 'Mercato Sandboxes invitation is not configured.' }
  }
  return {
    ok: true,
    config: {
      baseUrl: baseUrl.replace(/\/+$/, ''),
      apiKey,
    },
  }
}

export function toOmCrmCustomers(emails: string[]): OmCrmSandboxInvitationCustomer[] {
  return emails.map((email) => ({
    email,
    source_key: MERCATO_SANDBOXES_SOURCE_KEY,
  }))
}

export function localStatusFromUpstream(
  invitationStatus: OmCrmInvitationStatus,
): 'sent' | 'conflict' | 'failed' {
  if (invitationStatus === 'accepted') return 'sent'
  if (invitationStatus === 'conflict') return 'conflict'
  return 'failed'
}

function errorForStatus(status: number): string {
  if (status === 401 || status === 403) {
    return 'Mercato Sandboxes invitation is not authorized.'
  }
  if (status === 400 || status === 413) {
    return 'Mercato Sandboxes rejected the invitation request.'
  }
  return 'Mercato Sandboxes invitation request failed.'
}

function outcomesCoverEveryIndex(results: OmCrmItemOutcome[], expectedCount: number): boolean {
  if (results.length !== expectedCount) return false
  const seen = new Set<number>()
  for (const item of results) {
    if (item.index < 0 || item.index >= expectedCount) return false
    if (seen.has(item.index)) return false
    seen.add(item.index)
  }
  return seen.size === expectedCount
}

export async function sendOmCrmBulkCustomerInvitations(
  config: OmCrmSandboxInvitationConfig,
  customers: OmCrmSandboxInvitationCustomer[],
  fetchImpl: typeof fetch = fetch,
): Promise<OmCrmBulkResult> {
  const url = `${config.baseUrl}/api/sandboxes/bulk-customer-invitations`
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify({ customers }),
    })
  } catch {
    return { ok: false, error: 'Could not reach Mercato Sandboxes.' }
  }

  if (response.status !== 200 && response.status !== 207) {
    return {
      ok: false,
      httpStatus: response.status,
      error: errorForStatus(response.status),
    }
  }

  let parsed: unknown
  try {
    parsed = await response.json()
  } catch {
    return { ok: false, httpStatus: response.status, error: 'Mercato Sandboxes returned an invalid response.' }
  }

  const body = omCrmSuccessSchema.safeParse(parsed)
  if (!body.success) {
    return { ok: false, httpStatus: response.status, error: 'Mercato Sandboxes returned an invalid response.' }
  }

  const results: OmCrmItemOutcome[] = body.data.results.map((item) => ({
    index: item.index,
    invitationStatus: item.invitationStatus,
  }))
  if (!outcomesCoverEveryIndex(results, customers.length)) {
    return { ok: false, httpStatus: response.status, error: 'Mercato Sandboxes returned an invalid response.' }
  }

  return {
    ok: true,
    httpStatus: response.status,
    status: body.data.status,
    results,
  }
}
