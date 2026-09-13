/**
 * Resource kinds this module reports to the mutation-guard registry.
 *
 * ## Why the dot form is not a style choice
 *
 * `matchesEntity` (`@open-mercato/shared/lib/crud/mutation-guard-registry`) understands exactly
 * three patterns: `'*'`, an exact string, and `'prefix.*'` tested with
 * `entity.startsWith(prefix + '.')`. It has no notion of `:`. And `makeCrudRoute` derives its own
 * resource kind through `canonicalizeResourceTag`, which turns `<events.module>.<events.entity>`
 * into a dotted, lowercased tag — `judging.panel`, `judging.criterion`.
 *
 * So a resource kind containing a colon is unreachable by any wildcard guard: an operator who
 * registers `targetEntity: 'judging.*'` to freeze scoring after the judging deadline would see it
 * fire on every `makeCrudRoute` judging write and **silently not fire** on the portal scoring
 * route. `canonicalizeResourceTag` does not rescue it either — it rewrites `::`, `_`, `-`, `/` and
 * whitespace into `.`, but leaves a single `:` alone, so `'judging:project_score'` canonicalises
 * to `'judging:project.score'` and still fails `judging.*`.
 *
 * These constants are kept in a plain module (no `next/server`, no DI, no entities) so the
 * matching contract above can be unit-tested against the framework's real predicates.
 */

/**
 * The `judging_project_score` write performed by `api/portal/score-project`.
 *
 * `judging.score` is `<module>.<entity>` using the noun this module's own event vocabulary already
 * uses for the record (`judging.score.submitted` / `.updated` / `.deleted` in `judging/events.ts`),
 * which is the same shape `makeCrudRoute` would produce for it and the same convention the sibling
 * portal write route uses (`sponsors.vote`). It is already canonical: `canonicalizeResourceTag`
 * returns it unchanged.
 */
export const SCORE_RESOURCE_KIND = 'judging.score'
