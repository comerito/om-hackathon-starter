"use client"

import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

function parseFileNameFromDisposition(header: string | null): string | null {
  if (!header) return null

  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1])

  const quotedMatch = header.match(/filename=\"([^\"]+)\"/i)
  if (quotedMatch?.[1]) return quotedMatch[1]

  const bareMatch = header.match(/filename=([^;]+)/i)
  if (bareMatch?.[1]) return bareMatch[1].trim()

  return null
}

export async function downloadCompetitionAttachments(competitionId: string): Promise<void> {
  const call = await apiCall<Blob>(
    '/api/projects/admin/competition-attachments/export',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ competition_id: competitionId }),
    },
    {
      parse: async (response) => response.blob(),
    },
  )

  if (!call.ok || !call.result) {
    let message = 'Failed to export attachments'
    try {
      const data = await call.response.clone().json() as { error?: string }
      if (typeof data?.error === 'string' && data.error.trim().length > 0) {
        message = data.error
      }
    } catch {
      // Keep fallback message when the error body is not JSON.
    }
    throw new Error(message)
  }

  const fileName =
    parseFileNameFromDisposition(call.response.headers.get('content-disposition')) ??
    `competition-${competitionId}-project-attachments.zip`

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
