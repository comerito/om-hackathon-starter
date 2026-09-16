/**
 * Helpers for the track attachments shown on the backend Track edit page.
 *
 * The core `/api/attachments` list (GET) and upload (POST) responses are camelCase
 * (`fileName`, `fileSize`, `mimeType`, `createdAt`), and the upload response omits
 * `mimeType` and `createdAt`. Reading them as snake_case rendered a blank name and
 * "(NaN MB)" for every file.
 */

export type TrackAttachment = {
  id: string
  fileName: string
  fileSize: number | null
  mimeType: string | null
  createdAt: string | null
}

function readString(raw: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return null
}

function readSize(raw: Record<string, unknown>): number | null {
  for (const key of ['fileSize', 'file_size']) {
    const value = raw[key]
    const size = typeof value === 'string' && value.trim() ? Number(value) : value
    if (typeof size === 'number' && Number.isFinite(size) && size >= 0) return size
  }
  return null
}

/** Maps one attachments API item to the page's shape; `null` when it has no id. */
export function normalizeTrackAttachment(raw: unknown): TrackAttachment | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const id = readString(record, 'id')
  if (!id) return null
  return {
    id,
    fileName: readString(record, 'fileName', 'file_name') ?? '',
    fileSize: readSize(record),
    mimeType: readString(record, 'mimeType', 'mime_type'),
    createdAt: readString(record, 'createdAt', 'created_at'),
  }
}

export function normalizeTrackAttachments(items: unknown): TrackAttachment[] {
  if (!Array.isArray(items)) return []
  return items
    .map(normalizeTrackAttachment)
    .filter((item): item is TrackAttachment => item !== null)
}

/** Human-readable size, or `null` when the size is unknown. */
export function formatAttachmentSize(bytes: number | null): string | null {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const MIME_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/zip': 'ZIP',
  'application/json': 'JSON',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-powerpoint': 'PPT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'text/plain': 'TXT',
  'text/markdown': 'MD',
  'text/csv': 'CSV',
}

/**
 * Short file type label ("PDF", "PNG"), from the file extension first and the MIME type
 * as a fallback, or `null` when neither says anything useful.
 */
export function attachmentTypeLabel(attachment: Pick<TrackAttachment, 'fileName' | 'mimeType'>): string | null {
  const name = attachment.fileName.trim()
  const lastDot = name.lastIndexOf('.')
  if (lastDot > 0 && lastDot < name.length - 1) {
    const extension = name.slice(lastDot + 1)
    if (/^[a-z0-9]{1,8}$/i.test(extension)) return extension.toUpperCase()
  }
  const mimeType = attachment.mimeType?.trim().toLowerCase()
  if (!mimeType || mimeType === 'application/octet-stream') return null
  if (MIME_TYPE_LABELS[mimeType]) return MIME_TYPE_LABELS[mimeType]
  const subtype = mimeType.split('/')[1]?.split(/[+;]/)[0]
  return subtype && /^[a-z0-9-]{1,12}$/.test(subtype) ? subtype.toUpperCase() : null
}

/** Core route that streams the stored bytes with `Content-Disposition: attachment`. */
export function attachmentDownloadUrl(attachmentId: string): string {
  return `/api/attachments/file/${encodeURIComponent(attachmentId)}?download=1`
}
