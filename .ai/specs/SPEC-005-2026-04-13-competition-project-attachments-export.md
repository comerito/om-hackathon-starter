# SPEC-005 — Competition Project Attachments Export

**Date**: 2026-04-13
**Status**: Draft

## TLDR

Add a backoffice feature that lets an authorized admin immediately download a single ZIP archive containing `attachment_ids` files from all projects in one competition. The implementation should build on the existing `projects` attachment ID fields and the built-in `attachments` module, without introducing new entities or changing project schema.

The v1 UX will expose this action in two backoffice places: on the competition detail/edit screen, and on the projects list when filtered to a specific competition. The generated ZIP will use a flat archive layout and include a manifest file for traceability.

## Problem Statement

Backoffice users currently can inspect and download project attachments one project at a time, but there is no competition-wide export flow. For organizers, judges, and operations staff, collecting all project files manually is slow, error-prone, and impractical when a competition has many submissions.

The gap is especially visible near demo day, judging, archival, and post-event handoff, where staff often need a complete package of all submitted files for a single competition.

## Proposed Solution

Add a competition-scoped bulk export capability for project attachments in backoffice.

At a high level:
- expose a new authorized admin endpoint in the `projects` module that accepts `competition_id`
- query all `projects:project` records for that competition within the current `organization_id`
- collect `attachment_ids` already stored on project records
- resolve file metadata and file streams via the existing attachments subsystem
- return a ZIP archive for download
- include a manifest file listing exported files and any skipped or missing attachments

The preferred v1 UI consists of:
- a `Download Project Attachments` action on the competition backoffice page
- a matching action on the projects list page that appears only when the list is filtered to a single competition

The route should return the ZIP as an immediate download response rather than creating a background job. This keeps the feature simple, avoids a new job entity, and matches the stated use case.

## UX Flow

### Entry Point A: Competition Backoffice

On the competition edit/detail page, show a secondary action:
- label: `Download Project Attachments`
- visibility: only for users with export permission
- behavior: starts download immediately for that competition

### Entry Point B: Projects List

On the projects list page:
- expose the same action only when a single `competition_id` filter is active
- if no competition filter is selected, do not show the action
- if the filter is removed, the action disappears

This avoids ambiguous exports across multiple competitions and keeps the action aligned with the chosen scope.

### Download Behavior

When triggered:
- the browser sends a request to the export endpoint with the selected `competition_id`
- the server validates scope and permissions
- the response is a ZIP download with a deterministic filename, for example:
  - `competition-{slug}-project-attachments-{YYYY-MM-DD}.zip`

If no exportable attachments are found, the UI should show a clear error message instead of downloading an empty archive.

## Data Models

No new entities are required.

Existing source of truth:
- `projects:project`
  - `competition_id`
  - `attachment_ids: string[]`

Existing supporting data resolved at runtime:
- competition metadata for archive filename and validation
- project title for manifest rows
- optional team metadata for manifest readability
- attachment metadata and file stream from the attachments subsystem

No schema changes are needed because the export is a derived read operation over existing records.

## API Contracts

### Export Endpoint

`POST /api/projects/admin/competition-attachments/export`

Request body:

```json
{
  "competition_id": "uuid"
}
```

Behavior:
- requires auth
- requires a dedicated feature: `projects.export_attachments`
- validates tenant and organization scope
- validates that the referenced competition belongs to the current organization
- gathers all project `attachment_ids` for that competition
- returns a ZIP file response with `Content-Disposition: attachment`

Response:
- `200 application/zip`
- streamed or buffered ZIP body

Archive contents:
- flat file layout only
- `manifest.json`

Filename strategy inside archive:
- all attachment files live at archive root
- each file name is normalized and prefixed to avoid collisions
- recommended pattern:
  - `{project-slug-or-id}__{attachment-id}__{original-file-name}`

This preserves a flat archive while keeping each file traceable to its source project.

Manifest fields per row:
- `project_id`
- `project_title`
- `competition_id`
- `attachment_id`
- `original_file_name`
- `archive_file_name`
- `mime_type`
- `file_size`
- `status`
- `skip_reason`

Status values:
- `exported`
- `missing`
- `inaccessible`
- `duplicate_skipped`

Error cases:
- `400` invalid request
- `403` missing permission
- `404` competition not found or not visible in current scope
- `409` export unavailable because no project attachments exist
- `500` unexpected archive generation failure

## Acceptance Criteria

- [ ] An authorized backoffice user can trigger a single download for all project attachments belonging to one competition.
- [ ] The export includes only files from projects in the selected competition and current organization scope.
- [ ] The export includes `attachment_ids` only and does not include `screenshot_ids`.
- [ ] The exported archive uses a flat file layout with deterministic file naming and includes a manifest of exported and skipped files.
- [ ] Missing or invalid attachment references do not crash the export; they are reported in the manifest.
- [ ] The feature is available from the competition detail page and from the projects list when filtered to a single competition.

## Permissions

Add a dedicated ACL feature in the `projects` module:
- `projects.export_attachments`

Rationale:
- exporting all files from a competition is a stronger capability than simple `projects.view`
- separate permission allows admins to delegate review access without granting mass file export

The export endpoint and both UI triggers must require this feature.

## Implementation Plan

### Phase 1: Backend Export Route

1. Add a new admin route in `src/modules/projects/api/admin/competition-attachments/export/route.ts`.
2. Validate request body with Zod:
   - `competition_id: uuid`
3. Require:
   - auth
   - `projects.export_attachments`
4. Query all non-deleted projects in the current organization for the given competition.
5. Flatten and deduplicate `attachment_ids`.
6. Resolve attachment metadata and file streams using the attachments subsystem.
7. Generate ZIP contents:
   - exported files at archive root
   - `manifest.json`
8. Return ZIP download response.

### Phase 2: Competition Backoffice Action

1. Update the competition detail/edit page.
2. Add a `Download Project Attachments` button in the action area or utility section.
3. Implement a browser-triggered POST download flow for the current competition.
4. Surface user-facing error feedback when the export fails or no files exist.

### Phase 3: Projects List Action

1. Extend the projects list UI with an explicit competition filter if it is not already present in the visible controls.
2. Show the export action only when exactly one competition is selected.
3. Reuse the same backend endpoint.
4. Keep the action hidden or disabled when the current filter state is ambiguous.

### Phase 4: Verification

1. Route tests:
   - permission denied
   - invalid `competition_id`
   - competition outside current organization
   - no attachments returns `409`
   - mixed valid and missing attachment IDs still produces ZIP + manifest
2. UI verification:
   - competition page button visibility by permission
   - projects list button visibility only with competition filter
3. Manual verification:
   - archive filename
   - file collision naming
   - manifest correctness

## Risks

### Large Exports

Immediate downloads may become slow or memory-intensive for very large competitions. For v1 this is acceptable, but implementation should avoid unnecessary buffering when possible and keep the code structured so an async export job can be introduced later.

### Attachment Storage Coupling

The route should use the attachments subsystem directly rather than recursively calling app HTTP endpoints. This avoids unnecessary overhead and reduces failure modes.

### Filename Collisions

A flat archive increases collision risk when different projects upload files with the same filename. The archive naming strategy must therefore include stable prefixes, not raw filenames alone.

### Partial Failures

Some attachment IDs may reference missing or inaccessible files. The export must remain best-effort and record failures in the manifest instead of aborting the whole archive.

## Notes

- This feature is intentionally export-only. It does not add project bulk management, archive browsing, or export history.
- `screenshot_ids` are explicitly excluded from v1 scope.
- Async export jobs remain a future extension, not part of the initial delivery.

## Changelog

| Date | Change |
|------|--------|
| 2026-04-13 | Initial skeleton spec with open questions |
| 2026-04-13 | Finalized v1 direction: attachments only, immediate download, flat archive, action also available from filtered projects list |
