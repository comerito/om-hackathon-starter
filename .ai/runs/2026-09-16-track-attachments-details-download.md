# Show real file details and a download action for track attachments

## Goal

The **Attachments** section of the backend Track edit page (`/backend/tracks/<id>/edit`) must
show each file's real name, size and type, and let the operator download the file.

## Root cause

The page types the `/api/attachments` response as snake_case
(`file_name`, `file_size`, `mime_type`), but the core attachments API returns camelCase
(`fileName`, `fileSize`, `mimeType`, `createdAt`) — both from `GET` (list) and `POST` (upload).
So `att.file_name` is `undefined` (blank name) and `formatFileSize(undefined)` computes
`undefined / 1048576` → `NaN MB`, which is the reported screenshot. There is no download link.

The core module already serves the bytes at `/api/attachments/file/<id>?download=1`
(`Content-Disposition: attachment`, tenant/org-scoped, partition access checks), which the
backend Project edit page already links to.

## Scope

- `src/modules/tracks/lib/attachments.ts` (new) — pure helpers: normalize the API item
  (camelCase, tolerant of snake_case), human file size (never `NaN`), file type label from
  MIME type / extension, download URL.
- `src/modules/tracks/lib/__tests__/attachments.test.ts` (new) — unit tests.
- `src/modules/tracks/backend/tracks/[id]/edit/page.tsx` — use the helpers; render name,
  size · type · upload date; a Download action; translate the hard-coded labels.
- `src/modules/tracks/i18n/{en,pl}.json` — new label keys.

## Non-goals

- The participant portal track page (`frontend/[orgSlug]/portal/tracks/[trackId]`) — its API
  selects snake_case columns via raw SQL, so it is not affected.
- The Project edit page, which already maps camelCase correctly.
- Attachment storage, access rules, or any entity/migration change.

## Implementation Plan

### Phase 1: Attachment helpers

1. Add `lib/attachments.ts` with `normalizeTrackAttachment`, `formatAttachmentSize`,
   `attachmentTypeLabel`, `attachmentDownloadUrl`.
2. Unit tests covering the camelCase API shape, the upload response (no `mimeType`), invalid
   sizes, and the download URL encoding.

### Phase 2: Track edit page

1. Normalize list and upload responses through the helper; render the file details row.
2. Add the Download action and translate the section's labels (en + pl).

## Risks

- Low. Client-only change on one backend page; the download route is a stock core route
  already used elsewhere in this app.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Attachment helpers

- [x] 1.1 Add track attachment helpers — a590d99
- [x] 1.2 Unit-test track attachment helpers — d15a785

### Phase 2: Track edit page

- [ ] 2.1 Render real file details on the track edit page
- [ ] 2.2 Add download action and translated labels
