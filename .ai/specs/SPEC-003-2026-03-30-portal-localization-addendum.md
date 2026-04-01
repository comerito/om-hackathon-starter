# SPEC-003 — Portal Localization & Multilingual Content Addendum

**Date**: 2026-03-30
**Status**: Draft
**Related**: `SPEC-001`, `SPEC-002`

## TLDR

Add full Polish support to the portal in two layers:
1. localize all portal and backoffice UI copy with module dictionaries
2. localize admin-managed entity content using Open Mercato's built-in entity translation system

The app already contains the framework primitives needed for this: locale dictionaries, `useT`/`resolveTranslations`, `entity_translations`, `translations.ts`, and `TranslationManager`. The missing work is in the custom hackathon modules: hard-coded English copy, lack of module `i18n/` files, lack of `translations.ts` declarations, and portal APIs that return only base-language content.

## Problem Statement

The current portal is effectively single-language.

- Many portal pages and layout components still render hard-coded English strings.
- Backoffice-managed content such as competition descriptions, agenda items, announcements, tracks, sponsors, prizes, judging criteria, and project copy is stored as a single scalar value.
- Portal APIs return raw entity fields without locale-aware overlays.
- Backoffice forms allow entering only one value per field, even when the same content is rendered in multiple languages on the portal.

This blocks a Polish-first participant experience and makes bilingual operation expensive for admins.

## Scope

This addendum covers:

- Portal UI and layout localization
- Backend/admin UI localization for the custom hackathon modules
- Multilingual editorial content for portal-facing entities
- Locale-aware portal API responses
- Admin workflows for editing translated content

This addendum does not cover:

- machine translation
- SEO work beyond public portal metadata
- multilingual email templates beyond the data model hooks needed to support them later
- arbitrary user-generated content translation by default

## Assumptions

1. The portal must support at least `pl` and `en`.
2. Polish is the default participant-facing locale for this app unless overridden by organization or user preference.
3. Base entity columns remain the canonical fallback values.
4. Alternate locale values are stored in `entity_translations`, not duplicated as per-language columns.
5. For create flows, admins can save the base record first and add translations immediately after via Translation Manager. Same-screen side-by-side editing is phase 2, not required for MVP.

## Current State Audit

### Platform Support Already Present

- App dictionaries exist in `src/i18n/*.json`.
- Locale helpers are already used in app/layout code.
- The framework provides:
  - `translations.ts` auto-discovery
  - generated translatable-field registry
  - `TranslationManager`
  - `entity_translations`
  - `applyTranslationOverlays(...)` for read-time localization

### Gaps In Custom Modules

- No custom hackathon module currently defines `i18n/*.json`.
- No custom hackathon module currently defines `translations.ts`.
- Portal pages still contain substantial hard-coded English UI copy.
- Portal API routes return base entity fields directly.
- Some portal-facing content is buried in JSON structures, especially `Competition.infoCards`, which is not a good fit for top-level translation overlays.

## Proposed Solution

### 1. Localize Static UI Copy With Module Dictionaries

Each custom module that renders portal or backend UI will define:

- `src/modules/<module>/i18n/en.json`
- `src/modules/<module>/i18n/pl.json`

All user-facing strings in these modules must be moved behind translation keys, including:

- page headings
- CTA labels
- empty states
- filter labels
- enum labels
- validation and flash messages
- portal layout labels
- page metadata labels where present

### 2. Localize Editorial Content With Entity Translations

Each content-heavy module will define `translations.ts` and declare translatable fields per entity. Example shape:

```ts
export const translatableFields: Record<string, string[]> = {
  'competitions:competition': ['name', 'description'],
}
```

This enables:

- Translation Manager injection into CrudForm edit pages
- consistent storage in `entity_translations`
- locale-specific overlays without changing every entity schema

### 3. Apply Localized Overlays In Portal Read APIs

Portal and public read APIs must resolve the active locale and overlay translated values before returning payloads.

Preferred locale resolution order:

1. explicit portal locale parameter or persisted switcher state
2. customer user preference
3. organization default locale
4. browser/app default
5. fallback to `pl`

### 4. Refactor Nested JSON Content That Contains User-Facing Text

Any nested JSON structure containing portal-rendered text should be moved to a real entity or otherwise normalized.

The immediate required refactor is:

- replace `Competition.infoCards` JSONB with `CompetitionInfoCard` entity

This keeps multilingual values first-class and compatible with Translation Manager.

## Field Inventory

### Competitions Module

#### `Competition`

Entity: `competitions:competition`

- `name`: translatable
- `description`: translatable
- `location`: do not translate by default
- `code_of_conduct_url`: not translatable
- `rules_url`: not translatable
- `privacy_policy_url`: not translatable
- `cover_image_url`: not translatable
- `info_cards`: refactor out of JSONB

#### `CompetitionInfoCard` (new)

Entity: `competitions:competition_info_card`

- `key`: not translatable
- `icon`: not translatable
- `sort_order`: not translatable
- `label`: translatable
- `value`: translatable

#### `AgendaItem`

Entity: `competitions:agenda_item`

- `title`: translatable
- `description`: translatable
- `type`: not translatable as data; localize enum label in UI
- `location`: not translatable by default
- `speaker_name`: not translatable
- `speaker_bio`: translatable
- `speaker_photo_url`: not translatable

#### `Announcement`

Entity: `competitions:announcement`

- `title`: translatable
- `content`: translatable
- `priority`: not translatable as data; localize enum label in UI
- `category`: not translatable as data; localize enum label in UI
- `action_url`: not translatable
- `action_label`: translatable

#### `Milestone`

Entity: `competitions:milestone`

- `name`: translatable
- `description`: translatable
- `status`: not translatable as data; localize enum label in UI

#### `ParticipantProfile`

Entity: `competitions:participant_profile`

- `bio`: optional translation support, phase 3
- `organization`: do not translate
- `specialty`: optional translation support, phase 3
- `skills`: do not translate as stored data in MVP

#### `CompetitionParticipation`

- `looking_for_team_description`: optional translation support, phase 3

### Tracks Module

#### `Track`

Entity: `tracks:track`

- `name`: translatable
- `short_description`: translatable
- `description`: translatable
- `category`: keep as canonical key/string in MVP; localize display label in UI if categories become controlled
- `badge`: keep as canonical key/string in MVP; localize display label in UI
- `icon_url`: not translatable
- `color`: not translatable
- `max_teams`: not translatable

### Sponsors Module

#### `Sponsor`

Entity: `sponsors:sponsor`

- `name`: translatable
- `description`: translatable
- `tier`: not translatable as data; localize enum label in UI
- `challenge_title`: translatable
- `challenge_description`: translatable
- `challenge_resources_url`: not translatable
- `contact_name`: do not translate
- `contact_email`: not translatable

#### `Prize`

Entity: `sponsors:prize`

- `name`: translatable
- `description`: translatable
- `category`: not translatable as data; localize enum label in UI
- `value`: not translatable
- `rank`: not translatable

### Projects Module

#### `Project`

Entity: `projects:project`

- `title`: translatable
- `tagline`: translatable
- `description`: translatable
- `problem_statement`: translatable
- `solution`: translatable
- `tech_stack`: do not translate in MVP
- `preexisting_code_description`: translatable
- `built_during_hackathon_description`: translatable
- `flagged_reason`: optional translation support, phase 3

### Teams Module

#### `Team`

Entity: `teams:team`

- `name`: optional translation support, phase 3
- `description`: optional translation support, phase 3
- `disqualification_reason`: optional translation support, phase 3
- `table_location`: do not translate by default

#### `TeamResource`

Entity: `teams:resource`

- `name`: optional translation support, phase 3
- `metadata`: not translatable in MVP

#### `TeamInvitation`

- `message`: optional translation support, phase 3

### Judging Module

#### `JudgingCriterion`

Entity: `judging:criterion`

- `name`: translatable
- `description`: translatable

#### `JudgePanel`

- `name`: optional translation support, phase 3

#### `ProjectScore`

- `comment`: do not translate
- `private_notes`: do not translate

### Incidents Module

#### `IncidentReport`

- No multilingual requirement in MVP for incident narrative fields.
- Admin-entered resolution copy can remain single-language in MVP.

## Module Deliverables

### Add `i18n/` Files

Required modules:

- `competitions`
- `tracks`
- `sponsors`
- `projects`
- `teams`
- `judging`
- `incidents`

Minimum locale files per module:

- `i18n/en.json`
- `i18n/pl.json`

### Add `translations.ts`

Required modules in MVP:

- `competitions`
- `tracks`
- `sponsors`
- `projects`
- `judging`

Optional in phase 3:

- `teams`
- `incidents`

## Data Model Changes

### Required

1. Add `src/modules/<module>/translations.ts` files for MVP modules.
2. Introduce `CompetitionInfoCard` entity and migrate away from `Competition.infoCards` JSONB.
3. Keep existing scalar content fields as base/fallback values.
4. Do not add `*_pl` / `*_en` columns.

### Not Required

- No schema change is required for most translatable scalar fields because translations live in `entity_translations`.
- No ORM cross-module relationship changes are needed.

## API Contracts

### Locale Handling

All portal-facing read endpoints must support locale-aware output. The locale must be resolved server-side.

Affected routes include at minimum:

- `GET /api/competitions/portal/competition-data`
- `GET /api/sponsors/portal/sponsors-view`
- `GET /api/projects/portal/my-project`
- `GET /api/teams/portal/my-membership`
- `GET /api/competitions/portal/participants`
- `GET /api/judging/portal/*`

### Read Behavior

For entities with declared translatable fields:

1. fetch base records
2. load translations for returned entity IDs
3. overlay translated field values for the active locale
4. fall back to base values when a field translation is missing

### Write Behavior

Base CRUD routes continue to create and update canonical values exactly as today.

Translated values are managed separately via the framework translation API:

- `GET /api/translations/:entityType/:entityId`
- `PUT /api/translations/:entityType/:entityId`
- `DELETE /api/translations/:entityType/:entityId`

### Backoffice UX Contract

- Create page: save base record first.
- Edit page: Translation Manager is available automatically for entities declared in `translations.ts`.
- Phase 2 enhancement: add explicit locale tabs or a shortcut action on key content forms if admin usability is insufficient.

## UI Surface Inventory

### Portal Pages Requiring Dictionary Work

- landing page
- login / signup / accept invite
- dashboard
- competition
- agenda
- announcements
- participants
- tracks list and track detail
- mentor
- team
- teams
- project
- sponsors
- voting
- judging
- judging detail
- presentations
- kiosk
- results
- incident
- profile
- QR / check-in pages

### Shared Portal Components Requiring Dictionary Work

- top bar
- navigation labels
- section titles
- status badges
- filter pills
- empty states
- countdown and deadline copy
- flash messages

## Implementation Phases

## Phase 1 — Static UI Localization

Goal: all portal and custom backend UI renders Polish correctly, without changing content storage.

Steps:

1. Add module `i18n/en.json` and `i18n/pl.json` files.
2. Replace hard-coded strings in portal pages and shared components with translation keys.
3. Replace hard-coded strings in custom backend CRUD pages and tables with translation keys.
4. Localize enum display labels, badge labels, placeholders, validation/flash copy.
5. Verify public portal pages and authenticated portal pages under `pl`.

Acceptance:

- No visible English UI copy remains in the localized Polish portal except untranslated content entered by admins.

## Phase 2 — Admin-Managed Content Localization MVP

Goal: admins can provide Polish and English values for portal-facing content-heavy entities.

Steps:

1. Add `translations.ts` for `competitions`, `tracks`, `sponsors`, `projects`, `judging`.
2. Run generation so translation-field registry is rebuilt.
3. Confirm Translation Manager appears on edit forms for declared entities.
4. Update admin guidance and QA flows for base-content-first editing.
5. Apply localized overlays in portal read APIs.
6. Add locale fallback tests for translated and untranslated records.

Acceptance:

- A competition, track, sponsor, prize, judging criterion, agenda item, announcement, milestone, or project can display different content in `pl` and `en` without schema duplication.

## Phase 3 — Nested Content & Optional User Content

Goal: cover remaining portal-facing text that does not fit the generic top-level translation model.

Steps:

1. Replace `Competition.infoCards` JSONB with `CompetitionInfoCard`.
2. Migrate existing info card data.
3. Add optional translations for `ParticipantProfile.bio`, `Team.name`, `Team.description`, invitation messages, and similar user-facing fields if product requires it.
4. Decide whether user-authored content should be bilingual, author-language only, or mixed.

Acceptance:

- No important portal-facing text remains trapped in non-localizable JSON blobs.

## Phase 4 — Locale Preference & Admin UX Improvements

Goal: improve usability after MVP works.

Steps:

1. Persist portal locale preference per customer user.
2. Add organization default locale setting if needed.
3. Add language switcher in the portal shell.
4. Optionally add form-level translation shortcuts or locale tabs for high-frequency editorial entities.

Acceptance:

- Participants can reliably stay in Polish without resetting locale.
- Admin translation editing flow is efficient enough for daily use.

## Risks

### Risk 1: JSONB Content Bypasses Translation Infrastructure

Mitigation:

- normalize nested text-bearing JSON into entities before trying to localize it

### Risk 2: Inconsistent Locale Resolution Across Portal Routes

Mitigation:

- centralize locale resolution and reuse it across portal read APIs

### Risk 3: Admin UX Friction On Create Flows

Mitigation:

- accept base-record-first workflow in MVP
- only build richer translation tabs if real usage justifies it

### Risk 4: Over-localizing User-Generated Content

Mitigation:

- keep user-authored fields out of MVP unless product explicitly needs bilingual publishing

## Acceptance Criteria

- [ ] All portal layouts, shared components, and pages support Polish UI copy through dictionaries.
- [ ] Custom backend pages for hackathon modules support Polish UI copy through dictionaries.
- [ ] MVP entities expose translatable content through `translations.ts` and Translation Manager.
- [ ] Portal APIs overlay translated values for the active locale with fallback to canonical values.
- [ ] `Competition.infoCards` is refactored or otherwise made safely localizable.
- [ ] The same record can render different content in `pl` and `en` without per-language schema columns.
- [ ] Existing non-localized records continue to render safely through fallback values.

## Changelog

| Date | Change |
|------|--------|
| 2026-03-30 | Initial addendum draft |
