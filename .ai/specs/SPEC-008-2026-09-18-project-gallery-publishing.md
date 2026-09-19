# SPEC-008 — Publish Hackathon Projects to the Open Mercato Project Gallery

**Date**: 2026-09-18
**Status**: Implemented (Phases 1-4); not yet exercised against the real gallery repo — needs `GALLERY_GITHUB_TOKEN`

## TLDR

Teams already describe their project in the portal (`/portal/project`). This spec adds an
opt-in **"Publish to the Open Mercato Project Gallery"** section to that form, linking to
<https://projects.openmercato.com/>. When a team ticks the checkbox, the form collects the
few extra fields the gallery needs (summary, "Built on Open Mercato" paragraph, screenshot
alt texts, poster choice, YouTube/Loom video) and those fields become part of the submission
checklist. After submission an organizer reviews the entry in backoffice and clicks
**Publish to gallery**: the app renders the gallery markdown file, renames the images and
opens a **pull request on `open-mercato/project-gallery`** through the GitHub API. Merging
that PR is the actual publication; the app tracks the PR and shows the live link to the team.

## Decisions (2026-09-18)

| # | Question | Decision |
|---|---|---|
| Q1 | Delivery to the gallery repo | **Automated GitHub PR**, triggered by an organizer from backoffice |
| Q2 | Does the gallery section block submission? | **Only when opted in.** Unticked = today's rules, unchanged |
| Q3 | Extra "feedback" checkbox | **None.** The existing README.md feedback upload stays as is |
| Q4 | Who merges | A gallery maintainer, on GitHub. The app never pushes to `main` |
| Q5 | `agency.role` / partner badge | v1 emits `agency.name` = team name only (no `partnerProfileUrl`, no `role`). A `community` role is a follow-up PR on the gallery repo |
| Q6 | Token ownership | `GALLERY_GITHUB_TOKEN` is a fine-grained PAT on Patryk Lewczuk's GitHub account; PRs are authored by that account |
| Q7 | Image size | Screenshots picked for the gallery must be <= 5 MB each; larger ones are **rejected** (no downscaling). Checked at submit and again at publish. Gallery-only: ordinary project uploads keep the 10 MB limit |

## Problem Statement

The gallery (`open-mercato/project-gallery`, Astro v5) is fed by hand: a partner fills
`PARTNER_TEMPLATE.md`, emails it with images, and a maintainer places the files. Hackathon
projects hold almost the same data already, but in a different shape, so after each event
nobody does the copy-paste and good projects never reach the gallery.

### The gallery contract

One file per project at `src/content/projects/<slug>.md`, validated at build time by the Zod
schema in `src/content.config.ts` (a schema violation fails the build, so it fails the PR):

| Gallery field | Rule | Hackathon source | Gap |
|---|---|---|---|
| `title` | string, required | `Project.title` | none |
| `summary` | required, **≤ 280 chars** | `tagline` is ≤ 140 and optional | **new field** |
| `youtubeId` XOR `loomId` | **exactly one** required | `videoUrl` (free-form URL) | must parse as YouTube or Loom |
| `projectUrl` | optional URL | `demoUrl` | none |
| `repoUrl` | optional URL | `repoUrl` | none |
| `agency.name` / `agency.role` | optional; `role` ∈ `partner`\|`core` | team name | derived; `role` omitted (decision Q5) |
| `team` | optional `string[]` | team member display names | derived, only with consent (see below) |
| `screenshots` | required, **2–3** × `{src, alt}` | `screenshotIds` (no alt, no limit) | **alt texts + count rule** |
| `poster` | required path | — | **poster choice** (one of the screenshots, as `hackon.md` does) |
| `date` | required ISO date | `submittedAt` | none |
| `tags` | optional `string[]` | `techStack` + track name + competition name | derived |
| `pinned`, `order` | maintainer-only | — | never emitted |
| body | markdown, ~400 words, **no `—`/`–`** | `description`, `solution`, `problemStatement` | **new "Built on Open Mercato" field** |

Assets: `public/posters/<slug>.<ext>` and `public/screenshots/<slug>/01.<ext>`, `02…`, `03…`.

## Proposed Solution

### 1. Portal — new section on `/portal/project`

Placed after "Submission Assets", editable while the project is `draft` (same rule as every
other field).

- Intro copy + external link to `https://projects.openmercato.com/` ("See the gallery").
- Checkbox **"Publish this project to the Open Mercato Project Gallery"** (`publish_to_gallery`).
- When ticked, reveal:
  - **Gallery summary** — textarea, live counter, max 280.
  - **Built on Open Mercato** — textarea: what came from the platform vs. what the team built.
  - **Screenshots for the gallery** — pick 2–3 of the uploaded screenshots, each with a
    required **alt text** input; radio to mark one as the **poster**.
  - **Video** — reuses the existing `video_url` input, with inline validation
    "must be a YouTube or Loom link" and a note that other hosts are not embeddable.
  - **Show team member names** — checkbox (default off). Names are personal data; they are
    only emitted into the public file when this is ticked.
  - **Consent** — required checkbox: "We have the rights to this content and agree to it being
    published publicly under the project's name."
- The submission checklist gains gallery rows only while the box is ticked.
- After submit the section is read-only and shows the gallery status badge
  (`Waiting for review` → `PR opened` → `Live` with link, or `Not accepted`).

### 2. Validation — single definition

`lib/submission-validation.ts` is the shared rule set for both publish paths (participant
submit and the `demos` stage auto-publish). It gains an optional `gallery` candidate; rules
apply **only when `publishToGallery` is true**:

- summary present, ≤ 280 chars
- "Built on Open Mercato" present
- `videoUrl` parses to a YouTube or Loom ID (`lib/gallery/video.ts`, pure, unit-tested:
  `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `youtube.com/embed/`,
  `loom.com/share/`, `loom.com/embed/`)
- 2–3 gallery screenshots, every one a member of `screenshotIds`, every one with alt text,
  each `png`/`jpg`/`webp`/`svg` and ≤ 5 MB
- poster is one of the selected screenshots
- consent accepted

A draft that opted in but is incomplete stays `draft` at the `demos` transition, exactly like
a draft with no README today — the organizer sees the reasons and can untick the opt-in from
backoffice to let it through.

### 3. Backoffice — review and publish

- Projects table: **Gallery** column (status badge, from the `projects.project-gallery` response
  enricher). A `gallery` filter is deferred: the status lives on the sidecar table, so it needs a
  custom list filter on the CRUD route.
- Project edit page: **Gallery** group with the gallery fields (editable by organizers, so
  copy can be polished before publishing), an inline, collapsible **preview** showing the exact
  file that will be committed, and the actions:
  - **Publish to gallery** — enabled when the project is not `draft`, opted in, valid and the
    integration is configured. Opens (or updates) the PR.
  - **Refresh status** — re-reads the PR state from GitHub.
  - **Reject** — marks `rejected` with a reason; closes the PR if one is open.
- Guarded by the new feature `projects.gallery_publish` (granted to admin roles in
  `setup.ts` → `defaultRoleFeatures`; run `yarn mercato auth sync-role-acls`).

### 4. Rendering the gallery file (`lib/gallery/render.ts`, pure)

- **Slug**: `slugify(title)`; on collision with an existing file in the gallery repo, append
  `-<team-slug>`, then `-<competition-slug>`. Stored once and never regenerated (the public
  URL `https://projects.openmercato.com/projects/<slug>` must stay stable).
- **Frontmatter**: every string is emitted with `JSON.stringify` (JSON strings are valid YAML
  scalars) — titles with `:`/`#`/quotes cannot break the build and no YAML dependency is
  needed. Optional fields are omitted, never emitted empty. `date` = `submittedAt` as
  `YYYY-MM-DD`.
- **Body**:
  ```
  <description>

  ## What it does
  <solution>            (section omitted when empty)

  ## Why it matters
  <problemStatement>    (section omitted when empty)

  ## Built on Open Mercato
  <galleryBuiltOnOm>

  ---
  Built by <team name> at <competition name>.
  ```
- **Copy hygiene** (gallery style guide): `—` and `–` → `-` in every emitted string.
- **Assets**: screenshots in selected order → `public/screenshots/<slug>/01.<ext>`…; the
  poster is copied to `public/posters/<slug>.<ext>`. Extension derives from the stored mime
  type; only `png`, `jpg`, `webp`, `svg` are accepted for the gallery (GIFs stay valid for
  judging but cannot be picked for the gallery).

### 5. Opening the PR (`lib/gallery/github.ts`)

Plain `fetch` against the GitHub REST **Git Data API** (no new dependency), one atomic commit:

1. `GET /repos/{repo}/git/ref/heads/{base}` → base SHA
2. `POST /git/blobs` for each image (base64) and the markdown
3. `POST /git/trees` (`base_tree` = base tree) → `POST /git/commits`
4. `POST /git/refs` → branch `hackathon/<competition-slug>/<slug>` (or `PATCH` with
   `force: true` when re-publishing an entry whose PR is still open)
5. `POST /pulls` — title `Add <title> (<competition name>)`, body = summary, team, track,
   backoffice link, and a maintainer checklist (copy polish, image quality, video plays).
   Label `hackathon` when it exists.

Idempotent: if `gallery_pr_number` is set and the PR is open, steps 4–5 update the branch
instead of opening a second PR. GitHub failures surface as a 502 with GitHub's message;
nothing is written to the project row unless the PR call succeeded.

Configuration (env, must also be added to the compose `environment:` allowlist in
`docker-compose.fullapp.yml` and `docker-compose.fullapp.dev.yml`, and documented in
`.env.example` — a var set only in Dokploy never reaches `process.env`):

| Var | Default | Notes |
|---|---|---|
| `GALLERY_GITHUB_TOKEN` | — | Fine-grained PAT scoped to the gallery repo only: *Contents: RW*, *Pull requests: RW*. Absent → Publish button disabled with a hint |
| `GALLERY_GITHUB_REPO` | `open-mercato/project-gallery` | |
| `GALLERY_GITHUB_BASE_BRANCH` | `main` | |
| `GALLERY_SITE_URL` | `https://projects.openmercato.com` | used for the portal link and the live URL |

### 6. After the PR — what "published" means

| Step | Who | Where |
|---|---|---|
| Review copy, images, video | gallery maintainer | GitHub PR |
| CI / `npm run build` validates frontmatter | GitHub | PR checks |
| Merge → site redeploys | gallery maintainer | GitHub / Dokploy |
| **Refresh status** → `published`, live URL stored | organizer (button) | backoffice |
| Team sees "Live" badge + link; notification `projects.project.gallery_published` | — | portal |

Status sync is an explicit button in v1. A GitHub webhook or a scheduled worker is out of scope.

## Data Models

New entity in the `projects` module — a 1:1 sidecar, so the hot `projects_project` row
(scoring, ranking, judging reads) is untouched:

`ProjectGallerySubmission` → table `projects_gallery_submission`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid, **unique**, indexed | FK by ID (no ORM relation) |
| `publish_to_gallery` | boolean, default false | the checkbox |
| `summary` | varchar(280), null | |
| `built_on_open_mercato` | text, null | |
| `screenshots` | jsonb, default `[]` | ordered `[{ attachment_id, alt }]`, 0–3 |
| `poster_attachment_id` | uuid, null | must be in `screenshots` |
| `show_team_members` | boolean, default false | |
| `consent_accepted_at` | timestamptz, null | |
| `consent_accepted_by` | uuid, null | customer user id |
| `status` | text, default `not_requested` | `not_requested` \| `requested` \| `pr_open` \| `published` \| `rejected` |
| `slug` | varchar(120), null | frozen at first publish |
| `pr_number` / `pr_url` | int / varchar(500), null | |
| `live_url` | varchar(500), null | |
| `rejected_reason` | text, null | |
| `published_at` | timestamptz, null | |
| `tenant_id`, `organization_id` | uuid, indexed | |
| `created_at`, `updated_at`, `deleted_at` | timestamptz | |

`status` moves `not_requested → requested` when an opted-in project is submitted;
unticking before submit returns it to `not_requested`. No personal data beyond what the team
explicitly types, so no encryption map is needed.

Migration: `yarn db:generate` after the entity edit, shown to the user before
`yarn db:migrate`, then `yarn generate` (AGENTS.md critical rule 1).

## API Contracts

All routes export per-method `metadata` and `openApi`.

**Portal** (`requireCustomerAuth`, team-membership check, `draft` only for writes)

- `GET /api/projects/portal/my-project` — response gains `gallery: { publish_to_gallery,
  summary, built_on_open_mercato, screenshots, poster_attachment_id, show_team_members,
  consent_accepted, status, live_url }` and `gallery_site_url`.
- `PUT /api/projects/portal/update-project` — accepts an optional `gallery` object (Zod:
  summary ≤ 280, ≤ 3 screenshots, uuid ids). Upserts the sidecar row. This is a custom write
  route: it runs `runRouteMutationGuards` (`update`) per AGENTS.md rule 5, and the project +
  sidecar are read before the first mutation and written in a single `em.flush()` (one transaction).
- `POST /api/projects/portal/submit-project` — passes the gallery candidate into
  `collectProjectSubmissionErrors`; on success sets `status = requested` when opted in.

**Admin** (`requireAuth`)

- `GET  /api/projects/admin/gallery?project_id=` — `projects.view` →
  `{ gallery, project_status, configured, repo, site_url, preview: { slug, errors, markdown_path, markdown, assets } }`
- `POST /api/projects/admin/gallery/publish` `{ project_id }` — `projects.gallery_publish` →
  `{ pr_url, pr_number, slug }`; 409 when not opted in / still draft / invalid, 503 when the
  token is not configured, 502 on GitHub errors.
- `POST /api/projects/admin/gallery/refresh` `{ project_id }` — `projects.gallery_publish` →
  `{ status, live_url }` (merged → `published`, closed unmerged → `rejected`).
- `POST /api/projects/admin/gallery/reject` `{ project_id, reason }` — `projects.gallery_publish`.
- `PUT  /api/projects/admin/gallery` `{ project_id, ...gallery fields }` — `projects.edit`,
  organizer copy polish.

All admin writes run `runRouteMutationGuards`; event emission and CRUD cache invalidation
happen after commit, outside the flush block.

**Events** (`events.ts`): `projects.project.gallery_requested`, `projects.project.gallery_pr_opened`,
`projects.project.gallery_published`, `projects.project.gallery_rejected`.

## Implementation Phases

1. **Data + rules** — entity, migration, `lib/gallery/video.ts`, `lib/gallery/render.ts`,
   validation changes, unit tests (video parsing, slug, YAML escaping, dash hygiene,
   opted-in vs. not-opted-in submission rules).
2. **Portal** — form section, autosave payload, checklist rows, read-only status view, i18n
   (`en.json`, `pl.json`).
3. **Backoffice** — table column/filter, edit-page group, preview dialog, ACL feature + role
   grant.
4. **GitHub delivery** — `lib/gallery/github.ts`, publish/refresh/reject routes, env vars in
   `.env.example` and both compose files, notification on `gallery_published`.

Phases 1–3 are useful on their own (the preview dialog gives a copy-pasteable file even
before a token exists).

## Acceptance Criteria

- [ ] The portal project form shows a gallery section with a link to `https://projects.openmercato.com/` and an opt-in checkbox
- [ ] With the box unticked, submission rules and the payload behave exactly as before
- [ ] With the box ticked, submit is blocked until summary (≤ 280), Built-on-OM text, a YouTube/Loom video, 2–3 screenshots with alt text, a poster and consent are all present; each missing item is listed
- [ ] The `demos` auto-publish applies the same rules as the participant submit
- [ ] A Vimeo / mp4 video URL is rejected for gallery entries with a clear message
- [ ] Backoffice preview renders markdown that passes the gallery's `npm run build` (verified against a local clone with a fixture project)
- [ ] A title containing `:`, `"` or `#` produces valid frontmatter; `—`/`–` never appear in the output
- [ ] Team member names appear in the file only when "Show team member names" is ticked
- [ ] **Publish to gallery** opens one PR containing exactly `src/content/projects/<slug>.md`, `public/posters/<slug>.*` and `public/screenshots/<slug>/0N.*`; clicking it again updates the same PR
- [ ] Without `GALLERY_GITHUB_TOKEN` the button is disabled with an explanatory hint and the API returns 503
- [ ] **Refresh status** turns a merged PR into `published` with the live URL; the team sees the link in the portal
- [ ] Only users with `projects.gallery_publish` can publish, refresh or reject
- [ ] All new routes export `metadata` and `openApi`; all queries are scoped by `organization_id`

## Changelog

| Date | Change |
|------|--------|
| 2026-09-18 | Initial spec |
| 2026-09-18 | Open questions resolved into decisions Q5-Q7 |
| 2026-09-18 | Phases 1-4 implemented. Deviations: inline preview instead of a dialog; table filter deferred; admin read + edit share `GET/PUT /api/projects/admin/gallery` (no separate `/preview`); rendered fixture verified against the gallery's `npm run build` |
