# Run: Participants — "Customer Account" picker only offers a slice of the accounts

Date: 2026-09-13
Slug: `participants-customer-account-picker`
Branch: `fix/participants-customer-account-picker`
Base: `main`

## Goal

Make the **Customer Account** combobox on `/backend/competitions/participants/create` search the whole
customer-account directory instead of client-filtering a fixed first page of 20 accounts.

## Diagnosis

`src/modules/competitions/backend/competitions/participants/create/page.tsx` loads its options with

```ts
if (query) params.displayName = query
… GET /api/customer_accounts/admin/users?pageSize=20&displayName=<query>
```

`displayName` is **not a parameter that endpoint accepts**. Core's route
(`@open-mercato/core/modules/customer_accounts/api/admin/users.ts`, v0.6.7) reads only
`page`, `pageSize`, `status`, `customerEntityId`, `personEntityId`, `roleId` and `search`;
everything else is dropped silently. So every keystroke re-fetches *the 20 most recently
created accounts* and `ComboboxInput` then narrows that page with its own client-side
substring filter — which is exactly the reported symptom: `Tom` matches (they happen to sit
in the newest 20), someone invited to another competition earlier does not, and no amount of
typing can reach them.

Two adjacent call sites in the same feature pass an `ids=` parameter that the endpoint does not
accept either:

- `participants/page.tsx` — `?pageSize=100&ids=<50 ids>` for the name column. Works today only
  because the tenant has fewer than 100 accounts; past that, names silently go missing.
- `participants/[id]/page.tsx` — `?ids=<one id>&pageSize=1` returns the *newest* account in the
  org, not the requested one, so the detail page can attribute a participation to the wrong
  person. (It also reads `display_name` while the endpoint returns `displayName`.)

All three need a lookup endpoint that supports `search` and `ids`; core's does neither, and
core cannot be edited from an app. Add one in the `competitions` module.

## Scope

- New `GET /api/competitions/admin/customer-users` (app-owned, `competitions.participants.manage`).
- Repoint the three participants backend pages at it.
- Unit tests for the new route.

## Non-goals

- No change to core's `customer_accounts` admin users endpoint or UI (`node_modules`, not ours).
- No change to the invitation flows (`bulk-invite`, `resend-invitation`, the invite dialogs).
- No entity/migration changes.
- No new ACL feature — reuse `competitions.participants.manage`, which already gates all three pages.

## Implementation Plan

### Phase 1: app-owned customer-user lookup endpoint

Create `src/modules/competitions/api/admin/customer-users/route.ts`:

- `metadata.GET = { requireAuth: true, requireFeatures: ['competitions.participants.manage'] }`.
- Scope: `tenantId` from auth, organization from `resolveOrganizationScopeForRequest` (same
  resolution `bulk-invite` uses, so the picker matches what the participation write path sees).
- `ids=<comma list>` → exact lookup of those accounts (capped), pagination ignored.
- `search=<text>` → the same two mechanisms core uses, because `display_name` / `email` are
  encrypted columns and ILIKE on ciphertext can never match:
  - `search_tokens` prefix-token lookup (`tokenizeText` + `resolveSearchConfig`),
  - `email_hash` candidates for an email-shaped query.
  A query too short to yield any token (`OM_SEARCH_MIN_LEN`, default 3) falls back to the plain
  first page rather than an empty result, so the combobox keeps behaving for 1–2 characters.
- Otherwise → first page ordered by `created_at DESC`.
- Response `{ items: [{ id, displayName, email }], total }`, read through `findWithDecryption`.

### Phase 2: repoint the three participants pages

- `create/page.tsx` — `loadCustomerUsers` calls the new route with `search`, `pageSize=50`.
- `page.tsx` — name map fetches the new route with `ids`.
- `[id]/page.tsx` — single lookup via the new route with `ids`, reading `displayName`.

### Phase 3: validation

Run the full gate: `yarn generate`, `yarn typecheck`, `yarn lint`, `yarn test`, `yarn build`.

## Risks

- Search depends on `search_tokens` being populated for `customer_accounts:customer_user`.
  Verified against the local database: 16/16 accounts indexed. If an environment has never run
  the indexer, search degrades to "no results" — the same behaviour core's own customer-accounts
  admin list already has.
- `OM_SEARCH_ENABLE_PARTIAL=false` would make the index store whole words only, so prefix
  queries (`tom` → `Tomasz`) would stop matching. Default is `true`, and this repo's `.env`
  sets it explicitly.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: app-owned customer-user lookup endpoint

- [x] 1.1 Add the `customer-users` admin route with `ids` / `search` support — 029b128
- [x] 1.2 Add unit tests covering ids lookup, token search, short-query fallback and scoping — 029b128

### Phase 2: repoint the three participants pages

- [x] 2.1 Point the Add Participant combobox at the new route — f7c8efd
- [x] 2.2 Point the participants list name map at the new route — f7c8efd
- [x] 2.3 Point the participant detail page at the new route — f7c8efd

### Phase 3: validation

- [x] 3.1 Run the full validation gate — `yarn generate` ✅, `yarn typecheck` ✅, `yarn test`
  (554/554 passed) ✅, `yarn build` ✅. `yarn lint` cannot run: `next lint` was removed in the
  installed Next.js 16.1.5 and no standalone ESLint config exists in this app, so the command
  errors before checking anything (`Invalid project directory provided, no such directory:
  .../lint`) — a pre-existing, repo-wide gap unrelated to this change, not something this run
  introduced or can fix in scope.

Status: complete
