import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Regression guard: portal info cards rendered their value one character per line.
 *
 * `CompetitionInfoCards` sized its grid with viewport breakpoints
 * (`grid gap-3 sm:grid-cols-2 xl:grid-cols-4`). Breakpoints respond to the VIEWPORT, not to the
 * element's container, so on any desktop screen the agenda page's 300px sidebar
 * (`lg:grid-cols-[1fr_300px]`) was still split into four ~57px columns. A card that narrow leaves
 * ~33px of content for `icon (40px, shrink-0) + gap (12px) + text block`, and the text block was
 * `min-w-0` with no `flex-1`, so it resolved to `width: 0`. Its children then overflowed: the
 * label broke one word per line, and the value — which carries `break-words` — broke after every
 * character.
 *
 * The agenda call site did try to opt out with `gridClassName="grid-cols-1"`, but that could never
 * work: `cn()` is tailwind-merge, which keys classes by VARIANT + utility group. Unprefixed
 * `grid-cols-1` and `xl:grid-cols-4` are different groups, so both survived and the `xl` rule
 * still won inside its media query. That is the generalizable lesson guarded below: a default that
 * callers are invited to override through `cn()` must not be variant-prefixed.
 *
 * Measured in headless Chrome at a 1440px viewport against the project's own compiled Tailwind,
 * rendering the real agenda-sidebar ancestor chain: the text block was 0px wide and the value
 * wrapped to 32 lines before, 172px and 2 lines after.
 *
 * This is CSS, so there is no logic to unit-test; the guard is that the defective class shapes
 * cannot come back.
 */

const repoRoot = path.resolve(__dirname, '../../../../..')
const read = (p: string) => fs.readFileSync(path.join(repoRoot, p), 'utf8')

const COMPONENT = 'src/modules/competitions/components/CompetitionInfoCards.tsx'

/** Source with comments removed — a class only matters when it can reach the DOM. */
function code(relativePath: string): string {
  return read(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

/** The `className` string literal of the grid that lays the cards out. */
function gridClasses(source: string): string {
  const match = source.match(/cn\(\s*'(grid [^']*)'\s*,\s*gridClassName\s*\)/)
  if (!match) throw new Error('could not find the info-cards grid className in ' + COMPONENT)
  return match[1]
}

describe('CompetitionInfoCards layout', () => {
  const source = code(COMPONENT)

  it('sizes its grid from the container, not the viewport', () => {
    const grid = gridClasses(source)
    expect(grid).toContain('auto-fit')
    expect(grid).toContain('minmax(')
  })

  it('uses no viewport breakpoint in the grid defaults callers may override', () => {
    // The whole defect: `xl:grid-cols-4` outlived a `gridClassName="grid-cols-1"` override,
    // because tailwind-merge does not merge across variants.
    expect(gridClasses(source)).not.toMatch(/\b(sm|md|lg|xl|2xl):grid-cols-/)
  })

  it('caps the column floor with min() so a narrow container cannot overflow', () => {
    // `minmax(16rem, 1fr)` would overflow any container narrower than 16rem.
    expect(gridClasses(source)).toMatch(/minmax\(min\(100%,\s*\d+(\.\d+)?rem\)/)
  })

  it('lets the card text block claim the row width beside the fixed-width icon', () => {
    // `min-w-0` alone permits the shrink to zero that produced the one-character-per-line wrap;
    // `flex-1` is what makes the block take the space the icon leaves.
    expect(source).toMatch(/className="min-w-0 flex-1"/)
  })

  it('keeps the icon from being shrunk instead of the text', () => {
    expect(source).toMatch(/size-10 shrink-0/)
  })

  it('wraps long single-word labels and values instead of overflowing the card', () => {
    const paragraphs = source.match(/<p className="[^"]*"/g) ?? []
    const cardText = paragraphs.filter((p) => /tracking-widest|whitespace-pre-line/.test(p))
    expect(cardText).toHaveLength(2)
    for (const p of cardText) expect(p).toContain('break-words')
  })
})
