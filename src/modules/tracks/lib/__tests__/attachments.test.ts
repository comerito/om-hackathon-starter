import {
  attachmentDownloadUrl,
  attachmentTypeLabel,
  formatAttachmentSize,
  normalizeTrackAttachment,
  normalizeTrackAttachments,
} from '../attachments'

describe('normalizeTrackAttachment', () => {
  it('reads the camelCase shape returned by GET /api/attachments', () => {
    expect(normalizeTrackAttachment({
      id: 'a1',
      url: '/uploads/a1',
      fileName: 'rules.pdf',
      fileSize: 2_411_724,
      mimeType: 'application/pdf',
      createdAt: '2026-09-16T10:00:00.000Z',
      tags: [],
    })).toEqual({
      id: 'a1',
      fileName: 'rules.pdf',
      fileSize: 2_411_724,
      mimeType: 'application/pdf',
      createdAt: '2026-09-16T10:00:00.000Z',
    })
  })

  it('accepts the POST upload item, which has no mimeType or createdAt', () => {
    expect(normalizeTrackAttachment({ id: 'a2', url: '/u', fileName: 'brief.docx', fileSize: 900 })).toEqual({
      id: 'a2', fileName: 'brief.docx', fileSize: 900, mimeType: null, createdAt: null,
    })
  })

  it('still reads a snake_case item', () => {
    expect(normalizeTrackAttachment({ id: 'a3', file_name: 'x.png', file_size: '12', mime_type: 'image/png' })).toMatchObject({
      fileName: 'x.png', fileSize: 12, mimeType: 'image/png',
    })
  })

  it('treats a missing or invalid size as unknown instead of NaN', () => {
    expect(normalizeTrackAttachment({ id: 'a4', fileName: 'a' })?.fileSize).toBeNull()
    expect(normalizeTrackAttachment({ id: 'a5', fileName: 'a', fileSize: 'lots' })?.fileSize).toBeNull()
    expect(normalizeTrackAttachment({ id: 'a6', fileName: 'a', fileSize: -1 })?.fileSize).toBeNull()
  })

  it('rejects items without an id', () => {
    expect(normalizeTrackAttachment({ fileName: 'orphan.pdf' })).toBeNull()
    expect(normalizeTrackAttachment(null)).toBeNull()
    expect(normalizeTrackAttachment('a1')).toBeNull()
  })
})

describe('normalizeTrackAttachments', () => {
  it('drops unusable items and tolerates a non-array payload', () => {
    expect(normalizeTrackAttachments([{ id: 'a1', fileName: 'a.pdf' }, { fileName: 'b.pdf' }])).toHaveLength(1)
    expect(normalizeTrackAttachments(undefined)).toEqual([])
  })
})

describe('formatAttachmentSize', () => {
  it('formats bytes, kilobytes and megabytes', () => {
    expect(formatAttachmentSize(512)).toBe('512 B')
    expect(formatAttachmentSize(2048)).toBe('2.0 KB')
    expect(formatAttachmentSize(2_411_724)).toBe('2.3 MB')
  })

  it('never renders NaN', () => {
    expect(formatAttachmentSize(null)).toBeNull()
    expect(formatAttachmentSize(Number.NaN)).toBeNull()
  })
})

describe('attachmentTypeLabel', () => {
  it('prefers the file extension', () => {
    expect(attachmentTypeLabel({ fileName: 'Deck.final.pptx', mimeType: 'application/zip' })).toBe('PPTX')
  })

  it('falls back to the MIME type', () => {
    expect(attachmentTypeLabel({ fileName: 'README', mimeType: 'text/markdown' })).toBe('MD')
    expect(attachmentTypeLabel({ fileName: 'logo', mimeType: 'image/svg+xml' })).toBe('SVG')
  })

  it('returns null when nothing is known', () => {
    expect(attachmentTypeLabel({ fileName: 'blob', mimeType: 'application/octet-stream' })).toBeNull()
    expect(attachmentTypeLabel({ fileName: '.env', mimeType: null })).toBeNull()
  })
})

describe('attachmentDownloadUrl', () => {
  it('points at the core file route with a forced download', () => {
    expect(attachmentDownloadUrl('3f1c')).toBe('/api/attachments/file/3f1c?download=1')
    expect(attachmentDownloadUrl('a/b')).toBe('/api/attachments/file/a%2Fb?download=1')
  })
})
