/**
 * The Add Participant combobox could only ever offer a slice of the customer directory because
 * its loader sent `displayName=<query>` to an endpoint with no `displayName` parameter. Unknown
 * query parameters are dropped without an error, so the bug was invisible everywhere except in
 * the dropdown: the newest page came back for every keystroke and `ComboboxInput` filtered *that*
 * client-side.
 *
 * These assertions are therefore about the request, not the return value — the URL and the
 * parameter name are the whole defect.
 */

const mockReadApiResultOrThrow = jest.fn()

jest.mock(
  '@open-mercato/ui/backend/utils/apiCall',
  () => ({ readApiResultOrThrow: (...args: unknown[]) => mockReadApiResultOrThrow(...args) }),
  { virtual: true },
)

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { loadCustomerUserOptions } = require('../customerUserOptions') as typeof import('../customerUserOptions')

function requestedUrl(): URL {
  expect(mockReadApiResultOrThrow).toHaveBeenCalledTimes(1)
  return new URL(mockReadApiResultOrThrow.mock.calls[0][0] as string, 'http://localhost')
}

beforeEach(() => {
  jest.clearAllMocks()
  mockReadApiResultOrThrow.mockResolvedValue({ items: [] })
})

describe('loadCustomerUserOptions', () => {
  it('sends the typed text as `search`, the parameter the endpoint actually reads', async () => {
    await loadCustomerUserOptions('tom')

    const url = requestedUrl()
    expect(url.pathname).toBe('/api/competitions/admin/customer-users')
    expect(url.searchParams.get('search')).toBe('tom')
    // The parameter that silently did nothing.
    expect(url.searchParams.get('displayName')).toBeNull()
  })

  it('does not aim at core users endpoint, which has no name filter', async () => {
    await loadCustomerUserOptions('tom')

    expect(requestedUrl().pathname).not.toContain('/api/customer_accounts/admin/users')
  })

  it('omits `search` entirely when nothing has been typed', async () => {
    await loadCustomerUserOptions()

    expect(requestedUrl().searchParams.has('search')).toBe(false)
  })

  it('treats a whitespace-only query as no query', async () => {
    await loadCustomerUserOptions('   ')

    expect(requestedUrl().searchParams.has('search')).toBe(false)
  })

  it('labels an option with the display name and the address, keyed by account id', async () => {
    mockReadApiResultOrThrow.mockResolvedValue({
      items: [{ id: 'user-1', displayName: 'Tomasz Nocon', email: 'tom@example.com' }],
    })

    await expect(loadCustomerUserOptions('tom')).resolves.toEqual([
      { value: 'user-1', label: 'Tomasz Nocon (tom@example.com)' },
    ])
  })

  it('falls back to the address when the account has no display name', async () => {
    mockReadApiResultOrThrow.mockResolvedValue({
      items: [{ id: 'user-2', displayName: '', email: 'anon@example.com' }],
    })

    await expect(loadCustomerUserOptions('anon')).resolves.toEqual([
      { value: 'user-2', label: 'anon@example.com (anon@example.com)' },
    ])
  })

  it('degrades to an empty list rather than breaking the form when the lookup fails', async () => {
    mockReadApiResultOrThrow.mockRejectedValue(new Error('boom'))

    await expect(loadCustomerUserOptions('tom')).resolves.toEqual([])
  })
})

// Keep this file a module so its top-level bindings stay file-scoped.
export {}
