# Dodatki: Mercato Sandboxes per Competition

**Date**: 2026-09-15
**Status**: Phase 1 foundation in progress; migration application approval and runtime verification pending
**Source brief**: [Approved brief](briefs/2026-09-15-competition-addons.md)

## 📝 TLDR

Backoffice operators select existing participants in one Competition, assign the Mercato Sandboxes addon and persist the results of a bulk simulation. Assignment belongs to a customer user within that Competition, addon, tenant and organization. This release sends no messages, calls no provisioning API and grants no access; simulated success must never count as real provisioning.

## 📝 Problem Statement

Operators need a dedicated **Dodatki → Mercato Sandboxes** screen to select recipients by Competition and participation role, confirm a precise recipient count, and inspect individual outcomes. A global user flag would conflate different Competitions, while an email-based identity or participation-row identity would create incorrect duplicates after account changes or participation recreation. A transient UI simulation would lose audit history and could not support reliable retries.

The approved brief resolves the critical product questions. Assignment, selection, simulation and history form one operator workflow; there is no separate catalog, notification or real-provisioning capability bundled here. No open product decision blocks this design. Numerical limits and transaction choices below are explicit implementation defaults, adjustable after load validation without changing the product model.

## 📝 Proposed Solution

Create a dedicated app module `addons` with one fixed addon key, `mercato_sandboxes`. Three persisted concepts represent assignment, a confirmation/delivery batch, and each selected recipient's attempt. An assignment is created on confirmed execution, independently of whether simulation succeeds. Preparing or cancelling a selection does not assign the addon.

A server-created draft batch freezes recipient UUIDs before the confirmation dialog opens. Confirmation executes a bounded, synchronous, database-only simulation transaction. This is sufficient for mock delivery and avoids introducing a worker lifecycle solely for simulated external work. Previous terminal attempts remain immutable; retry creates a new batch. No standalone assignment-management or revocation UI is introduced.

Alternatives considered:

- A bulk action on the existing participant page misses the requested dedicated navigation and history area.
- A configurable addon catalog or provider framework adds independently deployable scope; defer it.
- A queue for mock execution adds leases and crash recovery without an external side effect to manage. Revisit for actual provisioning in a separate spec.

### Research and adopted lessons

Sources fetched on 2026-09-15:

| Open-source reference | Relevant behavior | Decision here |
| --- | --- | --- |
| [Django admin actions](https://docs.djangoproject.com/en/5.2/ref/contrib/admin/actions/) | Bulk actions operate on selected querysets and support an intermediate confirmation page; bulk operations may bypass per-object behavior. | Explicit confirmation binds persisted recipient IDs; bulk execution must still invoke mutation guards for affected records. No generic admin-action engine. |
| [BullMQ job IDs](https://docs.bullmq.io/guide/jobs/job-ids) | Custom IDs suppress duplicates within a queue, but removed jobs cease to participate in deduplication. | Durable mode-specific success evidence belongs in application tables. Queue identity alone would not provide future provisioning idempotency. No BullMQ dependency for this release. |

### Repository evidence and reuse boundaries

- `src/modules/competitions/data/entities.ts`: `CompetitionParticipation` references `customerUserId`, has `role` and `deletedAt`, and is unique by Competition and customer user. It has **no `isActive` field**. `Competition` does have `isActive` and `deletedAt`.
- `src/modules/competitions/api/participations/route.ts`: the custom GET filters by tenant, but does not constrain organization. Do not use this endpoint as the new eligibility or recipient-list authority. Correcting existing screens is separate work.
- `src/modules/competitions/api/admin/customer-users/route.ts`: demonstrates `findWithDecryption` for names/email, but is a generic account lookup with its own ACL and scope behavior, not a Competition eligibility API.
- Installed `CustomerUser` in `@open-mercato/core` has `organizationId`, `tenantId`, `isActive` and `deletedAt`. Resolve current display fields through encrypted-query helpers; never copy ciphertext or names into addon history.
- `src/modules/competitions/backend/competitions/participants/page.tsx`: reuse DataTable/FilterBar, organization scope version and Competition scope patterns, not its split client-side account lookup as an authorization boundary.
- `src/modules/competitions/setup.ts`: admin and superadmin are the existing backoffice operator defaults. No root `BACKWARD_COMPATIBILITY.md` was present during design.

## 📝 Architecture

`addons` owns `data/entities.ts`, `data/validators.ts`, `di.ts`, an eligibility reader, batch service, mock simulator, API routes, ACL/setup, backend pages and PL/EN translations. Register `{ id: 'addons', from: '@app' }`. It depends on competitions and customer_accounts being enabled; if either is absent, hide this screen and reject operations with `503 dependency_unavailable` before writing.

Use a DI service boundary, `addonRecipientReader`, for read-only access to Competition, participation and customer-account data. Return scoped UUIDs/roles and, only for displayed pages, decrypted display fields. Cross-module references are scalar UUIDs, never ORM relationships; no commands or direct writes to peer modules. No modification of core packages or generated files.

Every operation resolves one authenticated tenant and one explicitly selected, authorized organization. Reject missing/all-organizations selection with `400 organization_required`; a superadmin still selects one organization. Every query, join, lock and ID lookup includes both scopes. Client-supplied tenant/organization fields are rejected.

Eligibility means: Competition exists in that exact scope, is active and not deleted; participation in that Competition and scope is not deleted; customer account exists in the same scope, is active and not deleted. Selected participation roles use OR semantics over `participant | mentor | judge`; empty roles means all three. Competition stage/dates, checked-in state and email verification do not add unrequested eligibility rules. Customer roles are not participation roles.

At preview, resolve the set under one consistent database snapshot, deduplicate by customerUserId and persist it atomically. At execution, revalidate only these IDs against the frozen role filter. A changed role still matching the filter remains eligible; a user who no longer matches is skipped. New participants are never added. Lock eligible Competition, participation and customer records for the execution transaction so concurrent deactivation/soft deletion is ordered before or after execution; existence and scope must be checked after obtaining locks.

### Transaction and concurrency contract

1. Preparation is idempotent by scoped `requestId`: store the normalized request, create a `draft` batch and its recipient rows in one transaction. Reusing the key with identical input returns that batch; different input returns `409 request_conflict`. Freeze draft membership permanently.
2. Confirmation authenticates and checks current ACL, creator ownership, scope, draft expiry and required guards, then takes the batch row lock. Repeated confirmation of a terminal batch returns the stored result; cancelled/expired drafts return `409 batch_not_confirmable`.
3. Lock peer records and recheck eligibility before assignment creation. Upsert assignments for currently eligible recipients using the permanent scoped natural key, ordered by customer UUID; lock assignment rows in the same order. Lock ordering must be fixed across all calls: batch, Competition, participants ordered by UUID, customer accounts ordered by UUID, assignments ordered by customer UUID. This avoids overlapping-batch deadlocks.
4. Under assignment locks, check successful attempts for the **same mode** before simulating. Same-mode success becomes `skipped/already_succeeded`. An existing pending attempt becomes `skipped/already_pending`; never bypass it merely because it is old. New executable rows transition `selected → pending → succeeded | failed` inside this transaction.
5. Persist all outcomes and aggregate counters, then commit the terminal batch. A request retry after a lost response reads the existing result. A process crash or database error before commit rolls back all execution writes to the original draft; there is no committed mock `pending` state to orphan.
6. Lock contention has a bounded five-second lock timeout. Return `409 operation_in_progress` without partially committing; allow retry of the same confirmation. Do not convert infrastructure errors into simulated failures.

Use `withAtomicFlush(em, phases, { transaction: true, label: 'addons.batch.confirm' })` for multi-phase ORM mutations, with an explicit flush per phase. Never query between scalar mutation and flush. Guard callbacks and cache invalidation occur after commit, are caught/logged with safe codes, and cannot turn a committed success into an apparent failed send. DB uniqueness is a second line of defense, not a substitute for transaction locking. With mock synchronous execution, waiting overlapping requests observe the first committed success, or receive lock timeout; they cannot both simulate successfully.

## 📝 Data Model

All three tables have UUID v4 `id`, UUID `tenantId`/`organizationId`, `createdAt`/`updatedAt` (`timestamptz`), `isActive` (default true) and nullable `deletedAt`. TypeScript properties are camelCase with explicit snake_case DB column mapping. Index scope columns and every reference ID. Short string fields have explicit lengths; state/key/code strings fit `varchar(64)`, request IDs are UUIDs. Use Zod enums and checks for valid state combinations.

| Entity / table | Additional fields | Invariants |
| --- | --- | --- |
| `AddonAssignment` / `addons_assignments` | `competitionId`, `customerUserId` UUID; `addonKey`; `assignedAt` timestamp; `assignedBy` backoffice UUID | Permanent unique `(tenant_id, organization_id, competition_id, customer_user_id, addon_key)`, including inactive/soft-deleted rows. Assignment says who owns the bonus; no generic `sent` flag. |
| `AddonDeliveryBatch` / `addons_delivery_batches` | `competitionId`; `addonKey`; `mode`; `createdBy`; `requestId`; `selectionKind: explicit|all_filtered`; `roles` JSONB enum array; `requestedCustomerUserIds` JSONB UUID array for explicit selection, null otherwise; `status: draft|completed|completed_with_errors|cancelled|expired`; `expiresAt`; nullable `confirmedAt`, `finishedAt`; integer `recipientCount`, `succeededCount`, `failedCount`, `skippedCount` | Unique `(tenant_id, organization_id, request_id)`; normalized source selection immutable. Stored recipient count equals snapshot rows. Terminal counters sum to recipient count. |
| `AddonDeliveryAttempt` / `addons_delivery_attempts` | `batchId`, `customerUserId` UUID; nullable `assignmentId`; `mode`; `status: selected|pending|succeeded|failed|skipped|cancelled|expired`; nullable `reasonCode`, `startedAt`, `finishedAt`; nullable positive `attemptNumber` | Unique `(batch_id, customer_user_id)`. Assignment link is populated only at execution for eligible recipients. Mode and scope must match batch and assignment. `attemptNumber` exists only when simulator was executed. |

The recipient row doubles as the immutable confirmation snapshot; this avoids a fourth snapshot table. It does not claim an execution happened while `selected`. For same-module references use scoped integrity checks and composite foreign keys including tenant/organization where supported; never cascade-delete history. Cross-module IDs are verified via the reader, without ORM relations or new cross-module cascade dependencies.

Add an index on `(tenant_id, organization_id, assignment_id, mode, status)`, and a partial unique index on `(tenant_id, organization_id, assignment_id, mode)` for non-null assignment IDs whose status is `pending` or `succeeded`. Failed, selected and skipped rows do not occupy the success slot. Include soft-deleted records in deduplication checks and this constraint; otherwise deleting history would re-enable delivery. Within the assignment lock, `attemptNumber = 1 + max(previous executed attemptNumber)` for this assignment/mode, including history. A later real provider must reserve its pending slot in a committed transaction before calling out; that lifecycle is deliberately not implemented here.

Persisted `mode` allows `mock` and reserves `real` as a distinct namespace; public stage-one inputs accept only the literal `mock` and reject `real`. No real-mode status is synthesized from mock evidence. Display state derives from attempts in the selected mode: succeeded, pending, latest failed, otherwise not simulated. A later skipped duplicate does not replace earlier successful display state.

Only IDs, enum codes, timestamps and counters are stored. Names/email remain in customer_accounts and are read with `findWithDecryption` / `findOneWithDecryption` in the exact scope. No new sensitive string field requires an encryption map. If implementation introduces PII/free-text failure descriptions, add `encryption.ts` framework maps before persistence; do not hand-roll encryption. UUIDs are access-controlled personal references, not public data. Do not log recipient lists, email, credentials or exception payloads.

History is immutable in this release; no generic update/delete endpoints. Standard soft-delete fields do not constitute a user-facing delete or revocation feature. An inactive/soft-deleted assignment yields `skipped/assignment_unavailable`, never creates a replacement or implicitly reactivates it. Existing data-erasure obligations must include these references through the application's retention process; this spec adds no independent retention policy.

## 📝 API Contracts

Prefix `/api/addons`. Every handler exports per-method `metadata` and `openApi`. Authenticate backoffice users; derive request/response types from strict Zod schemas. Every read requires `addons.view` and `competitions.participants.manage`; every mutation additionally requires `addons.send`. Grant `addons.view` and `addons.send` to existing admin/superadmin defaults in `setup.ts`, then sync role ACLs for existing tenants. Customer/portal roles receive neither feature. Scoped object misses return `404`, absent auth `401`, missing feature `403`.

| Method / endpoint | Request | Response |
| --- | --- | --- |
| `GET /competitions` | `page=1`, `pageSize=25` (1–100) | `{items:[{id,name}],totalCount,page,pageSize}` for eligible Competitions in the selected organization. Paginate selector options; never assume there are ≤100 competitions. |
| `GET /mercato-sandboxes/recipients` | Required `competitionId`; optional repeated `roles`; `page`, `pageSize` | `{items:[{customerUserId,displayName,email,role,assignmentId:null|uuid,mockStatus}],totalCount,page,pageSize}`. Deterministic role then UUID sort. No assignment is needed for a row to appear. |
| `POST /mercato-sandboxes/batches` | `{requestId,competitionId,mode:"mock",selection:{kind:"explicit",customerUserIds:[uuid],roles:[role]}}` or `{...,selection:{kind:"all_filtered",roles:[role]}}` | `201 {id,status:"draft",competitionId,competitionName,mode,recipientCount,expiresAt}`; replay `200` with existing batch. No assignment/simulation yet. |
| `GET /mercato-sandboxes/batches` | Required `competitionId`; `page`, `pageSize` | `{items:[BatchSummary],totalCount,page,pageSize}`, latest first with UUID tie-break. |
| `GET /mercato-sandboxes/batches/:id` | `page`, `pageSize` for recipient results | `{batch:BatchSummary,items:[{customerUserId,displayName,email,role:null|role,assignmentId,status,reasonCode,attemptNumber,startedAt,finishedAt}],totalCount,page,pageSize}`. Display fields are current, nullable after deletion; history still shows safe outcomes. |
| `POST /mercato-sandboxes/batches/:id/confirm` | `{}`; no new selection, mode or count accepted | `200 BatchSummary` terminal result; idempotent replay. Only creating operator may confirm. |
| `POST /mercato-sandboxes/batches/:id/cancel` | `{}` | `200 BatchSummary`; draft and selected rows become cancelled. Same cancellation is idempotent; terminal execution cannot be cancelled. Only creator may cancel. |

`BatchSummary` contains `id,competitionId,addonKey,mode,status,createdBy,createdAt,expiresAt,confirmedAt,finishedAt,recipientCount,succeededCount,failedCount,skippedCount`. Never return unrestricted serialized ORM entities.

Explicit selection is deduplicated and normalized; validate every ID against eligibility at preparation. Return a generic `422 invalid_selection` for any invalid or out-of-scope ID and create nothing; do not reveal which foreign account exists. All-filtered selection evaluates the same scoped role predicate as listing across every page in one database snapshot. Both paths reject zero recipients (`422 empty_selection`). No name/email/status search filter is introduced in stage one, avoiding ambiguous encrypted search behavior.

Drafts expire 15 minutes after preparation. Reads may report an expired effective status without a write; confirmation checks `expiresAt` under lock and persists expired batch/recipient states instead of executing. No periodic job is required. Cancel/confirm/replay always check auth, scope and creator before returning mutation results. A confirmation of an already completed batch returns stored evidence even if eligibility later changes; it performs no new send.

Default execution limit: 1,000 recipients per batch, with detection of limit+1 before persisting a snapshot. Reject oversize sets with `422 selection_too_large` and `{limit:1000,totalCount}`; never silently truncate all-filtered selection. Explain the limit in the UI and let the operator narrow roles or explicitly select a smaller set. Validate worst-case 1,000-recipient transaction duration before release; raise the limit only with evidence or redesign execution as a separate change.

### Mutation guards

Use `runRouteMutationGuards` from `@open-mercato/shared/lib/crud/route-mutation-guard` on every custom write. Preparation maps to create for `addons:addon_delivery_batch` and selected recipient rows; confirmation maps to update for batch and attempts and create for new assignments. Cancellation maps to update. Use matching colon-separated entity IDs `addons:addon_assignment` and `addons:addon_delivery_attempt`.

Pass `{ userFeatures }`, merge returned `modifiedPayload`, revalidate with Zod and recheck scope/invariants before writing. Guard modification cannot silently expand/change the confirmed membership, addon, mode, identity or role filter: reject with `409 selection_changed` and require a new preview. Run all affected-record guards; a blocked guard aborts the operation, returns its blocking Response and leaves the draft unchanged rather than bypassing policy in a bulk loop. Prepare guards operate before persisting a draft; execution guards apply to every actual write, including reused attempts. Queue only returned `afterSuccessCallbacks` for after commit; catch/log callback failures. Keep guard execution deterministic and transaction-compatible; no simulator effect precedes successful guard checks.

## 📝 UI/UX

Backend route `/backend/addons/mercato-sandboxes`, with sibling `page.meta.ts`: `requireAuth: true`, required read features, `pageGroup: 'Dodatki'`, translated `pageGroupKey` and title. Batch detail route `/backend/addons/mercato-sandboxes/batches/[id]` also has metadata and is hidden from sidebar. No portal page or notification is added.

Use framework Page, DataTable, FilterBar, CrudForm for dialog forms, Button, Dialog, EnumBadge, LoadingMessage/ErrorMessage and `flash`; all UI API calls use `apiCall`/`apiCallOrThrow`. Include PL/EN translations and accessible labels; dialogs support Cmd/Ctrl+Enter and Escape, with duplicate submission disabled during requests.

Flow:

1. Require a Competition. When the global Competition scope is set, it controls the selector; otherwise expose a paginated Competition picker. No organization/Competition means an explanatory empty state and disabled actions.
2. Show name, email, participation role and **status symulacji**. Always display “Tryb symulacji — nie przyznaje dostępu i nie wysyła wiadomości”. Separate row selection, current-page selection and explicit “Wybierz wszystkie wyniki (N)”; selection count is never merely the current page count disguised as total.
3. Selection uses customer UUIDs. Changing organization, global Competition, local Competition or roles clears selection and closes any confirmation. Stale query/preview responses must be discarded using scope/version checks; query cache keys include organization, Competition and roles. An existing server draft remains immutable until cancellation/expiry.
4. “Symuluj wysyłkę” prepares the draft. Dialog displays the server-confirmed Competition name, exact snapshot count and mock notice, and allows paginated inspection of the snapshot. Confirmation count refers to selected recipients; some may subsequently be skipped after revalidation. Cancel explicitly cancels draft; closing may best-effort cancel, with expiry as fallback.
5. Confirmation leads to persisted batch results. Success label is “Symulacja zakończona”, not “Dostęp przyznany”. Distinguish successful, failed and skipped counts with per-recipient safe translated reasons. An all-skipped batch says no new simulations were executed. Retrying selected failures prepares a new explicit-selection draft for reconfirmation, preserving earlier results.
6. Show history for the selected Competition, including draft/cancelled/expired batches. Read-only operators can inspect it without send controls. Loading, error, empty, oversized-selection, expired-preview and lost-response states are explicit. After a network error, reload batch status before presenting a retry.

## 📝 Edge Cases & Failure Scenarios

| Scenario | Persisted/user-visible behavior |
| --- | --- |
| Same user in A and B, changed role or recreated participation | Independent assignment per Competition; same natural key within one Competition, independent of participation row ID. |
| Overlapping confirmations / double-click | Same batch returns stored outcome; different batches serialize on assignments and later one skips same-mode successes. Pending blocks another execution; timeout allows safe retry. |
| Participant removed, role no longer matches, customer disabled or deleted after preview | Preserve frozen recipient row as `skipped/no_longer_eligible`; no new assignment. New eligible users are never appended. |
| Competition disabled/deleted before confirmation | Reject `409 competition_unavailable`; draft remains unexecuted and can expire/cancel. Reauthorization failure also executes nothing. |
| Simulation fails for one recipient | Assignment remains; attempt is `failed/mock_failure`, batch `completed_with_errors`; others may succeed. Retry creates fresh evidence. |
| Database/process failure or lock timeout | Entire confirmation rolls back; original draft remains. Read status before retry when commit outcome is unknown to client. |
| Guard rejection or invariant-changing modified payload | Entire operation aborts; return guard response or `409 selection_changed`. No silent partial recipient replacement. |
| Decryption unavailable | List/detail reports safe error; never displays ciphertext. Simulation eligibility reads only non-PII identity/status fields; history stores no fallback PII. |
| Mode separation | Mock history is explicitly mock. Stage-one API rejects real mode; future real-mode deduplication must ignore mock successes. |
| Cancelling after execution / undo | Terminal simulation is immutable; cancellation returns `409 batch_not_confirmable`. No real access exists to revoke. Assignment revocation/reset is outside this release. |

Deterministic mock algorithm v1: remove hyphens from the customer UUID and interpret the last byte as hex. On the first executed mock attempt for an assignment, values divisible by five yield `failed/mock_failure`; all others succeed. Subsequent executed mock attempts succeed. Skipped and draft rows never increment `attemptNumber`. Thus fixtures ending `00` fail once then succeed, and `01` succeed immediately. Label this deterministic artificial behavior in operator help; do not use random failures or expose a client override. Real mode never calls this simulator.

Safe reason codes: `mock_failure`, `already_succeeded`, `already_pending`, `no_longer_eligible`, `assignment_unavailable`. No provider errors, stacks or free-text descriptions in history. `completed_with_errors` means at least one failed simulator attempt; skipped counts remain separately visible even on `completed` batches.

## 📝 Risks & Impact Review

Additive schema and new routes/pages only; existing participant routes and core entities remain unchanged. No import/backfill of assignments from participation rows, no email credential configuration and no external network side effects. No claim of real-provider exactly-once delivery: stable scoped assignment identity, separate modes and durable attempts are groundwork; external idempotency, reconciliation, leases, rate limits, notifications and revocation need their own integration spec.

A synchronous transaction can hold many locks. Cap input, use ordered batched reads/upserts and fixed ordering, verify against PostgreSQL with parallel connections, and measure the maximum supported batch. If the maximum cannot meet the deployed request budget, reduce the documented limit and update UI/contracts together; do not ship a request that predictably times out. No eager all-recipient PII enrichment is needed during preparation/execution.

Deployment sequence: create scoped additive migration and matching snapshot; register/generate; apply approved migration before exposing routes; sync new ACLs; enable navigation only with dependencies and schema ready. After editing `src/modules/addons/data/entities.ts`, stop and ask “I modified an entity in module addons. Should I create a migration?” per AGENTS.md. On approval run `yarn db:generate`, show SQL, obtain separate application confirmation, then run `yarn db:migrate` and `yarn generate`. Keep only addon SQL plus its updated snapshot; never modify applied migrations. Immediately run `yarn generate` after editing `src/modules.ts`.

Rollback disables the addons module/routes/navigation and preserves additive tables/history; regenerate module artifacts. Re-enabling restores the same durable evidence. Do not delete successes to simulate rollback or run destructive down migrations as routine rollback. Cancellation is the supported reversal before execution; failed simulation can be retried, but terminal history cannot be erased through this UI.

## 📝 Acceptance Criteria

- [ ] One scoped assignment per customer, Competition and addon; role/participation recreation does not duplicate it.
- [ ] Selection supports rows, current page and all filtered pages, with server-frozen count and explicit confirmation.
- [ ] Every read/write enforces tenant, one authorized organization, Competition, active eligibility and ACL; foreign IDs reveal no account data.
- [ ] Successful mock attempts suppress same-mode retries only; concurrent operations and pending evidence cannot create duplicate success.
- [ ] Deterministic failure succeeds on retry, with all previous attempts retained.
- [ ] No external provisioning, email, invitation, credential, access grant or portal notification occurs.
- [ ] New participants after preview are excluded; eligibility changes produce safe skips; cancellation and expiry execute nothing.
- [ ] Guards cover bulk child mutations and cannot silently replace a confirmed set; callbacks run after commit.
- [ ] UI labels all outcomes as simulations; history includes recipient failures and skipped duplicates.
- [ ] All validation below passes before implementation is considered delivered.

## 🔍 Architectural Review

Review completed 2026-09-15 against AGENTS.md and the specification checklist. Verdict: ready for implementation planning; no unresolved Critical or High design findings. This is document review, not evidence that the feature or its tests already exist.

| Severity | Finding / disposition |
| --- | --- |
| Critical | None unresolved. All new access paths explicitly scope tenant, organization and Competition; existing participant GET is not reused as the eligibility authority. |
| High | None unresolved. Corrected execution ordering to acquire peer-record locks and revalidate before creating assignments; fixed lock ordering is now consistent throughout the transaction contract. |
| Medium | Synchronous capacity is bounded at 1,000 and must be measured before rollout. This is a delivery validation requirement, not an assertion of measured performance. |
| Low | None requiring a design change. |

| Review criterion | Verdict and evidence |
| --- | --- |
| Architectural diff | Pass: concentrates on snapshots, assignment identity, mock evidence and concurrency; reuses framework UI/auth/guards. |
| Scope cohesion | Pass: fresh-context reviewer received only this spec path and found one Competition-scoped operator workflow; API/UI phases are implementation increments. |
| Canonical mechanisms | Pass: DI, encrypted-query helpers, mutation-guard registry, shared UI and MikroORM atomic flush are explicit. |
| Contracts and compatibility | Pass: additive endpoints/schema; strict mock-only HTTP input; existing peer routes remain unchanged. |
| Reversibility | Pass: draft cancellation, transactional rollback, immutable terminal evidence and disable/re-enable rollout are defined. |
| Boundaries and coupling | Pass: scalar cross-module IDs, a read-only DI boundary and graceful dependency-disabled behavior; no peer writes. |
| Sensitive data | Pass: existing encryption protects names/email; new history stores scoped IDs and enum codes, not copied PII. |
| Failure scenarios | Pass: concurrency, stale eligibility, expiry, partial simulated failure, database errors and lost responses are covered. |
| Testability | Pass: each implementation step specifies observable checks, including real PostgreSQL concurrency and browser evidence. |

## 📋 Phasing

**Phase 1 — Persisted mock operation.** Deliver schema, scope reader and complete preparation/confirmation/history contracts behind feature permissions. Existing app remains working; this phase is API-usable without UI.

**Phase 2 — Operator UI and release validation.** Deliver the dedicated navigation, recipient selection, confirmation and history; validate the complete workflow. These are delivery increments of one capability. Real provisioning is a separate future spec, not an unchecked phase here.

## 📋 Implementation Plan

### Phase 1 — Persisted mock operation

1. **Schema and registration.** Add the `addons` module, validators, three entities, scoped indexes/constraints and migration snapshot; follow the explicit entity/migration approvals above. Add ACL declarations/default grants. Keep routes unavailable until the migration is applied. Verify uniqueness, invalid-state rejection, scoped references and mode separation against PostgreSQL; verify repeat schema generation produces no addon churn.
2. **Scope reader and preview.** Implement the DI reader, paginated Competition/recipient GETs and transactional draft creation/cancellation with guards and strict OpenAPI schemas. Verify cross-tenant/cross-organization denial, inactive entities, role OR filters, deduplicated explicit IDs, empty/oversize selections, all-filtered selection above 100 rows, immutable snapshots and requestId replay/conflict.
3. **Execution and history.** Implement confirmation, deterministic simulator, lock/guard behavior and paginated history. Test failure→retry, same-mode skip, future real-mode isolation at persistence/service level while HTTP rejects real, participation recreation, eligibility changes, expiry/cancellation and immutable results. Use real PostgreSQL parallel connections for overlap, pending exclusion and rollback/crash-boundary tests; mocks alone cannot prove locking. Inject a failure before commit and a lost response after commit; verify safe replay in each case.

### Phase 2 — Operator UI and release validation

1. **Recipient screen.** Add metadata/navigation and PL/EN UI using shared components. Verify scope switching, stale responses, selectors beyond 100 Competitions, role changes, page/row/all-filtered selection and view-only permissions; confirm the 1,000 limit is explicit and never truncates selections.
2. **Confirmation/results/history.** Wire server draft preparation, snapshot inspection, keyboard controls, cancellation, persisted results and retry-as-new-draft. Browser tests with fixtures ending `00` and `01` cover both simulator paths, accurate counts across pages, reload after network error, safe translated reasons and clear no-access mock labels. Assert no outbound provisioning/notification calls.
3. **Validation and rollout.** Prepare the configured integration environment; run `yarn generate`, `yarn typecheck`, `yarn lint`, `yarn test`, `yarn build`, plus targeted PostgreSQL integration and browser tests. Load-test 1,000 recipients with overlapping requests against the deployed request timeout; record duration and lock-timeout behavior. Verify new ACLs on an existing tenant, dependency-disabled behavior and rollback/re-enable preserving deduplication. Update acceptance checkboxes only with recorded evidence; preserve this brief/spec as the implementation source.

## Implementation Status

| Phase | Status | Date | Notes |
|-------|--------|------|-------|
| Phase 1 — Persisted mock operation | In Progress | 2026-09-15 | Module registration, ACL/default grants, validators and entity definitions added. Two scoped migrations generated and reviewed; application awaits approval. |
| Phase 2 — Operator UI and release validation | Not Started | — | Depends on persisted operation and approved migration. |

### Phase 1 — Detailed Progress

- [ ] Step 1: Schema and registration — module registered; 22 request-validation and schema-metadata tests pass; generation, typecheck, structural-cache refresh and existing-tenant role ACL synchronization passed. Two scoped migrations add three tables and composite FKs; snapshot is current and repeat addon generation reports no changes. Application approval and PostgreSQL runtime tests remain pending; no phase completion claimed.
- [ ] Step 2: Scope reader and preview.
- [ ] Step 3: Execution and history.

### Phase 2 — Detailed Progress

- [ ] Step 1: Recipient screen.
- [ ] Step 2: Confirmation/results/history.
- [ ] Step 3: Validation and rollout.
