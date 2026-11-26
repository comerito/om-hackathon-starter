"use client"

import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'

export const MAX_CLIENT_EXPORT_PROJECTS = 1000

function parseFileName(header: string | null): string | null {
  if (!header) return null
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8?.[1]) return decodeURIComponent(utf8[1])
  const quoted = header.match(/filename="([^"]+)"/i)
  return quoted?.[1] ?? null
}

function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

/** POST the ids to the export endpoint and save the returned .xlsx. */
export async function downloadProjectsExport(projectIds: string[]): Promise<void> {
  const call = await apiCall<Blob>(
    '/api/projects/admin/export',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_ids: projectIds, time_zone: browserTimeZone() }),
    },
    { parse: async (response) => response.blob() },
  )

  if (!call.ok || !call.result) {
    let message = 'Failed to export projects'
    try {
      const data = (await call.response.clone().json()) as { error?: string }
      if (typeof data?.error === 'string' && data.error.trim()) message = data.error
    } catch {
      // Non-JSON error body: keep the fallback message.
    }
    throw new Error(message)
  }

  const fileName = parseFileName(call.response.headers.get('content-disposition')) ?? 'projects.xlsx'
  const url = URL.createObjectURL(call.result)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Collect the ids of every project matching the current list query (all pages), in list order.
 * `params` are the list query params without paging.
 */
export async function fetchAllMatchingProjectIds(params: Record<string, string>): Promise<string[]> {
  const ids: string[] = []
  let page = 1
  let totalPages = 1
  do {
    const response = await fetchCrudList<{ id: string }>('projects/projects', { ...params, page: String(page), pageSize: '100' })
    for (const item of response?.items ?? []) ids.push(item.id)
    totalPages = response?.totalPages ?? 1
    page += 1
  } while (page <= totalPages && ids.length < MAX_CLIENT_EXPORT_PROJECTS)
  return ids.slice(0, MAX_CLIENT_EXPORT_PROJECTS)
}
