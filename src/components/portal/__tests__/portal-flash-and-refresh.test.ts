import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Regression guard for issue #115 — "several portal actions need a page reload".
 *
 * Two independent defects, neither of which can be asserted through a pure function:
 *
 *  1. The portal mounted no <FlashMessages /> host at all. `flash()` just dispatches a window
 *     CustomEvent, so with no host listening every flash() on every portal page was a no-op and
 *     an action gave no feedback whatsoever. The backend AppShell mounts one; the portal layout
 *     did not.
 *  2. Mutations that did not invalidate the react-query key their own screen reads from — most
 *     visibly the join-request approval, which invalidated 'portal-team-members', a key no query
 *     in the repo has ever used.
 *
 * Both are wiring, so they are checked at the source level, in the same style as
 * `portal-sidebar-nav.test.ts`.
 */

const repoRoot = path.resolve(__dirname, '../../../..')

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

const LAYOUT = 'src/components/portal/HackathonPortalLayout.tsx'
const SIDEBAR = 'src/components/portal/PortalSidebar.tsx'
const COMPETITION_CONTEXT = 'src/modules/competitions/components/CompetitionContext.tsx'
const TEAM_PAGE = 'src/modules/teams/frontend/[orgSlug]/portal/team/page.tsx'
const PARTICIPANTS_PAGE = 'src/modules/competitions/frontend/[orgSlug]/portal/participants/page.tsx'

describe('portal flash host', () => {
  const layout = readSource(LAYOUT)

  it('mounts a FlashMessages host in the portal layout', () => {
    expect(layout).toContain("from '@open-mercato/ui/backend/FlashMessages'")
    expect(layout).toContain('<FlashMessages />')
  })

  it('mounts exactly one host, shared by every layout variant', () => {
    // A host per variant would be four hosts to keep in step; a host per page would be dozens.
    expect(layout.match(/<FlashMessages \/>/g)).toHaveLength(1)
  })

  it('is the only flash host in the app — pages must not grow their own', () => {
    const pagesWithOwnHost = collectSourceFiles(path.join(repoRoot, 'src'))
      .filter((file) => fs.readFileSync(file, 'utf8').includes('<FlashMessages'))
      .map((file) => path.relative(repoRoot, file))
    expect(pagesWithOwnHost).toEqual([LAYOUT])
  })
})

describe('portal selection stays live', () => {
  it('announces every selection write so the un-remounted chrome can re-read it', () => {
    const context = readSource(COMPETITION_CONTEXT)
    expect(context).toContain('PORTAL_SELECTION_EVENT')
    // The detail must carry the stage, not just the role — the stage is what gates the sidebar.
    expect(context).toMatch(/detail:\s*\{[^}]*stage:/)
  })

  it('re-reads the selection in the sidebar instead of a one-shot mount read', () => {
    const sidebar = readSource(SIDEBAR)
    expect(sidebar).toContain('usePortalSelection()')
    expect(sidebar).not.toContain("localStorage.getItem('hackon:selected-competition")
  })

  it('recomputes the gated nav when the role changes, not only the stage', () => {
    const sidebar = readSource(SIDEBAR)
    const deps = /\}, \[mainItems, accountItems, variant([^\]]*)\]\)/.exec(sidebar)?.[1]
    expect(deps).toBeDefined()
    expect(deps).toContain('competitionStage')
    expect(deps).toContain('competitionRole')
  })
})

describe('portal mutations refresh what they changed', () => {
  it('refetches the team roster after a join request is accepted', () => {
    const teamPage = readSource(TEAM_PAGE)
    const handler = extractFunction(teamPage, 'async function handleRespondInvitation')
    expect(handler).toContain("queryKey: ['portal-invitations']")
    expect(handler).toContain("queryKey: ['portal-my-membership']")
    // The key it used to invalidate belongs to no query at all.
    expect(teamPage).not.toContain("'portal-team-members'")
  })

  it('invalidates only query keys that some query actually declares', () => {
    const sources = collectSourceFiles(path.join(repoRoot, 'src'))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n')
    const declared = new Set(
      [...sources.matchAll(/queryKey:\s*\[\s*'([^']+)'/g)].map((m) => m[1]),
    )
    const invalidated = [
      ...sources.matchAll(/invalidateQueries\(\{\s*queryKey:\s*\[\s*'([^']+)'/g),
    ].map((m) => m[1])
    const orphans = [...new Set(invalidated)].filter((key) => !declared.has(key))
    expect(orphans).toEqual([])
  })

  it('refreshes the pending invitations after inviting from the participants page', () => {
    const participants = readSource(PARTICIPANTS_PAGE)
    const handler = extractFunction(participants, 'async function handleInvite')
    expect(handler).toContain("queryKey: ['portal-invitations']")
  })
})

/** Crude but sufficient: from the declaration to the first line that closes at column 2. */
function extractFunction(source: string, declaration: string): string {
  const start = source.indexOf(declaration)
  expect(start).toBeGreaterThan(-1)
  const end = source.indexOf('\n  }\n', start)
  expect(end).toBeGreaterThan(start)
  return source.slice(start, end)
}

function collectSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'migrations') continue
      out.push(...collectSourceFiles(full))
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}
