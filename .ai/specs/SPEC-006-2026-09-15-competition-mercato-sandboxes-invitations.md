# SPEC-006 — Competition Mercato Sandboxes Invitations

**Date**: 2026-09-15
**Status**: Draft

## TLDR

Add a small backoffice action to send selected competition participants to
Mercato Sandboxes through the existing `om-crm` bulk invitation endpoint. The
action lives on the existing `Participants` table: the operator selects rows
with DataTable checkboxes and uses one bulk action button to send. It does not
use CSV, a separate picker, or a custom selection component.

After a successful per-user invitation response, the competition application
stores a timestamp on `CompetitionParticipation` and displays it in the
participants list. No invitation history, retry queue, or new tab is added.

## Problem Statement

Competition operators need to invite participants to Mercato Sandboxes after
they have been added to a competition. The current backoffice has a
`Participants` list and an `Invitations` tab for the competition portal, but no
simple way to select one or more participants and trigger the separate sandbox
invitation flow.

The operation is intentionally one-shot: send the request, show the outcome,
and keep only enough local state to prevent accidental duplicate sends.

## Proposed Solution

Extend the existing `Participants` DataTable with:

- DataTable row selection (checkboxes appear when `bulkActions` is set);
- one bulk action, `Invite to Mercato Sandboxes`, shown after at least one row
  is selected;
- DataTable's header checkbox as the only select-all control (current page);
- a `Mercato Sandboxes` column showing `Sent: {timestamp}` or an empty state.

The browser calls the existing authenticated `competitions` route with the
selected participation IDs. The route resolves those tenant-scoped participants
and their decrypted emails, then calls `om-crm` once with the eligible
customers. The machine API key is used only on the server.

No separate picker, candidates list, or multi-select component is added above
the table. Selection and the send button are DataTable features on the page
that already lists participants.

The `om-crm` endpoint remains the owner of customer creation and sandbox
invitation delivery:

```text
Participants DataTable selection
  -> competitions admin API
  -> om-crm /api/sandboxes/bulk-customer-invitations (one request for selected unsent users)
  -> Mercado Sandboxes invitation service
```

The request sent to `om-crm` contains only the email and the fixed source key:

```json
{
  "customers": [
    {
      "email": "person@example.com",
      "source_key": "hackathon_09_2026"
    }
  ]
}
```

The invitation type remains server-owned by `om-crm`:
`hackathon_09_2026_invitation`.

## Clarified Decisions

### Accepted

- Recipients are chosen with DataTable row checkboxes on the existing
  `Participants` table. The send control is one `bulkActions` entry, not a
  custom panel.
- DataTable's header checkbox selects all rows on the current page. That is the
  only select-all behavior.
- Selection is limited to currently loaded table rows (the current page). There
  is no competition-wide "select all unsent" and no selection of rows on other
  pages.
- The UI sends `selection.mode: "selected"` with the selected participation
  IDs. `mode: "all"` is leftover picker machinery and is removed with the
  picker.
- Already-sent rows may still be checked, because DataTable does not disable
  selection per row. The action skips them and does not call `om-crm` for those
  IDs.
- All selected rows in one send must share the same `competition_id`. A mixed
  selection is rejected in the UI before the request is sent.

### Deliberate limitation

Reusing DataTable selection means one send covers only the current page
(`pageSize` stays at or below 100). Inviting participants on later pages
requires repeating the action. This replaces the earlier searchable
multi-select and competition-wide select-all. The cost is extra clicks for
large competitions; the gain is no custom picker and the same selection UX as
other backoffice tables.

The API still sends the complete selected payload in one upstream request and
does not batch or truncate IDs. It no longer needs a UI path that produces more
than one page of IDs in a single click.

### Operational dependency

The deployed `om-crm` endpoint and the network path must accept the resulting
request payload. If an external limit rejects it, the application reports the
failure and does not claim that unconfirmed invitations were sent; it does not
introduce a hidden local cap.

## Scope

### In scope

- Selecting one participant on the current table page for a smoke test.
- Selecting any number of currently loaded participants with DataTable
  checkboxes, including the header checkbox for the current page.
- Sending those selected IDs to `om-crm` in one request.
- Skipping already-sent rows included in the selection.
- Processing `om-crm` results per item.
- Persisting the time of a successful sandbox invitation request.
- Showing the sent marker in the existing participants table.
- Handling complete, partial, configuration, authentication, mixed-competition,
  empty-eligible, and upstream failures with a concise backoffice message.
- Removing the Stage 2 picker UI, candidates route, and unused `mode: "all"`
  selection path.

### Out of scope

- A custom picker, searchable multi-select, or other selection UI besides
  DataTable checkboxes and `bulkActions`.
- Selecting participants that are not on the current table page.
- Competition-wide "select all unsent" across pagination.
- CSV upload or CSV-specific behavior.
- A new tab, invitation history, audit entity, or retry queue.
- Automatic retries or background workers.
- Unsending or cancelling a Mercado Sandboxes invitation.
- Reading live invitation status back from `om-crm` or Mercado Sandboxes.
- Changes to the existing competition-portal invitation flow.
- New CRM or portal entities in this application.

## UX Flow

1. The operator opens `Participants` for a selected competition.
2. The operator checks one or more rows, or uses the header checkbox to select
   every row on the current page.
3. DataTable shows the selected count and one button:
   `Invite to Mercato Sandboxes`.
4. The operator confirms the send.
5. The client keeps only unsent rows that share one `competition_id`, then
   posts those IDs as `selection.mode: "selected"`.
6. The server sends one request to `om-crm` containing that selection.
7. Successful rows receive a timestamp and display `Sent` in the table.
8. A partial response shows how many succeeded and failed; no local marker is
   written for failed or conflicting rows.

The `Invitations` tab remains dedicated to invitations for the competition
portal. It is not used for sandbox invitation state.

### Screen sketch — before and after

The current screen has a separate picker above the table. The updated screen
keeps only the DataTable: checkboxes, one bulk action, and the sent column.

```text
BEFORE — Stage 2 picker above the table

┌─ Competition ───────────────────────────────────────────────────────────┐
│ Participants   | Invitations                                             │
├──────────────────────────────────────────────────────────────────────────┤
│ Participants to invite                                                   │
│ [ Search users...                                      ▼ ]               │
│ Selected: 2                         [Invite to Mercato Sandboxes (2)]   │
│                                                                          │
│ Participants                                                             │
│ ┌──┬──────────────────────┬──────────────────────┬─────────────────────┐ │
│ │  │ Name                 │ Email                │ Mercato Sandboxes   │ │
│ ├──┼──────────────────────┼──────────────────────┼─────────────────────┤ │
│ │  │ Anna Kowalska        │ anna@example.com      │                     │ │
│ └──┴──────────────────────┴──────────────────────┴─────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘


AFTER — DataTable row selection and one bulk action

┌─ Competition ───────────────────────────────────────────────────────────┐
│ Participants   | Invitations                                             │
├──────────────────────────────────────────────────────────────────────────┤
│ Participants                                                             │
│ Filters: [search]     2 selected  [Invite to Mercato Sandboxes]          │
│                                                                          │
│ ┌──┬──────────────────────┬──────────────────────┬─────────────────────┐ │
│ │☑ │ Name                 │ Email                │ Mercato Sandboxes   │ │
│ ├──┼──────────────────────┼──────────────────────┼─────────────────────┤ │
│ │☑ │ Anna Kowalska        │ anna@example.com      │ Sent: 15.09 10:32   │ │
│ │☑ │ Jan Nowak            │ jan@example.com       │                     │ │
│ │☐ │ Ola Wiśniewska       │ ola@example.com       │                     │ │
│ └──┴──────────────────────┴──────────────────────┴─────────────────────┘ │
│                                                                          │
│ Header checkbox selects the current page only. Later pages are a         │
│ separate send.                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

## Data Model

Add one nullable, machine-owned field to the existing
`CompetitionParticipation` entity:

```text
mercato_sandboxes_invited_at timestamptz nullable
```

TypeScript shape:

```ts
mercatoSandboxesInvitedAt: Date | null
```

This belongs on `CompetitionParticipation`, rather than on the global
customer-user record, because the backoffice operation is scoped to a specific
competition and participant relationship. It is a persisted fact because it
must survive page reloads and prevents a later send from repeatedly targeting
the same rows.

No separate custom entity is required. The field must not be editable through
the normal participation form; it is written only by the sandbox invitation
route after a successful upstream item result.

The entity change requires a generated and reviewed competitions migration.
The migration is applied only after explicit confirmation.

## API Contracts

### Competition route

`POST /api/competitions/admin/sandbox-invitations`

Metadata:

```ts
{
  POST: {
    requireAuth: true,
    requireFeatures: ['competitions.participants.manage'],
  },
}
```

Request body (the only UI contract after Stage 3):

```json
{
  "competition_id": "uuid",
  "selection": {
    "mode": "selected",
    "participation_ids": ["uuid"]
  }
}
```

The route must validate that selected participation records belong to the
requested competition, current tenant, and current organization scope. It
must exclude deleted records.

Already-marked rows in `participation_ids` are skipped: they are not sent to
`om-crm` and their timestamp is left unchanged. If every submitted ID is
already marked or none resolve to an unsent row, the route returns a clear
error and does not call `om-crm`.

`selection.participation_ids` may contain any number of IDs. The route must not
reject a selection because it exceeds 100 items, split it into 100-item
batches, or silently drop IDs.

The route resolves customer-user emails with the framework decryption helper;
it must not expose the upstream API key or log email addresses.

Response shape:

```json
{
  "ok": true,
  "status": "complete",
  "sent": 1,
  "conflicts": 0,
  "failed": 0,
  "results": [
    {
      "participation_id": "uuid",
      "status": "sent"
    }
  ]
}
```

Per-item statuses are `sent`, `conflict`, or `failed`. A `207` response is
used when at least one item is not `sent`; a `200` response is used when every
item is `sent`. The response must not contain invitation tokens.

### Removed with Stage 3

These existed only for the Stage 2 picker and are not part of the aligned UX:

- `GET /api/competitions/admin/sandbox-invitation-candidates`
- `selection.mode: "all"` on the invitation route
- `SandboxInvitationPanel` and picker helpers used only by that panel

### Upstream `om-crm` route

The competitions application calls the existing route:

`POST {OM_CRM_BASE_URL}/api/sandboxes/bulk-customer-invitations`

Headers:

```text
Content-Type: application/json
x-api-key: {OM_CRM_API_KEY}
```

The body is the complete `customers` array described above. The competitions
route maps upstream response indexes back to local participation IDs, so it
does not need to log or return email addresses.

Required server configuration:

- `OM_CRM_BASE_URL` — base URL of the `om-crm` application;
- `OM_CRM_API_KEY` — an organization-scoped API key authorized for
  `sandboxes.bulk_invitation.send` in `om-crm`.

Both values are server-only. Missing configuration is reported as a local
configuration error and does not update any participation marker.

## State and Failure Behavior

- Upstream `accepted` result: set `mercatoSandboxesInvitedAt` to the current
  time for that participation and flush the update.
- Upstream `conflict`: leave the marker empty and report a conflict.
- Upstream item failure: leave the marker empty and report a failure.
- Upstream `207`: persist markers only for items with `accepted` status.
- Network, invalid response, payload-size, or configuration failure: do not
  mark unconfirmed users as sent.
- Selected rows that already have a sent marker are skipped locally and are not
  marked as a new send.
- A mixed-competition selection is rejected in the UI and does not call the
  route.
- The application does not automatically recover an upstream request rejected
  because of an external payload-size limit; it reports the failure and keeps
  the selected participants unsent for a later manual attempt.
- A later manual attempt is allowed for rows without a sent marker; no
  automatic retry is performed.
- External invitations cannot be rolled back if the local database update
  fails after delivery. This limitation is accepted for the one-shot v1 flow.

## Acceptance Criteria

- [ ] An authorized operator can select one unsent participant in the
      Participants DataTable and send a sandbox invitation without uploading a
      CSV.
- [ ] Checking rows shows DataTable's selected count and one
      `Invite to Mercato Sandboxes` bulk action. No separate picker is shown.
- [ ] The header checkbox selects all rows on the current page only.
- [ ] The selected participant's row shows a sent marker after an accepted
      upstream result.
- [ ] Already marked participants included in the selection are skipped and
      remain marked with their original timestamp.
- [ ] Selecting only already-sent rows does not call `om-crm`.
- [ ] A mixed-competition selection is rejected without sending.
- [ ] A successful `200` response marks all accepted items as sent.
- [ ] A partial `207` response marks only items whose upstream result is
      accepted.
- [ ] Conflicts and failures remain visibly unsent and are included in the
      result summary.
- [ ] The API key is never sent to the browser and is not written to logs.
- [ ] Existing `Participants` and `Invitations` behavior remains unchanged
      apart from DataTable selection, the bulk action, and the sent column.
- [ ] Missing `om-crm` configuration produces a clear error without changing
      local invitation markers.

## Verification Plan

### Automated

- Validator tests for `mode: "selected"` (and removal of `mode: "all"`).
- Route tests for tenant/organization scoping and invalid IDs.
- Route tests proving already-sent IDs in a selected payload are skipped and
  do not call `om-crm` when none remain.
- Upstream client tests for request URL, `x-api-key`, and response mapping.
- Route tests for `200`, `207`, conflict, network failure, and missing config.
- Persistence tests proving only accepted items receive timestamps.
- UI tests for DataTable row selection, the single bulk action, confirmation,
  skip of already-sent rows, mixed-competition rejection, and result refresh.

### Manual smoke test

1. Configure `OM_CRM_BASE_URL` and an authorized `OM_CRM_API_KEY`.
2. Open a competition on the Participants tab.
3. Check exactly one unsent participant; use `Invite to Mercato Sandboxes`;
   confirm.
4. Verify the `Mercato Sandboxes` marker appears after refresh.
5. Select several unsent rows on the current page, including one already-sent
   row, and verify only unsent rows are submitted.
6. Change page and confirm the previous page's selection is not included.

## Delivery Stages

### Stage 1 — Successful sandbox invitations are persisted per participation

Implement the nullable participation timestamp, migration, scoped competition
route, upstream `om-crm` client call with no application-side batching limit,
and per-item result handling. Verify complete and partial responses with mocked
upstream calls.

Finish line: a route test proves that only accepted upstream items receive a
timestamp and that failures do not.

### Stage 2 — Participants can select and send sandbox invitations

Superseded for UX. Delivered a searchable picker and select-all-unsent above
the table. Stage 3 replaces that UI with DataTable bulk selection.

Finish line at the time: an operator could choose one participant or all unsent
participants in the selected competition from a custom picker.

### Stage 3 — Participants table bulk action sends sandbox invitations

Dependencies: Stage 1.

Readiness: ready to implement.

Replace the Stage 2 picker with DataTable row selection and one
`bulkActions` button on the existing Participants table. Confirm before send.
Skip already-sent rows. Reject mixed-competition selections. Remove
`SandboxInvitationPanel`, the candidates route, and unused `mode: "all"`.
Keep the sent column and the Stage 1 invitation route for selected IDs.

Finish line: an operator can check one or more rows on the current page and
send sandbox invitations from the table's bulk action, with no separate picker
on the page.

#### Scope and boundaries

- Host change is `src/modules/competitions/backend/competitions/participants/page.tsx`.
- Pass `bulkActions` so DataTable enables checkboxes and renders one button
  after selection.
- `onExecute` uses the existing confirm dialog, `apiCall`, and table refresh.
- Failure handling for mixed competition, already-sent-only, config, and
  upstream errors ships with the action.
- Outside this stage: CSV, portal invitations, live upstream status, and any
  custom selection widget.

#### Implementation steps

1. Add one `bulkActions` entry on the Participants DataTable; remove
   `SandboxInvitationPanel` from the page.
2. In `onExecute`, confirm, keep unsent rows that share one `competition_id`,
   and POST `mode: "selected"` with those IDs.
3. Flash complete / partial / failure results and invalidate the participations
   query so the sent column refreshes.
4. Skip already-sent IDs in the selected-mode route so a mixed checkbox set
   does not re-invite marked rows.
5. Remove the candidates route, picker-only helpers, `mode: "all"`, and unused
   i18n keys.
6. Update tests to cover DataTable selection behavior and the skip path.

#### Criteria and evidence

| Criterion | How to verify | Expected result |
| --- | --- | --- |
| Primary success | Check one unsent row, run the bulk action, confirm | Route is called with that ID; sent marker appears after refresh |
| Meaningful failure | Select only already-sent rows, or rows from two competitions | No `om-crm` call; concise flash error |
| Affected existing behavior | Portal Invitations tab, row actions, filters | Unchanged except sandbox bulk action and checkboxes |

## Permissions and Deployment

The route reuses `competitions.participants.manage`; no new local ACL
feature is required. The `om-crm` API key must separately have the
`sandboxes.bulk_invitation.send` capability and be scoped to the matching
organization.

Before enabling the action in a deployed environment, configure both server
variables and verify connectivity to the `om-crm` endpoint. No existing
competition invitation configuration is changed.

## Rollback and Limitations

The UI action and route can be disabled or removed without attempting to revoke
external invitations. The nullable timestamp should be retained during a
rollback so existing data remains readable; removing it is not part of the
initial rollback path.

The application stores only a local sent timestamp, not the authoritative
Mercato Sandboxes invitation status. This is deliberate for v1 and keeps the
feature one-shot and operationally small.

DataTable selection does not span pages. That is an accepted v1 limitation.

## Changelog

| Date | Change |
|------|--------|
| 2026-09-15 | Initial specification: participant selection, one-shot bulk invitation through `om-crm`, and persisted sent marker |
| 2026-09-15 | Clarified searchable multi-select recipients and removed the application-side 100-user limit and batching |
| 2026-09-15 | Stage 1 implemented: participation timestamp, scoped admin route, om-crm client, and mocked persistence tests |
| 2026-09-15 | Stage 2 implemented: Participants-tab picker, select-all unsent, send action, and sent column |
| 2026-09-15 | Stage 3 implemented: DataTable bulk invite, skip already-sent, picker and candidates route removed |

## Implementation Status

| Phase | Status | Date | Notes |
|-------|--------|------|-------|
| Stage 1 — Successful sandbox invitations are persisted per participation | Done | 2026-09-15 | Route tests prove only accepted upstream items receive a timestamp. Migration generated but not applied. |
| Stage 2 — Participants can select and send sandbox invitations | Done | 2026-09-15 | Picker UX delivered; superseded by Stage 3. |
| Stage 3 — Participants table bulk action sends sandbox invitations | Done | 2026-09-15 | DataTable `bulkActions` replaces the picker. Already-sent rows are skipped. Candidates route and `mode: "all"` removed. |

### Stage 1 — Detailed Progress
- [x] Nullable `mercatoSandboxesInvitedAt` on `CompetitionParticipation`
- [x] Scoped competitions migration (pending apply)
- [x] `POST /api/competitions/admin/sandbox-invitations`
- [x] Upstream om-crm client with no application-side batching limit
- [x] Per-item result handling for `200` / `207` / conflict / failure / missing config
- [x] Route test: only accepted items receive a timestamp

### Stage 2 — Detailed Progress
- [x] Searchable competition-scoped multi-select
- [x] Select-all-unsent control
- [x] Action button, confirmation, sent column, result refresh

### Stage 3 — Detailed Progress
- [x] DataTable `bulkActions` on Participants
- [x] Confirm and send selected unsent IDs
- [x] Skip already-sent rows; reject mixed competitions
- [x] Remove picker, candidates route, and `mode: "all"`
