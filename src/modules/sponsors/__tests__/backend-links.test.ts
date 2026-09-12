import fs from 'node:fs'
import path from 'node:path'

/**
 * Guard for the class of defect reported in issues #88, #89 and #129: a backoffice link
 * pointing at a `/backend/...` path that is not a registered page, so the button 404s.
 *
 * Originally scoped to the sponsors module (#88). #129 found the same defect in three more
 * modules, so the sweep now covers **every** module under `src/modules` — a new broken link
 * anywhere fails this suite, wherever it is introduced. (The file keeps its original path so
 * its history stays readable; it is not sponsors-specific any more.)
 *
 * The authoritative list of registered backend pages is the generated manifest
 * `.mercato/generated/backend-routes.generated.ts`, produced by `yarn generate`.
 * The manifest is gitignored, so on a checkout where `yarn generate` has not run
 * this suite skips itself rather than failing spuriously. The project validation
 * gate runs `yarn generate` before `yarn test`, so it is always enforced there.
 *
 * `src/app` and `src/proxy.ts` are deliberately out of scope: the `/backend/` literals there are
 * the catch-all's own path prefix and the middleware matcher (`/backend/:path*`), i.e. route
 * plumbing rather than links a user can click.
 */

const repoRoot = path.resolve(__dirname, '../../../..')
const manifestPath = path.join(repoRoot, '.mercato/generated/backend-routes.generated.ts')
const modulesRoot = path.join(repoRoot, 'src/modules')

const manifestExists = fs.existsSync(manifestPath)

function registeredBackendRoutes(): string[] {
  const src = fs.readFileSync(manifestPath, 'utf8')
  return [...src.matchAll(/resolvePageRouteMetadata\("([^"]+)"/g)]
    .map((m) => m[1])
    .filter((p) => p.startsWith('/backend'))
}

/** Turn a manifest route (`/backend/prizes/[id]/edit`) into a matcher. */
function routeMatcher(route: string): RegExp {
  const body = route
    .split('/')
    .map((segment) =>
      segment.startsWith('[')
        ? '[^/]+'
        : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('/')
  return new RegExp(`^${body}$`)
}

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue
      sourceFiles(full, acc)
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      acc.push(full)
    }
  }
  return acc
}

type Href = { file: string; line: number; raw: string; probe: string }

/**
 * Comment lines are skipped: several modules *document* the `/backend/...` mounting rule in
 * prose (including with an ellipsis, which is not a route), and a doc comment is not a link.
 */
function isCommentLine(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')
}

/**
 * Collect `/backend/...` string literals. Template-literal interpolations
 * (`${row.id}`) stand in for a dynamic segment, so they are replaced by a
 * concrete placeholder before matching against the route patterns.
 */
function collectBackendHrefs(): Href[] {
  const found: Href[] = []
  for (const file of sourceFiles(modulesRoot)) {
    fs.readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (isCommentLine(line)) return
        for (const match of line.matchAll(/['"`](\/backend\/[^'"`\s]*)['"`]/g)) {
          const raw = match[1]
          const probe = raw
            .split('?')[0]
            .split('#')[0]
            .replace(/\$\{[^}]*\}/g, 'dynamic-segment')
            .replace(/\/$/, '')
          found.push({ file: path.relative(repoRoot, file), line: index + 1, raw, probe })
        }
      })
  }
  return found
}

const describeManifest = manifestExists ? describe : describe.skip

describeManifest('module backoffice links resolve to registered backend pages', () => {
  it('finds the manifest and a meaningful number of links to check', () => {
    expect(registeredBackendRoutes().length).toBeGreaterThan(0)
    // The sweep covers every module, so this is a sanity check that the walk actually
    // descended into the tree rather than silently finding nothing.
    expect(collectBackendHrefs().length).toBeGreaterThan(100)
  })

  it('covers the links fixed in #88, #89 and #129', () => {
    const hrefs = collectBackendHrefs()
    const byModule = (segment: string) => hrefs.filter((h) => h.file.includes(`/modules/${segment}/`))
    for (const segment of ['sponsors', 'competitions', 'teams', 'bounties', 'projects']) {
      expect(byModule(segment).length).toBeGreaterThan(0)
    }
  })

  it('has no /backend href without a matching registered route', () => {
    const matchers = registeredBackendRoutes().map(routeMatcher)
    const broken = collectBackendHrefs().filter(
      (href) => !matchers.some((re) => re.test(href.probe)),
    )
    expect(
      broken.map((b) => `${b.file}:${b.line} -> ${b.raw}`),
    ).toEqual([])
  })
})
