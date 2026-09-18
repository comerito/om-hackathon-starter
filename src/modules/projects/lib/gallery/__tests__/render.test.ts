import {
  galleryImageExtension,
  pickGallerySlug,
  renderGalleryProject,
  sanitizeGalleryCopy,
  slugifyForGallery,
  type GalleryRenderInput,
} from '../render'

const input: GalleryRenderInput = {
  slug: 'aurora',
  title: 'Aurora: the "B2B" quote builder #1',
  summary: 'Quotes in minutes — not days.',
  video: { provider: 'youtube', id: '2IrOlyhoJ2w' },
  projectUrl: 'https://aurora.example.com',
  repoUrl: '',
  teamName: 'Northern Lights',
  competitionName: 'HackOn 2026',
  teamMembers: null,
  screenshots: [
    { attachmentId: 'a1', alt: 'Quote dashboard', mimeType: 'image/png' },
    { attachmentId: 'a2', alt: 'Line item editor', mimeType: 'image/jpeg' },
  ],
  posterAttachmentId: 'a2',
  date: new Date('2026-09-20T18:30:00Z'),
  tags: ['Next.js', 'next.js', ' ', 'Showcase'],
  description: 'Aurora builds quotes.',
  solution: 'A quote inbox and a builder.',
  problemStatement: '',
  builtOnOpenMercato: 'Auth and multi-tenancy came from the platform – we built the rest.',
}

describe('slugifyForGallery', () => {
  it('produces a url-safe slug, folding diacritics', () => {
    expect(slugifyForGallery('  Zażółć Gęślą — Jaźń!  ')).toBe('zazolc-gesla-jazn')
    expect(slugifyForGallery('***')).toBe('')
  })
})

describe('pickGallerySlug', () => {
  it('keeps the plain title when it is free', () => {
    expect(pickGallerySlug('Aurora', ['Team A'], () => false)).toBe('aurora')
  })

  it('appends fallbacks, then a counter, until the slug is free', () => {
    const taken = new Set(['aurora', 'aurora-team-a'])
    expect(pickGallerySlug('Aurora', ['Team A', 'HackOn 2026'], (s) => taken.has(s))).toBe('aurora-team-a-hackon-2026')
    taken.add('aurora-team-a-hackon-2026')
    expect(pickGallerySlug('Aurora', ['Team A', 'HackOn 2026'], (s) => taken.has(s))).toBe('aurora-team-a-hackon-2026-2')
  })

  it('falls back to "project" for a title with no usable characters', () => {
    expect(pickGallerySlug('***', [], () => false)).toBe('project')
  })
})

describe('galleryImageExtension', () => {
  it('accepts only the formats the gallery serves', () => {
    expect(galleryImageExtension('image/PNG')).toBe('png')
    expect(galleryImageExtension('image/jpeg')).toBe('jpg')
    expect(galleryImageExtension('image/gif')).toBeNull()
    expect(galleryImageExtension(null)).toBeNull()
  })
})

describe('renderGalleryProject', () => {
  const result = renderGalleryProject(input)

  it('targets the gallery content and asset paths', () => {
    expect(result.markdownPath).toBe('src/content/projects/aurora.md')
    expect(result.assets).toEqual([
      { path: 'public/screenshots/aurora/01.png', attachmentId: 'a1' },
      { path: 'public/screenshots/aurora/02.jpg', attachmentId: 'a2' },
      { path: 'public/posters/aurora.jpg', attachmentId: 'a2' },
    ])
  })

  it('quotes strings so YAML-significant characters cannot break the build', () => {
    expect(result.markdown).toContain('title: "Aurora: the \\"B2B\\" quote builder #1"')
    expect(result.markdown).toContain('youtubeId: "2IrOlyhoJ2w"')
    expect(result.markdown).not.toContain('loomId')
    expect(result.markdown).toContain('date: 2026-09-20')
    expect(result.markdown).toContain('poster: "/posters/aurora.jpg"')
  })

  it('never emits long dashes', () => {
    expect(result.markdown).not.toMatch(/[—–]/)
    expect(sanitizeGalleryCopy('a — b – c')).toBe('a - b - c')
  })

  it('omits empty optional fields and sections', () => {
    expect(result.markdown).toContain('projectUrl: "https://aurora.example.com"')
    expect(result.markdown).not.toContain('repoUrl')
    expect(result.markdown).not.toContain('team:')
    expect(result.markdown).not.toContain('role:')
    expect(result.markdown).toContain('## What it does')
    expect(result.markdown).not.toContain('## Why it matters')
    expect(result.markdown).toContain('## Built on Open Mercato')
  })

  it('de-duplicates tags case-insensitively', () => {
    expect(result.markdown).toContain('tags:\n  - "Next.js"\n  - "Showcase"\n---')
  })

  it('lists team members only when they are provided', () => {
    const withTeam = renderGalleryProject({ ...input, teamMembers: ['Ada L.', '  '] })
    expect(withTeam.markdown).toContain('team:\n  - "Ada L."\nscreenshots:')
  })

  it('emits loomId for Loom videos', () => {
    const loom = renderGalleryProject({ ...input, video: { provider: 'loom', id: 'abc123def456' } })
    expect(loom.markdown).toContain('loomId: "abc123def456"')
    expect(loom.markdown).not.toContain('youtubeId')
  })

  it('refuses a poster outside the screenshots and unsupported image types', () => {
    expect(() => renderGalleryProject({ ...input, posterAttachmentId: 'zz' })).toThrow(/Poster/)
    expect(() =>
      renderGalleryProject({
        ...input,
        screenshots: [{ attachmentId: 'a1', alt: 'x', mimeType: 'image/gif' }, input.screenshots[1]],
      }),
    ).toThrow(/Unsupported/)
  })
})
