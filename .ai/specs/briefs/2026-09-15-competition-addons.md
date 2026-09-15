# Brief: Dodatki — Mercato Sandboxes per Competition

Date: 2026-09-15
Status: User-approved brainstorm handoff; not an implementation specification.
Conclusion: Ramp 4 — feature to co-design through `om-spec-writing`.

## Goal

Let backoffice operators assign the Mercato Sandboxes bonus to competition participants and send selected recipients in bulk. Start with persisted mock delivery; integrate the external provisioning API in a later stage. Plan the entities and backend UI before implementation.

## Confirmed scope and resolved unknowns

| Question | Decision |
| --- | --- |
| Who owns a bonus? | One customer user within one Competition, per addon, tenant and organization. The user explicitly corrected the earlier global-per-user answer; that earlier answer is superseded. |
| Navigation | Sidebar group **Dodatki**, entry **Mercato Sandboxes**. |
| Recipients | Existing competition participants; use customer account IDs, not backoffice auth-user IDs or email as identity. |
| Filters | Select one Competition for sending and filter by participation roles. |
| Table | Name, email, participation role and delivery status for the selected Competition. |
| Bulk selection | Individual rows, current page, or explicitly all filtered results across pages. Confirm the Competition and recipient count before sending. |
| First-stage delivery | Mock only, with persisted simulated results, no external API call. A successful simulation does not mean actual sandbox access. |
| Retry behavior | Avoid duplicate successful sends in the same mode; allow failed attempts to be retried. Mock success must never suppress a later real send. |
| Next step | User approved the proposed scope and routing to interactive `om-spec-writing`. |

## Proposed model to develop in the spec

Three concepts, with exact entity names and fields left to specification:

- **Addon assignment:** user ID, Competition ID, stable addon key, tenant and organization; unique within that scope. Track assignment separately from evidence of actual provisioning. A role change or participation record recreation must not create another assignment.
- **Delivery batch:** the bulk operation, selected Competition, addon, mode, initiating operator, timestamps and aggregate outcome.
- **Recipient attempt:** a batch recipient linked to the assignment, with outcome, timestamps and a safe failure reason. Preserve previous attempts when retrying.

Reuse existing accounts and participation data. Initially register only Mercato Sandboxes; a configurable addon catalog or catalog-management UI is unnecessary. Follow repository UUID, tenant isolation, encryption, migration and cross-module ID-reference conventions. Avoid duplicating personal data unless necessary; encrypt any persisted sensitive fields using framework maps.

## UI and behavior defaults

- Use existing backend DataTable and filter components with pagination, loading, empty and error states.
- A user can appear independently in Competition A and Competition B, each with its own addon status.
- Multiple chosen roles match participants with any chosen role in the selected Competition.
- Changing Competition clears selection. Changing filters must not silently change a confirmed recipient set.
- Freeze the recipient set associated with the confirmation, rather than re-evaluating filters later and silently including new users. Revalidate eligibility before mutation.
- Clearly identify mock mode and simulated completion in the action, result and history. No emails, invitations, credentials or actual access are sent during this stage.
- Show results per recipient, including failures and skipped duplicates. Specify deterministic mock success/failure coverage for verification.

## Constraints and challenger findings

A fresh-context challenger found no critical product decision blocking routing. Carry these requirements into the spec:

- Distinguish mock outcomes from real provisioning outcomes in persisted data and eligibility checks.
- Enforce active participation, selected Competition, tenant, organization and operator permissions server-side for both listing and sending. Verify existing routes before reuse; do not assume they enforce all scopes.
- Prevent concurrent duplicate operations, including recipients already pending. The future provider contract should support stable user + Competition + addon idempotency; a database unique constraint alone does not prevent repeated external calls.
- Keep delivery/provisioning success distinct from notification delivery when the real integration is designed.
- Follow `AGENTS.md`: no ORM relations across module boundaries, mutation guards on custom write routes, MikroORM 7 flush rules, page metadata, ACL grants, and confirmed migration lifecycle.

## Out of scope for stage 1

Real API integration, credentials, provisioning or invitations; expiry and revocation workflows; a generic integration marketplace; addon-catalog administration. The future API contract and provider-specific lifecycle remain deferred, not assumed solved.

## Alternatives considered

1. Dedicated simple Dodatki module with assignments and delivery history — selected because it matches the requested navigation and gives operators a place to inspect state.
2. Bulk action on the existing participants page — less work, but lacks the requested addon area.
3. Build nothing and pass lists manually — viable for a one-off operation, but not selected for the requested workflow.

## Repository evidence

- `src/modules/competitions/data/entities.ts`: `CompetitionParticipation` is unique by `competitionId` and `customerUserId`; roles are `participant`, `mentor`, `judge`.
- `src/modules/competitions/backend/competitions/participants/page.tsx`: existing participant UI and filtering/pagination patterns.
- `AGENTS.md`, `.ai/skills/om-data-model-design/SKILL.md`, `.ai/skills/om-backend-ui-design/SKILL.md`: project conventions.
- `.ai/agentic.config.json`: specs directory is `.ai/specs`; GitHub tracker descriptor is installed.
- Existing spec search found no matching addon/sandbox specification. Read-only open issue and PR searches for `sandbox`, `addons`, and `bulk send` in `comerito/om-hackathon-starter` returned no matches on 2026-09-15. This does not establish absence among closed items or other terminology.

## Handoff and lifecycle

No unresolved critical product question remains from the brainstorm. The spec should develop fields, API shapes, status transitions, permissions, failure behavior and a testable implementation plan. Ask only genuinely new blocking questions; do not reopen the per-Competition decision.

Approved invocation:

`om-spec-writing "Dodatki: Mercato Sandboxes per Competition — brief: .ai/specs/briefs/2026-09-15-competition-addons.md"`

This brief remains uncommitted. The routed skill should preserve it alongside the resulting specification. Brainstorming does not execute that next skill or implement the feature.
