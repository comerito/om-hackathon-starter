import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Regression guard for issue #95: the portal Chat page shipped with a nav item
 * declared by the competitions portal-nav injection widget, but PortalSidebar
 * only renders ids that are listed in NAV_ORDER / NAV_GROUPS, so the entry was
 * invisible and the page was reachable by direct URL only.
 */

const repoRoot = path.resolve(__dirname, '../../../..')
const sidebarPath = path.join(repoRoot, 'src/components/portal/PortalSidebar.tsx')
const iconsPath = path.join(repoRoot, 'src/components/portal/icons.tsx')
const chatWidgetPath = path.join(
  repoRoot,
  'src/modules/competitions/widgets/injection/portal-nav/widget.ts',
)

function readSource(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8')
}

function extractBlock(source: string, marker: string): string {
  const start = source.indexOf(marker)
  expect(start).toBeGreaterThan(-1)
  const end = source.indexOf('\n]', start)
  expect(end).toBeGreaterThan(start)
  return source.slice(start, end)
}

describe('portal sidebar navigation', () => {
  const sidebar = readSource(sidebarPath)

  it('lists the chat item in NAV_ORDER', () => {
    const navOrder = extractBlock(sidebar, 'const NAV_ORDER')
    expect(navOrder).toContain("'competitions.portal-chat'")
  })

  it('renders the chat item inside a nav group', () => {
    const navGroups = extractBlock(sidebar, 'const NAV_GROUPS')
    expect(navGroups).toContain("'competitions.portal-chat'")
  })

  it('keeps the chat item next to its widget-declared community siblings', () => {
    const navGroups = extractBlock(sidebar, 'const NAV_GROUPS')
    const hackathonGroup = navGroups
      .split('\n')
      .find((line) => line.includes("id: 'hackathon'"))
    expect(hackathonGroup).toBeDefined()
    expect(hackathonGroup).toContain("'competitions.portal-participants'")
    expect(hackathonGroup).toContain("'competitions.portal-chat'")
  })

  it('resolves the icon declared by the chat nav item', () => {
    const widget = readSource(chatWidgetPath)
    const chatLine = widget
      .split('\n')
      .find((line) => line.includes("id: 'competitions.portal-chat'"))
    expect(chatLine).toBeDefined()
    const iconName = /icon: 'lucide:([a-z-]+)'/.exec(chatLine as string)?.[1]
    expect(iconName).toBeTruthy()
    // An unmapped icon silently degrades to the generic Circle fallback.
    expect(readSource(iconsPath)).toContain(`'${iconName}':`)
  })

  it('translates the chat label in both locales via its labelKey', () => {
    const widget = readSource(chatWidgetPath)
    const chatLine = widget
      .split('\n')
      .find((line) => line.includes("id: 'competitions.portal-chat'")) as string
    const labelKey = /labelKey: '([^']+)'/.exec(chatLine)?.[1]
    expect(labelKey).toBe('competitions.portal.nav.chat')
    for (const locale of ['en', 'pl']) {
      const messages = JSON.parse(
        readSource(path.join(repoRoot, `src/modules/competitions/i18n/${locale}.json`)),
      ) as Record<string, string>
      expect(typeof messages[labelKey as string]).toBe('string')
      expect(messages[labelKey as string].length).toBeGreaterThan(0)
    }
  })
})
