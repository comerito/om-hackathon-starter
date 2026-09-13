/**
 * Browser-local state owned by the hackathon portal.
 *
 * Everything the portal keeps in `localStorage` lives under a single `hackon:` prefix — the
 * selected competition, its stage, and the viewer's role in it. All three are *per user*, but
 * `localStorage` is per *device*, so they have to be wiped whenever the identity behind them
 * changes. Until this module existed they were not, and on a shared or kiosk machine the next
 * person to sign in inherited the previous person's competition and ROLE: the header badge and
 * the whole stage-gated sidebar were computed from a stranger's session (#111).
 *
 * The clearing is written as a prefix sweep rather than a list of three literals on purpose. The
 * defect class here is "somebody added a fourth key and nobody remembered to clear it", and a
 * sweep is immune to that by construction.
 *
 * Server-side authorisation was never affected — the API always answered for the real session.
 * This is about what the portal *shows* and which links it offers.
 */

/** Every portal-owned localStorage key starts with this. */
export const PORTAL_STORAGE_PREFIX = 'hackon:'

/**
 * The subset of `keys` a sign-in or sign-out must remove.
 *
 * Pure, and separated from the `Storage` access, so the rule itself can be asserted: prefix
 * matching is exact and case-sensitive, and nothing outside the namespace is ever touched —
 * a portal sign-out must not clear an unrelated app's or the framework's own state.
 */
export function portalStorageKeysToClear(keys: readonly string[]): string[] {
  return keys.filter((key) => key.startsWith(PORTAL_STORAGE_PREFIX))
}

type MinimalStorage = Pick<Storage, 'length' | 'key' | 'removeItem'>

/** Snapshot of the storage's keys. Taken up front because removal reindexes `key(i)`. */
function snapshotKeys(storage: MinimalStorage): string[] {
  const keys: string[] = []
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i)
    if (key !== null) keys.push(key)
  }
  return keys
}

/**
 * Drop every portal-owned key from `storage` (defaults to `window.localStorage`).
 *
 * Returns the keys it removed, which is what makes it observable in a test.
 *
 * Call this on **both** ends of a session, not just sign-out: a session can also end without any
 * client code running at all (the cookie expires, the user clears cookies, another tab signs
 * out), and in that case only the next sign-in is in a position to clean up.
 */
export function clearPortalStorage(storage?: MinimalStorage | null): string[] {
  const target = storage ?? (typeof window === 'undefined' ? null : window.localStorage)
  if (!target) return []
  try {
    const removed = portalStorageKeysToClear(snapshotKeys(target))
    for (const key of removed) target.removeItem(key)
    return removed
  } catch {
    // Private mode / blocked storage — there is nothing to leak if we cannot read it either.
    return []
  }
}
