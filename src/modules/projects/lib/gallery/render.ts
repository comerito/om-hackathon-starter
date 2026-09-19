/**
 * Renders a hackathon project into the file format of the Open Mercato Project
 * Gallery (`open-mercato/project-gallery`, `src/content/projects/<slug>.md`).
 *
 * The gallery validates frontmatter with Zod at build time, so a malformed file
 * fails the pull request. Everything here is pure: callers resolve teams,
 * attachments and slugs up front.
 */

import type { GalleryVideo } from './video'

export const GALLERY_SUMMARY_MAX_LENGTH = 280
export const GALLERY_MIN_SCREENSHOTS = 2
export const GALLERY_MAX_SCREENSHOTS = 3
export const GALLERY_MAX_IMAGE_BYTES = 5 * 1024 * 1024

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

/** File extension the gallery accepts for this mime type, or `null` (e.g. GIF). */
export function galleryImageExtension(mimeType: string | null | undefined): string | null {
  return EXTENSION_BY_MIME[(mimeType ?? '').trim().toLowerCase()] ?? null
}

/** The gallery style guide bans long dashes. */
export function sanitizeGalleryCopy(value: string): string {
  return value.replace(/[\u2014\u2013]/g, '-').replace(/\r\n/g, '\n').trim()
}

export function slugifyForGallery(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

/**
 * First free slug: the title, then the title suffixed with each fallback in turn,
 * then a numeric suffix. `isTaken` reflects files already in the gallery repo.
 */
export function pickGallerySlug(
  title: string,
  fallbacks: readonly string[],
  isTaken: (slug: string) => boolean,
): string {
  const base = slugifyForGallery(title) || 'project'
  if (!isTaken(base)) return base

  let candidate = base
  for (const fallback of fallbacks) {
    const suffix = slugifyForGallery(fallback)
    if (!suffix) continue
    candidate = `${candidate}-${suffix}`
    if (!isTaken(candidate)) return candidate
  }

  for (let n = 2; ; n += 1) {
    if (!isTaken(`${candidate}-${n}`)) return `${candidate}-${n}`
  }
}

export type GalleryScreenshotInput = {
  attachmentId: string
  alt: string
  mimeType: string
}

export type GalleryRenderInput = {
  slug: string
  title: string
  summary: string
  video: GalleryVideo
  projectUrl?: string | null
  repoUrl?: string | null
  teamName: string
  competitionName: string
  /** Emitted only when the team consented to showing member names. */
  teamMembers?: readonly string[] | null
  screenshots: readonly GalleryScreenshotInput[]
  posterAttachmentId: string
  date: Date
  tags: readonly string[]
  description: string
  solution?: string | null
  problemStatement?: string | null
  builtOnOpenMercato: string
}

export type GalleryAsset = {
  /** Path inside the gallery repository. */
  path: string
  attachmentId: string
}

export type GalleryRenderResult = {
  markdownPath: string
  markdown: string
  assets: GalleryAsset[]
}

// A JSON string is a valid YAML double-quoted scalar, so titles containing
// `:`, `#` or quotes cannot break the gallery build.
function yamlString(value: string): string {
  return JSON.stringify(sanitizeGalleryCopy(value))
}

function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function uniqueTags(tags: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const tag of tags) {
    const clean = sanitizeGalleryCopy(tag)
    const key = clean.toLowerCase()
    if (!clean || seen.has(key)) continue
    seen.add(key)
    result.push(clean)
  }
  return result
}

export function renderGalleryProject(input: GalleryRenderInput): GalleryRenderResult {
  const assets: GalleryAsset[] = []
  const screenshotLines: string[] = []

  input.screenshots.forEach((screenshot, index) => {
    const extension = galleryImageExtension(screenshot.mimeType)
    if (!extension) throw new Error(`Unsupported gallery image type: ${screenshot.mimeType}`)
    const path = `/screenshots/${input.slug}/${String(index + 1).padStart(2, '0')}.${extension}`
    assets.push({ path: `public${path}`, attachmentId: screenshot.attachmentId })
    screenshotLines.push(`  - src: ${yamlString(path)}`, `    alt: ${yamlString(screenshot.alt)}`)
  })

  const poster = input.screenshots.find((s) => s.attachmentId === input.posterAttachmentId)
  if (!poster) throw new Error('Poster must be one of the gallery screenshots')
  const posterPath = `/posters/${input.slug}.${galleryImageExtension(poster.mimeType)}`
  assets.push({ path: `public${posterPath}`, attachmentId: poster.attachmentId })

  const frontmatter: string[] = [
    '---',
    `title: ${yamlString(input.title)}`,
    `summary: ${yamlString(input.summary)}`,
    `${input.video.provider === 'youtube' ? 'youtubeId' : 'loomId'}: ${yamlString(input.video.id)}`,
  ]
  if (isHttpUrl(input.projectUrl)) frontmatter.push(`projectUrl: ${yamlString(input.projectUrl)}`)
  if (isHttpUrl(input.repoUrl)) frontmatter.push(`repoUrl: ${yamlString(input.repoUrl)}`)
  frontmatter.push('agency:', `  name: ${yamlString(input.teamName)}`)

  const members = (input.teamMembers ?? []).map((m) => m.trim()).filter(Boolean)
  if (members.length > 0) {
    frontmatter.push('team:', ...members.map((member) => `  - ${yamlString(member)}`))
  }

  frontmatter.push('screenshots:', ...screenshotLines)
  frontmatter.push(`poster: ${yamlString(posterPath)}`)
  frontmatter.push(`date: ${input.date.toISOString().slice(0, 10)}`)

  const tags = uniqueTags(input.tags)
  if (tags.length > 0) frontmatter.push('tags:', ...tags.map((tag) => `  - ${yamlString(tag)}`))
  frontmatter.push('---')

  const body: string[] = [sanitizeGalleryCopy(input.description)]
  const solution = sanitizeGalleryCopy(input.solution ?? '')
  if (solution) body.push('## What it does', solution)
  const problem = sanitizeGalleryCopy(input.problemStatement ?? '')
  if (problem) body.push('## Why it matters', problem)
  body.push('## Built on Open Mercato', sanitizeGalleryCopy(input.builtOnOpenMercato))
  body.push(
    '---',
    `Built by ${sanitizeGalleryCopy(input.teamName)} at ${sanitizeGalleryCopy(input.competitionName)}.`,
  )

  return {
    markdownPath: `src/content/projects/${input.slug}.md`,
    markdown: `${frontmatter.join('\n')}\n\n${body.join('\n\n')}\n`,
    assets,
  }
}
