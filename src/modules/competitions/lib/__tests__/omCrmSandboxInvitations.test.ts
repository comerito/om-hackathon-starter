import {
  MERCATO_SANDBOXES_SOURCE_KEY,
  localStatusFromUpstream,
  readOmCrmSandboxInvitationConfig,
  sendOmCrmBulkCustomerInvitations,
  toOmCrmCustomers,
} from '../omCrmSandboxInvitations'

const BASE_URL = 'https://crm.example.test'
const API_KEY = 'omk_test_key'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('readOmCrmSandboxInvitationConfig', () => {
  it('requires both server-only values', () => {
    expect(readOmCrmSandboxInvitationConfig({}).ok).toBe(false)
    expect(readOmCrmSandboxInvitationConfig({ OM_CRM_BASE_URL: BASE_URL }).ok).toBe(false)
    expect(readOmCrmSandboxInvitationConfig({ OM_CRM_API_KEY: API_KEY }).ok).toBe(false)
  })

  it('strips a trailing slash from the base URL and does not echo the key', () => {
    const result = readOmCrmSandboxInvitationConfig({
      OM_CRM_BASE_URL: `${BASE_URL}/`,
      OM_CRM_API_KEY: API_KEY,
    })

    expect(result).toEqual({
      ok: true,
      config: { baseUrl: BASE_URL, apiKey: API_KEY },
    })
    if (!result.ok) return
    expect(JSON.stringify(result)).not.toContain('\n')
  })
})

describe('toOmCrmCustomers', () => {
  it('attaches the fixed source key and preserves the complete selection', () => {
    const emails = Array.from({ length: 101 }, (_, index) => `user${index}@example.com`)
    const customers = toOmCrmCustomers(emails)

    expect(customers).toHaveLength(101)
    expect(customers[0]).toEqual({
      email: 'user0@example.com',
      source_key: MERCATO_SANDBOXES_SOURCE_KEY,
    })
    expect(customers[100]?.email).toBe('user100@example.com')
    expect(customers.every((item) => item.source_key === 'hackathon_09_2026')).toBe(true)
  })
})

describe('localStatusFromUpstream', () => {
  it('maps accepted to sent and leaves conflicts and failures distinct', () => {
    expect(localStatusFromUpstream('accepted')).toBe('sent')
    expect(localStatusFromUpstream('conflict')).toBe('conflict')
    expect(localStatusFromUpstream('failed')).toBe('failed')
  })
})

describe('sendOmCrmBulkCustomerInvitations', () => {
  it('posts the complete selection in one request with x-api-key and maps by index, not email', async () => {
    const customers = toOmCrmCustomers(
      Array.from({ length: 101 }, (_, index) => `user${index}@example.com`),
    )
    const fetchImpl = jest.fn(async () =>
      jsonResponse(200, {
        ok: true,
        status: 'complete',
        processed: 101,
        results: customers.map((_, index) => ({
          index,
          email: `user${index}@example.com`,
          customerId: '55555555-5555-4555-8555-555555555555',
          customerStatus: 'created',
          invitationStatus: 'accepted',
          retryable: false,
        })),
      }),
    )

    const result = await sendOmCrmBulkCustomerInvitations(
      { baseUrl: BASE_URL, apiKey: API_KEY },
      customers,
      fetchImpl as unknown as typeof fetch,
    )

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledWith(
      `${BASE_URL}/api/sandboxes/bulk-customer-invitations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify({ customers }),
      },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.httpStatus).toBe(200)
    expect(result.results).toHaveLength(101)
    expect(result.results[0]).toEqual({ index: 0, invitationStatus: 'accepted' })
    expect(JSON.stringify(result)).not.toContain('@example.com')
    expect(JSON.stringify(result)).not.toContain('customerId')
  })

  it('maps a 207 mixed batch by index and drops emails from the client result', async () => {
    const customers = toOmCrmCustomers(['ada@example.com', 'grace@example.com', 'al@example.com'])
    const fetchImpl = jest.fn(async () =>
      jsonResponse(207, {
        ok: false,
        status: 'partial',
        processed: 3,
        results: [
          { index: 0, email: 'ada@example.com', invitationStatus: 'accepted', customerStatus: 'created', retryable: false },
          { index: 1, email: 'grace@example.com', invitationStatus: 'conflict', customerStatus: 'reused', retryable: false },
          { index: 2, email: 'al@example.com', invitationStatus: 'failed', customerStatus: 'created', retryable: true },
        ],
      }),
    )

    const result = await sendOmCrmBulkCustomerInvitations(
      { baseUrl: BASE_URL, apiKey: API_KEY },
      customers,
      fetchImpl as unknown as typeof fetch,
    )

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      ok: true,
      httpStatus: 207,
      status: 'partial',
      results: [
        { index: 0, invitationStatus: 'accepted' },
        { index: 1, invitationStatus: 'conflict' },
        { index: 2, invitationStatus: 'failed' },
      ],
    })
    expect(JSON.stringify(result)).not.toContain('@example.com')
  })

  it('treats a network failure as a request-level error without a success payload', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new TypeError('fetch failed')
    })

    const result = await sendOmCrmBulkCustomerInvitations(
      { baseUrl: BASE_URL, apiKey: API_KEY },
      toOmCrmCustomers(['ada@example.com']),
      fetchImpl as unknown as typeof fetch,
    )

    expect(result).toEqual({ ok: false, error: 'Could not reach Mercato Sandboxes.' })
    expect(JSON.stringify(result)).not.toContain(API_KEY)
    expect(JSON.stringify(result)).not.toContain('@example.com')
  })

  it('does not treat an upstream 400 as a successful item mapping', async () => {
    const customers = toOmCrmCustomers(
      Array.from({ length: 101 }, (_, index) => `user${index}@example.com`),
    )
    const fetchImpl = jest.fn(async () =>
      jsonResponse(400, { ok: false, code: 'invalid_request', error: 'Invalid bulk invitation request.' }),
    )

    const result = await sendOmCrmBulkCustomerInvitations(
      { baseUrl: BASE_URL, apiKey: API_KEY },
      customers,
      fetchImpl as unknown as typeof fetch,
    )

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      ok: false,
      httpStatus: 400,
      error: 'Mercato Sandboxes rejected the invitation request.',
    })
  })
})
