/**
 * Nav group every HackOn backend page is filed under
 * (`pageGroupKey: 'competitions.nav.group'` in the modules' page.meta.ts files).
 */
export const HACKON_NAV_GROUP_ID = 'competitions.nav.group'

type GroupLike = { id?: string }

/**
 * Move the HackOn group to the top, leaving every other group in its existing order.
 *
 * ## Why this cannot be done with page metadata or a stored preference
 *
 * Group order is decided by `normalizeGroupWeights()` in
 * `@open-mercato/core/modules/auth/lib/backendChrome.tsx`. It sorts against a hardcoded
 * list of built-in group ids and pushes anything it does not recognise to the end —
 * unconditionally, and regardless of `pageOrder` / `priority`:
 *
 * ```ts
 * if (aIndex === undefined) return 1
 * ```
 *
 * An app-defined group therefore cannot reach the top by declaring metadata.
 *
 * The framework's own override mechanism is a stored sidebar preference, but the
 * role-scoped variant is broken in 0.6.7. `loadSidebarPreference()` is declared
 * `Promise<SidebarPreferencesSettings>` and returns `normalizeSidebarSettings(undefined)`
 * — i.e. `{ groupOrder: [] }` — when the user has no row, so this guard in
 * `resolveBackendChromePayload()` never takes the else branch:
 *
 * ```ts
 * const appliedGroups = userPreference ? applySidebarPreference(baseForUser, userPreference) : baseForUser
 * ```
 *
 * The always-present empty user preference re-sorts every group by weight and discards the
 * role ordering. Verified by instrumenting the shipped `dist` build: the role preference
 * loads and applies correctly (`afterRole[0] === 'competitions.nav.group'`), and is then
 * undone by the empty user preference. So a role preference can only ever work for users
 * who already have a personal preference of their own — which is nobody, by default.
 *
 * Pinning in the API response is therefore the only mechanism that holds for every user,
 * on a fresh database, without per-user seeding.
 *
 * Users who HAVE customised their sidebar are left alone by the caller — see
 * `src/app/api/hackon/chrome/route.ts`.
 */
export function pinHackOnFirst<T extends GroupLike>(groups: T[]): T[] {
  if (!Array.isArray(groups)) return groups
  const index = groups.findIndex((group) => group?.id === HACKON_NAV_GROUP_ID)
  if (index <= 0) return groups
  const pinned = groups[index]
  return [pinned, ...groups.slice(0, index), ...groups.slice(index + 1)]
}
