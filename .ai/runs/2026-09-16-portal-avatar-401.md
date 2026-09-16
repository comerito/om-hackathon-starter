# Execution plan — portal avatar images return 401 on GET

**Date:** 2026-09-16
**Branch:** `fix/portal-avatar-401`
**Base:** `main`
**Engine:** om-auto-create-pr (steps: 10, --loop: no)

## Goal

A portal participant who uploads an avatar can actually see it: every avatar image served to the
participant portal returns `200` instead of `401`.

## Reported symptom

> Dodałem sobie avatara, request został poprawnie przetworzony, ale jest problem z GET 401 na obrazie

The upload `POST /api/competitions/portal/profile-avatar` succeeds; the subsequent `GET` of the
returned image URL returns `401 Unauthorized`.

## Root cause

`src/modules/competitions/api/portal/profile-avatar/route.ts` stores the avatar and hands the client
`buildAttachmentFileUrl(attachmentId)` → `/api/attachments/file/<id>`. That core route
(`@open-mercato/core/modules/attachments/api/file/[id]/route.js`) authenticates with
`getAuthFromRequest` — the **backoffice** session — and then calls `checkAttachmentAccess`:

```js
if (!auth) {
  const isTenantScoped = !!attachment.tenantId || !!attachment.organizationId
  if (isTenantScoped) return { ok: false, status: 401 }
  return { ok: true }
}
```

A portal participant carries a `customer_auth_token` session, not a backoffice one, so
`getAuthFromRequest` returns `null`. The avatar attachment *is* tenant-scoped (the upload sets
`tenantId` and `organizationId`), so the branch above fires and the image 401s. The `productsMedia`
partition being `isPublic: true` does not help — public partitions still reject anonymous reads of
tenant-scoped rows.

The same applies to `/api/attachments/image/<id>`, so the participants directory
(`api/portal/participants/route.ts`, which rewrites avatars to 128×128 thumbnails through
`buildAttachmentImageUrl`) is broken identically, as are the chat avatars.

## Scope

Serve portal avatars through a portal-authenticated route owned by this app, exactly like the
existing precedent `src/modules/projects/api/portal/asset-file/[id]/route.ts`:

- a new `GET /api/competitions/portal/avatars/[attachmentId]` that authenticates with
  `getCustomerAuthFromRequest`, scopes to the caller's tenant, refuses any attachment that is not a
  participant-profile avatar, and supports the same `width`/`height`/`cropType` thumbnailing the
  participants grid already asks for;
- a small URL helper so every portal API response emits that URL;
- the database keeps storing the canonical `/api/attachments/file/<id>` in
  `competitions_participant_profile.avatar_url`, and the rewrite happens at the API boundary — so
  **already-uploaded avatars are fixed with no data migration**.

## Non-goals

- No change to the core attachments module, its access rules, or its partitions (framework code is
  read-only here).
- No change to backoffice avatar rendering (it is authenticated and already works).
- No change to team avatars (`teams.avatar_url` holds operator-provided URLs, not attachments).
- No change to the upload flow, size cap, or storage layout.

## Risks

- **Exposure surface.** The new route lets any authenticated portal user in the tenant read any
  participant-profile avatar. That matches what the portal already renders (participants directory,
  chat) and the route hard-refuses attachments whose `entityId` is not
  `competitions:participant_profile`, so it cannot be used as a generic attachment reader.
- **New direct dependency on `sharp`.** It is already in the tree at `0.35.3` as a dependency of
  `@open-mercato/core` (and of Next.js); declaring it explicitly removes a phantom import and costs
  one lockfile line. Without it the participants grid would have to download full-size (up to 5 MB)
  originals instead of 128 px thumbnails.
- **Cache poisoning across tenants.** The thumbnail cache is keyed by attachment id, and the
  attachment lookup is tenant-scoped before any cache read, so a cached thumbnail cannot leak into
  another tenant.

## Implementation Plan

### Phase 1 — Portal avatar URL helper

A single place that knows how to turn a stored attachment URL into a portal-servable URL, and back.

- 1.1 Add `src/modules/competitions/lib/avatarUrls.ts`: `buildPortalAvatarUrl(attachmentId, opts)`,
  `toPortalAvatarUrl(storedUrl, opts)` (accepts both `/api/attachments/file/<id>` and
  `/api/attachments/image/<id>[/slug]`, passes external `http(s)` URLs through untouched) and
  `toCanonicalAvatarUrl(url)` for normalising inbound writes.
- 1.2 Unit tests for the helper, including the pass-through and null cases.

### Phase 2 — Portal-authenticated avatar route

- 2.1 Declare `sharp` in `package.json` dependencies.
- 2.2 Add `src/modules/competitions/api/portal/avatars/[attachmentId]/route.ts` with
  `metadata.GET.requireCustomerAuth`, tenant scoping, the participant-profile entity guard,
  optional `width`/`height`/`cropType` resizing via `sharp` reusing core's thumbnail cache and
  image-safety helpers, and `openApi`.
- 2.3 Unit tests for the route: unauthenticated → 401, another tenant → 404 (the tenant filter
  lives in the query, so a foreign id is simply not found rather than confirmed), non-avatar
  attachment → 403, missing file → 404, happy path → 200 with the image bytes.

### Phase 3 — Emit the portal URL from every portal API

- 3.1 `api/portal/profile-avatar/route.ts` — return the portal URL in the POST response while
  continuing to store the canonical URL.
- 3.2 `api/portal/update-profile/route.ts` — rewrite `avatar_url` on the GET and PUT responses and
  normalise any inbound `avatar_url` back to canonical before persisting.
- 3.3 `api/portal/participants/route.ts` — replace `toThumbnailUrl` with the shared helper.
- 3.4 `api/portal/chat/route.ts` and `api/portal/chat/[threadId]/route.ts` — rewrite the avatar URLs
  they return.

### Phase 4 — Validation

- 4.1 Run the full configured gate: `yarn generate`, `yarn typecheck`, `yarn lint`, `yarn test`,
  `yarn build`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Portal avatar URL helper

- [x] 1.1 Add the avatar URL helper module — 7642268
- [x] 1.2 Unit tests for the avatar URL helper — 7642268

### Phase 2: Portal-authenticated avatar route

- [x] 2.1 Declare `sharp` as a direct dependency — 95bce08
- [x] 2.2 Add the portal avatar route — 00a6114
- [x] 2.3 Unit tests for the portal avatar route — 00a6114

### Phase 3: Emit the portal URL from every portal API

- [x] 3.1 Rewrite the avatar URL in the upload response — 7d466e6
- [x] 3.2 Rewrite the avatar URL in the profile API — 7d466e6
- [x] 3.3 Rewrite the avatar URL in the participants directory — 7d466e6
- [x] 3.4 Rewrite the avatar URL in the chat APIs — 7d466e6

### Phase 4: Validation

- [x] 4.1 Run the full validation gate — `yarn generate` ✅, `yarn typecheck` ✅, `yarn test` ✅ (612
  passed / 55 suites), `yarn build` ✅. `yarn lint` ❌ **pre-existing**: the script is `next lint`,
  which Next 16 removed, so it reads `lint` as a directory name and exits 1; the repo also carries
  no `eslint.config.*`. `git show origin/main:package.json` has the identical script, so this fails
  the same way on an untouched checkout and is not caused by this change. Not fixed here — giving
  the repo an ESLint 9 flat config is its own change.
