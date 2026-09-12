import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  PORTAL_STORAGE_PREFIX,
  clearPortalStorage,
  portalStorageKeysToClear,
} from '../portal-storage'

/**
 * Regression guard for issue #111: portal sign-out left the `hackon:*` keys behind, so the next
 * person to sign in on the same device inherited the previous person's competition and ROLE —
 * the header badge read "Mona Mentor / PARTICIPANT" and the sidebar offered participant-only
 * pages that then 403'd.
 */

/** Minimal in-memory `Storage`, including the index reshuffling `removeItem` causes. */
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    get length() { return map.size },
    key(i: number) { return [...map.keys()][i] ?? null },
    removeItem(key: string) { map.delete(key) },
    getItem(key: string) { return map.get(key) ?? null },
    snapshot() { return Object.fromEntries(map) },
  }
}

const PORTAL_KEYS = {
  'hackon:selected-competition': 'comp-1',
  'hackon:selected-competition-stage': 'team_formation',
  'hackon:selected-competition-role': 'participant',
}

describe('portalStorageKeysToClear', () => {
  it('selects the three keys the issue names', () => {
    expect(portalStorageKeysToClear(Object.keys(PORTAL_KEYS))).toEqual([
      'hackon:selected-competition',
      'hackon:selected-competition-stage',
      'hackon:selected-competition-role',
    ])
  })

  it('selects any future key in the namespace without being told about it', () => {
    // This is the point of a prefix sweep: the bug class is "a fourth key was added and nobody
    // updated the sign-out handler".
    expect(portalStorageKeysToClear(['hackon:something-invented-next-year'])).toEqual([
      'hackon:something-invented-next-year',
    ])
  })

  it('leaves everything outside the namespace alone', () => {
    const foreign = [
      'theme',
      'locale',
      'next-auth.session-token',
      'mercato:organization',
      'my-hackon:selected-competition', // prefix must anchor at the start
      'HACKON:selected-competition', // and be case-sensitive
      'hackon',
      'hackon-selected-competition', // the colon is part of the prefix
    ]
    expect(portalStorageKeysToClear(foreign)).toEqual([])
  })

  it('picks the portal keys out of a mixed storage', () => {
    const keys = ['theme', ...Object.keys(PORTAL_KEYS), 'locale']
    expect(portalStorageKeysToClear(keys)).toEqual(Object.keys(PORTAL_KEYS))
  })

  it('handles an empty storage', () => {
    expect(portalStorageKeysToClear([])).toEqual([])
  })
})

describe('clearPortalStorage', () => {
  it('removes every portal key and reports what it removed', () => {
    const storage = fakeStorage({ ...PORTAL_KEYS, theme: 'dark' })
    expect(clearPortalStorage(storage).sort()).toEqual(Object.keys(PORTAL_KEYS).sort())
    expect(storage.snapshot()).toEqual({ theme: 'dark' })
  })

  it('removes all of them even though removal reindexes the storage', () => {
    // Iterating `key(i)` while removing would skip every second key.
    const storage = fakeStorage({ ...PORTAL_KEYS, 'hackon:extra': 'x' })
    clearPortalStorage(storage)
    expect(storage.length).toBe(0)
  })

  it('is a no-op on a storage with nothing of ours in it', () => {
    const storage = fakeStorage({ theme: 'dark', locale: 'pl' })
    expect(clearPortalStorage(storage)).toEqual([])
    expect(storage.snapshot()).toEqual({ theme: 'dark', locale: 'pl' })
  })

  it('survives a storage that throws — private mode must not break sign-out', () => {
    const hostile = {
      get length(): number { throw new Error('SecurityError') },
      key() { return null },
      removeItem() {},
    }
    expect(clearPortalStorage(hostile)).toEqual([])
  })

  it('returns [] rather than throwing when there is no storage at all', () => {
    expect(clearPortalStorage(null)).toEqual([])
  })
})

describe('every portal session boundary clears the storage', () => {
  const repoRoot = path.resolve(__dirname, '../../..')
  const read = (p: string) => fs.readFileSync(path.join(repoRoot, p), 'utf8')

  // The three places a portal session can start or end from client code.
  const BOUNDARIES = [
    ['sign out', 'src/components/portal/PortalTopBar.tsx'],
    ['sign in', 'src/modules/competitions/frontend/[orgSlug]/portal/login/page.tsx'],
    ['accept invite', 'src/modules/competitions/frontend/[orgSlug]/portal/accept-invite/page.tsx'],
  ] as const

  it.each(BOUNDARIES)('%s clears it', (_label, file) => {
    expect(read(file)).toContain('clearPortalStorage(')
  })

  it('is the only place that touches the namespace, so there is one rule to keep', () => {
    expect(read('src/lib/portal-storage.ts')).toContain(`'${PORTAL_STORAGE_PREFIX}'`)
  })

  it('clears before navigating away, not after', () => {
    // `auth.logout()` and the login redirect both do a full-document `window.location.assign`,
    // which tears this script down — anything queued after it never runs.
    const login = read('src/modules/competitions/frontend/[orgSlug]/portal/login/page.tsx')
    expect(login.indexOf('clearPortalStorage(')).toBeLessThan(
      login.indexOf('window.location.assign(`/${orgSlug}/portal/dashboard`)'),
    )
    const topBar = read('src/components/portal/PortalTopBar.tsx')
    expect(topBar.indexOf('clearPortalStorage()')).toBeLessThan(topBar.indexOf('auth.logout()'))
  })
})
