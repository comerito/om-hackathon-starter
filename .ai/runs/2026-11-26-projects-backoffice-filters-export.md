# Execution plan — backoffice projects table: inline filters + XLSX export

**Engine:** om-auto-create-pr (steps: 5, --loop: no)
**Branch:** `feat/projects-backoffice-filters-export`
**Base:** `main`

## Goal

On `/backend/projects` organizers need to:

1. Filter the table by every column it shows — with the emphasis on **track** and **status** —
   using filters rendered **inline above the table**, not in the filter drawer.
2. Select projects (row checkboxes + "select all") and export the selection to an **Excel
   (.xlsx)** file carrying everything we hold about each project.

## Scope

- List API `GET /api/projects/projects` gains filters: `status` (comma list), `gallery_status`,
  `team_name` (ilike via teams), `submitted_from` / `submitted_to`, `has_submission`.
- New `POST /api/projects/admin/export` → `.xlsx` for an explicit list of project ids
  (tenant + organization scoped, `projects.view`). One row per project with all project fields,
  competition, track, team, team member names, attachment file names, gallery state.
- Dependency-free XLSX writer (`lib/xlsx.ts`) on top of `archiver`, already a dependency.
- `ProjectsTable`: inline filter row (competition when unscoped, track, status, team, gallery,
  flag, submitted date range, clear), row selection via DataTable `bulkActions`
  ("Export selected to Excel"), plus "Export filtered to Excel" for whole-result exports.
- i18n keys (en + pl).

## Non-goals

- No entity / migration changes; no new ACL feature (export reuses `projects.view`).
- Team member e-mails are not exported (names only).

## Progress

- [x] 1. Plan
- [x] 2. List API filters
- [x] 3. XLSX writer + export route + unit tests
- [x] 4. ProjectsTable inline filters, selection, export actions, i18n
- [x] 5. Validation gate (`yarn generate`, `typecheck`, `lint`, `test`, `build`) + PR

## Gate results

- `yarn generate` ✅ · `yarn typecheck` ✅ · `yarn test` ✅ (83 suites / 1020 tests)
- `yarn build` ✅ with `NODE_OPTIONS=--max-old-space-size=8192` (default heap OOMs in this environment)
- `yarn lint` ❌ pre-existing and unrelated: `next lint` was removed in Next 16 and the repo has no ESLint config
- Browser QA not run: no Postgres reachable in this environment. The generated .xlsx was read back with ExcelJS 4.4.0
  (header bold + frozen, autofilter, date format, Polish characters intact).
