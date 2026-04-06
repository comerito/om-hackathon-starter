# Kapsik89 Bug Backlog

Repository: `comerito/om-hackathon-starter`  
Reporter: `Kapsik89`  
Fetched: 2026-04-06  
Scope: All open issues authored by `Kapsik89` at time of fetch

## Priority Scale

- `Critical`: Data loss, broken admin visibility, corrupted state, or core workflow unusable.
- `High`: Major user flow broken or incorrect persisted business state.
- `Medium`: Important UX or permissions mismatch with a working backend fallback.
- `Low`: Cosmetic, localization, or narrow-scope UI issue.

## Work Queue

| Order | Priority | Issue | Title | Why This Priority | Status |
|---|---|---:|---|---|---|
| 1 | Critical | [#43](https://github.com/comerito/om-hackathon-starter/issues/43) | Submitted projects not visible in OpenMercato Backoffice | Admins cannot see or manage submitted projects in backoffice. | Validated |
| 2 | Critical | [#37](https://github.com/comerito/om-hackathon-starter/issues/37) | Orphaned team created in database despite HTTP 500 response | Failed request still writes invalid team data; integrity problem. | Pending |
| 3 | High | [#36](https://github.com/comerito/om-hackathon-starter/issues/36) | HTTP 500 on team creation after being removed from a team | Users affected by prior membership removal cannot create teams. | Pending |
| 4 | High | [#41](https://github.com/comerito/om-hackathon-starter/issues/41) | Submit Score accepts empty form and saves blank scores | Judging data can be submitted empty, corrupting evaluation quality. | Pending |
| 5 | High | [#42](https://github.com/comerito/om-hackathon-starter/issues/42) | Project shows "Draft" status after recusal instead of "Recused" | Recusal state is misrepresented and can confuse judging operations. | Pending |
| 6 | Medium | [#39](https://github.com/comerito/om-hackathon-starter/issues/39) | Track team counter does not update after teams join or leave | Displayed counts are wrong, which misleads users about track occupancy. | Pending |
| 7 | Medium | [#40](https://github.com/comerito/om-hackathon-starter/issues/40) | Team cards are not clickable and full description is inaccessible | Team discovery is impaired because truncated content has no detail view. | Pending |
| 8 | Medium | [#38](https://github.com/comerito/om-hackathon-starter/issues/38) | Non-owner sees actionable track buttons on Tracks page | UI exposes forbidden actions even though backend rejects them. | Pending |
| 9 | Medium | [#33](https://github.com/comerito/om-hackathon-starter/issues/33) | Incorrect label in "Request to Join" flow | Request text is semantically reversed and misleading. | Pending |
| 10 | Low | [#34](https://github.com/comerito/om-hackathon-starter/issues/34) | Missing Polish translations on Announcements page | Localization gap with limited functional impact. | Pending |
| 11 | Low | [#35](https://github.com/comerito/om-hackathon-starter/issues/35) | Typo in sidebar menu (PL): "Narzedia" should be "Narzędzia" | Cosmetic translation typo. | Pending |
| 12 | Low | [#32](https://github.com/comerito/om-hackathon-starter/issues/32) | Limit of chars in skills | Narrow UI breakage; already labeled low in GitHub. | Pending |

## Suggested Fix Order

1. Resolve admin visibility and data integrity issues first: `#43`, `#37`.
2. Fix broken team creation and judging submission flows: `#36`, `#41`, `#42`.
3. Fix misleading but non-blocking UX and permission issues: `#39`, `#40`, `#38`, `#33`.
4. Finish with localization and cosmetic cleanup: `#34`, `#35`, `#32`.

## Notes

- This file is a working backlog for implementation order, not a replacement for GitHub issue labels.
- Priority classification was inferred from issue descriptions, user impact, and data risk.
- Re-check GitHub before each fix in case issue state, labels, or reproduction details change.

## Progress Log

- 2026-04-06: Started investigation on `#43`. Existing spec coverage found in `SPEC-001-2026-03-17-hackon-platform.md` and `SPEC-002-2026-03-23-portal-redesign.md`.
- 2026-04-06: Patched `#43` admin project data flow. Expanded `projects` CRUD GET payload to include full project submission fields and aligned admin updates with project status/flag fields.
- 2026-04-06: Ran `yarn generate` to restore missing `.mercato/generated/*` files, then `yarn typecheck` passed.
