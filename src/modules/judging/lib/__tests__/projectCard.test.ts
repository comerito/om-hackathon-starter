import {
  presentText, resolveProjectCardLinks, resolveReuseWarnings, resolveTechStack, safeExternalUrl,
} from '../projectCard'

describe('presentText', () => {
  it('trims and treats blank or missing values as absent', () => {
    expect(presentText('  Hello \n')).toBe('Hello')
    expect(presentText('   ')).toBeNull()
    expect(presentText('')).toBeNull()
    expect(presentText(null)).toBeNull()
    expect(presentText(undefined)).toBeNull()
  })

  it('keeps inner line breaks for whitespace-pre-line rendering', () => {
    expect(presentText('line one\nline two')).toBe('line one\nline two')
  })
})

describe('safeExternalUrl', () => {
  it('accepts http and https URLs as typed', () => {
    expect(safeExternalUrl('https://demo.example.com')).toBe('https://demo.example.com')
    expect(safeExternalUrl(' http://example.com/path?q=1 ')).toBe('http://example.com/path?q=1')
  })

  it('drops non-web schemes and unparsable values', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(safeExternalUrl('ftp://example.com/file')).toBeNull()
    expect(safeExternalUrl('github.com/team/repo')).toBeNull()
    expect(safeExternalUrl('')).toBeNull()
    expect(safeExternalUrl(null)).toBeNull()
  })
})

describe('resolveProjectCardLinks', () => {
  const none = { demo_url: null, repo_url: null, video_url: null, presentation_url: null }

  it('returns no rows when the project has no links', () => {
    expect(resolveProjectCardLinks(none)).toEqual([])
  })

  it('lists links in fixed order: demo, repo, video, presentation', () => {
    expect(resolveProjectCardLinks({
      presentation_url: 'https://slides.example.com/deck',
      video_url: 'https://video.example.com/v',
      repo_url: 'https://github.com/team/repo',
      demo_url: 'https://demo.example.com',
    })).toEqual([
      { kind: 'demo', url: 'https://demo.example.com' },
      { kind: 'repo', url: 'https://github.com/team/repo' },
      { kind: 'video', url: 'https://video.example.com/v' },
      { kind: 'presentation', url: 'https://slides.example.com/deck' },
    ])
  })

  it('hides blank and unsafe links but keeps the rest', () => {
    expect(resolveProjectCardLinks({
      ...none,
      demo_url: '   ',
      repo_url: 'javascript:alert(1)',
      video_url: 'https://video.example.com/v',
    })).toEqual([{ kind: 'video', url: 'https://video.example.com/v' }])
  })
})

describe('resolveTechStack', () => {
  it('trims, removes blanks and collapses case-insensitive duplicates keeping the first spelling', () => {
    expect(resolveTechStack([' Next.js', 'react', '', '  ', 'React', 'Postgres'])).toEqual(['Next.js', 'react', 'Postgres'])
  })

  it('returns an empty list for missing stacks', () => {
    expect(resolveTechStack([])).toEqual([])
    expect(resolveTechStack(null)).toEqual([])
    expect(resolveTechStack(undefined)).toEqual([])
  })
})

describe('resolveReuseWarnings', () => {
  it('shows nothing for a clean project', () => {
    expect(resolveReuseWarnings({
      flagged_for_reuse: false, uses_preexisting_code: false, preexisting_code_description: 'ignored',
    })).toEqual({ flaggedForReuse: false, preexistingCode: null })
  })

  it('reports the reuse flag independently of the pre-existing code declaration', () => {
    expect(resolveReuseWarnings({
      flagged_for_reuse: true, uses_preexisting_code: false, preexisting_code_description: null,
    })).toEqual({ flaggedForReuse: true, preexistingCode: null })
  })

  it('carries the pre-existing code description, or null when it is blank', () => {
    expect(resolveReuseWarnings({
      flagged_for_reuse: true, uses_preexisting_code: true, preexisting_code_description: ' Auth module from our startup ',
    })).toEqual({ flaggedForReuse: true, preexistingCode: { description: 'Auth module from our startup' } })
    expect(resolveReuseWarnings({
      flagged_for_reuse: false, uses_preexisting_code: true, preexisting_code_description: '  ',
    })).toEqual({ flaggedForReuse: false, preexistingCode: { description: null } })
  })
})
