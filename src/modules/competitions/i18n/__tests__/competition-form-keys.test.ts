import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * #138: every label on the Create/Edit Competition form already went through `t(key, fallback)`,
 * but `pl.json` held only 3 of the keys, so the rest silently fell back to their English literal
 * and the form rendered in two languages at once. Nothing failed — that is exactly why it shipped.
 *
 * This test re-derives the keys from the page sources rather than hard-coding a list, so adding a
 * field to either form without translating it fails here instead of in production.
 */

const MODULE_ROOT = path.resolve(__dirname, '../..')
const FORM_PAGES = [
  'backend/competitions/create/page.tsx',
  'backend/competitions/[id]/edit/page.tsx',
]

/** Matches `t('some.key', 'Fallback copy')`, the only call shape these two pages use. */
const T_CALL = /\bt\(\s*'([^']+)'\s*,\s*'((?:[^'\\]|\\.)*)'/g

function collectFormKeys(): Map<string, string> {
  const keys = new Map<string, string>()
  for (const page of FORM_PAGES) {
    const source = fs.readFileSync(path.join(MODULE_ROOT, page), 'utf8')
    for (const match of source.matchAll(T_CALL)) {
      if (!keys.has(match[1])) keys.set(match[1], match[2].replace(/\\'/g, "'"))
    }
  }
  return keys
}

function loadDictionary(locale: string): Record<string, string> {
  return JSON.parse(fs.readFileSync(path.join(MODULE_ROOT, 'i18n', `${locale}.json`), 'utf8'))
}

describe('Create/Edit Competition form translations', () => {
  const formKeys = collectFormKeys()

  it('finds the form keys it is meant to be guarding', () => {
    // Guards the regex itself: if the pages change call shape, this test must fail loudly
    // rather than quietly asserting nothing.
    expect(formKeys.size).toBeGreaterThanOrEqual(35)
    expect(formKeys.get('competitions.fields.name')).toBe('Name')
  })

  it.each(['en', 'pl'])('%s.json defines every key the form renders', (locale) => {
    const dict = loadDictionary(locale)
    const missing = [...formKeys.keys()].filter((key) => !(key in dict))

    expect(missing).toEqual([])
  })

  it('never leaves a Polish label showing its English fallback', () => {
    const pl = loadDictionary('pl')
    const untranslated = [...formKeys.entries()]
      .filter(([key, fallback]) => pl[key] === fallback)
      .map(([key]) => key)

    expect(untranslated).toEqual([])
  })

  it('has no empty Polish values', () => {
    const pl = loadDictionary('pl')
    const blank = [...formKeys.keys()].filter((key) => typeof pl[key] === 'string' && pl[key].trim() === '')

    expect(blank).toEqual([])
  })
})
