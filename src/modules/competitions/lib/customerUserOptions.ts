import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'

export type CustomerUserOption = { id: string; displayName: string; email: string }
export type ComboboxOption = { value: string; label: string }

/**
 * Options loader for the "Customer Account" combobox on Add Participant.
 *
 * Lives outside the page so the one thing that broke it can be tested: the *name of the query
 * parameter*. It used to send `displayName=` to core's `/api/customer_accounts/admin/users`,
 * which has no such parameter and drops unknown ones without an error — so every keystroke got
 * the newest page of accounts back, `ComboboxInput` narrowed that page with its own client-side
 * filter, and anyone outside it could not be selected at all. A wrong parameter name fails
 * silently at runtime; only an assertion on the request catches it.
 */
export const CUSTOMER_USER_LOOKUP_PATH = '/api/competitions/admin/customer-users'
export const CUSTOMER_USER_LOOKUP_PAGE_SIZE = '50'

export async function loadCustomerUserOptions(query?: string): Promise<ComboboxOption[]> {
  try {
    const params: Record<string, string> = { pageSize: CUSTOMER_USER_LOOKUP_PAGE_SIZE }
    const trimmed = query?.trim()
    if (trimmed) params.search = trimmed
    const data = await readApiResultOrThrow<{ items: CustomerUserOption[] }>(
      `${CUSTOMER_USER_LOOKUP_PATH}?${new URLSearchParams(params).toString()}`,
    )
    return (data?.items ?? []).map((user) => ({
      value: user.id,
      label: `${user.displayName || user.email} (${user.email})`,
    }))
  } catch {
    return []
  }
}
