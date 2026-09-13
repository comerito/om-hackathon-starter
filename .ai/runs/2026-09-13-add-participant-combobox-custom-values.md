# Run: Add Participant — selecting a customer, then clicking Add, does nothing

Date: 2026-09-13
Slug: `add-participant-combobox-custom-values`
Branch: `fix/add-participant-combobox-custom-values`
Base: `main`

## Goal

Fix `/backend/competitions/participants/create`: after selecting an existing customer account
(e.g. "Maciej Greń") and clicking **Add**, nothing happens and focus lands back on the Customer
Account field.

## Diagnosis

Follow-up to [[participants-customer-account-picker]] (PR #194, merged) — that run fixed the
combobox's *search*; this is a second, independent defect in the same form's *submit* path.

`competition_id` and `customer_user_id` on `participants/create/page.tsx` are both `combobox`
fields resolving a foreign key (a competition id / a customer user id). Neither field set
`allowCustomValues`, so `CrudForm`'s combobox render defaults it to `true`
(`node_modules/@open-mercato/ui/src/backend/CrudForm.tsx:4448`) — a default meant for combobox
fields that legitimately accept free text, not FK lookups.

`ComboboxInput.confirmSelection` (`node_modules/@open-mercato/ui/src/backend/inputs/ComboboxInput.tsx`)
runs whenever the input loses focus (blur) or the user presses Enter without an arrow-highlighted
suggestion. It tries to match the *currently typed text* against a known option's exact label
(`"Name (email)"`); clicking a suggestion row bypasses this (it commits the id directly) but typing
a name and then pressing Enter/Tab, or clicking straight to the Add button without first clicking
the row, does not. When the input text doesn't match any option's exact label and
`allowCustomValues` is `true`, `confirmSelection` falls through to `selectValue(rawText)` — the
*typed text itself* becomes the field's value.

That raw text is non-empty, so the client's required-field check
(`CrudForm.tsx` `handleSubmit`) passes. The request reaches
`POST /api/competitions/participations`, which validates against
`createParticipationSchema` (`customer_user_id: z.string().uuid()`,
`src/modules/competitions/data/validators.ts:196-200`) — a non-UUID string fails, and the resulting
field-level error refocuses the same combobox. From the operator's side that reads as "I selected
them, clicked Add, and nothing happened" — no navigation, no visible change, focus back on
Customer Account.

This is the existing convention for FK-style comboboxes elsewhere in the app —
`src/modules/judging/components/TrackCombobox.tsx:39` already sets `allowCustomValues={false}` for
exactly this reason. `participants/create/page.tsx` is the only form covered by this run; the same
gap exists on every other `type: 'combobox'` CrudField across the app (Competition pickers in
`judging`, `tracks`, `sponsors`, `teams`, `milestones`, `agenda`, `announcements`, `info-cards`,
plus the Sponsor/Team pickers) — flagged as a non-goal below, not fixed here.

## Scope

- `participants/create/page.tsx`: set `allowCustomValues: false` on `competition_id` and
  `customer_user_id`.
- Extract the field-builder into its own module (`fields.ts`) so it can be unit-tested without
  dragging in `CrudForm`/`Page` (and their `sanitize-html`/`htmlparser2` ESM chain, which this
  app's Jest config does not transform).
- Unit test pinning `allowCustomValues: false` on both FK comboboxes.

## Non-goals

- Not touching `CrudForm`'s own default (`allowCustomValues ?? true`) — that's framework code in
  `node_modules`, and the default is correct for combobox fields that are genuinely free-text
  (e.g. tag-style inputs).
- Not auditing/fixing every other `type: 'combobox'` CrudField across the app that shares this gap
  (see Diagnosis) — flagging it, not expanding scope to a repo-wide sweep in this run.
- No entity/migration changes; no new ACL feature.

## Implementation Plan

### Phase 1: fix + test

- Extract `buildFields` (and `loadCompetitions`) into `participants/create/fields.ts`.
- Set `allowCustomValues: false` on both FK combobox fields.
- Add a unit test pinning the above.

### Phase 2: validation

Run the full gate: `yarn generate`, `yarn typecheck`, `yarn test`, `yarn build`. (`yarn lint` is
still broken repo-wide — Next.js 16.1.5 removed `next lint` and this app has no standalone ESLint
config; see PR #194's validation notes.)

## Risks

- Low risk: the change only tightens an already-documented, already-used field option
  (`allowCustomValues`) on two fields; it does not touch shared framework code.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: fix + test

- [x] 1.1 Extract `fields.ts`, set `allowCustomValues: false` on both FK comboboxes — ba0534b
- [x] 1.2 Add a unit test pinning `allowCustomValues: false` — ba0534b

### Phase 2: validation

- [x] 2.1 Run the full validation gate — `yarn generate` ✅, `yarn typecheck` ✅, `yarn test`
  (556/556 passed) ✅, `yarn build` ✅. `yarn lint` still cannot run (pre-existing, see PR #194).

Status: complete
