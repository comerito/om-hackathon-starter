import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Regression guard for issue #112: the portal results page header read
 * "WYNIKI HACKATHONU 2024" for a competition named "HackOn E2E Run 2026" running in 2026.
 *
 * The year was a literal — in the page as the `t()` fallback, and in both shipped dictionaries as
 * the translated value — so it was wrong for every competition that was not a 2024 one, which by
 * now is all of them. There is no logic here to unit-test; the defect is a constant, so the guard
 * is that the constant is gone and the page reads the competition instead.
 */

const repoRoot = path.resolve(__dirname, '../../../..')
const read = (p: string) => fs.readFileSync(path.join(repoRoot, p), 'utf8')

const RESULTS_PAGE = 'src/modules/judging/frontend/[orgSlug]/portal/results/page.tsx'
const LOCALES = ['en', 'pl'] as const

/** Every portal-facing string the judging module ships, per locale. */
function messages(locale: string): Record<string, string> {
  return JSON.parse(read(`src/modules/judging/i18n/${locale}.json`)) as Record<string, string>
}

/** Source with comments removed — a year is only a defect when it can reach the screen. */
function code(relativePath: string): string {
  return read(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe('portal results header', () => {
  it('names the competition instead of a hard-coded year', () => {
    const page = read(RESULTS_PAGE)
    expect(page).toContain('useCompetitionContext()')
    expect(page).toMatch(/label=\{selected\?\.name/)
  })

  it('has no year literal left in the page', () => {
    // Catches a re-introduction as 2025/2026/... rather than only the exact string reported.
    expect(code(RESULTS_PAGE)).not.toMatch(/20[12][0-9]/)
  })

  it.each(LOCALES)('has no year in the %s results label', (locale) => {
    const label = messages(locale)['judging.portal.results.label']
    expect(typeof label).toBe('string')
    expect(label.length).toBeGreaterThan(0)
    expect(label).not.toMatch(/20[12][0-9]/)
  })

  it.each(LOCALES)('keeps a usable %s fallback for when no competition is selected', (locale) => {
    // The header must degrade to a year-free label, never to an invented year.
    expect(messages(locale)['judging.portal.results.label']).toBeTruthy()
  })

  it('ships no year literal in any judging portal string, in either locale', () => {
    for (const locale of LOCALES) {
      const offenders = Object.entries(messages(locale))
        .filter(([key, value]) => key.startsWith('judging.portal.') && /20[12][0-9]/.test(value))
        .map(([key]) => key)
      expect(offenders).toEqual([])
    }
  })
})
