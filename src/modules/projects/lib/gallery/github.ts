/**
 * Delivers a rendered project to the gallery repository as a pull request, using
 * the GitHub REST Git Data API over plain `fetch` (one atomic commit).
 */

export type GalleryGithubConfig = {
  token: string
  repo: string
  baseBranch: string
}

export class GalleryGithubError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'GalleryGithubError'
  }
}

export function resolveGalleryGithubConfig(env: NodeJS.ProcessEnv = process.env): GalleryGithubConfig | null {
  const token = env.GALLERY_GITHUB_TOKEN?.trim()
  if (!token) return null
  return {
    token,
    repo: env.GALLERY_GITHUB_REPO?.trim() || 'open-mercato/project-gallery',
    baseBranch: env.GALLERY_GITHUB_BASE_BRANCH?.trim() || 'main',
  }
}

export type GalleryCommitFile = { path: string; content: Buffer | string }

type FetchLike = typeof fetch

export function createGalleryGithubClient(config: GalleryGithubConfig, fetchImpl: FetchLike = fetch) {
  async function request<T>(method: string, path: string, body?: unknown, allow: number[] = []): Promise<{ status: number; data: T }> {
    const response = await fetchImpl(`https://api.github.com/repos/${config.repo}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${config.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'om-hackathon-gallery-publisher',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = (await response.json().catch(() => ({}))) as T & { message?: string }
    if (!response.ok && !allow.includes(response.status)) {
      throw new GalleryGithubError(`GitHub ${method} ${path} failed (${response.status}): ${data?.message ?? 'unknown error'}`, response.status)
    }
    return { status: response.status, data }
  }

  return {
    /** True when the gallery already has a project file under this slug on the base branch. */
    async projectFileExists(slug: string): Promise<boolean> {
      const { status } = await request(
        'GET',
        `/contents/src/content/projects/${encodeURIComponent(slug)}.md?ref=${encodeURIComponent(config.baseBranch)}`,
        undefined,
        [404],
      )
      return status !== 404
    },

    /** Commit `files` on top of the base branch and point `branch` at it (created or force-moved). */
    async commitToBranch(branch: string, message: string, files: readonly GalleryCommitFile[]): Promise<void> {
      const base = await request<{ object: { sha: string } }>('GET', `/git/ref/heads/${encodeURIComponent(config.baseBranch)}`)
      const baseSha = base.data.object.sha
      const baseCommit = await request<{ tree: { sha: string } }>('GET', `/git/commits/${baseSha}`)

      const tree: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string }> = []
      for (const file of files) {
        const buffer = typeof file.content === 'string' ? Buffer.from(file.content, 'utf8') : file.content
        const blob = await request<{ sha: string }>('POST', '/git/blobs', { content: buffer.toString('base64'), encoding: 'base64' })
        tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.data.sha })
      }

      const newTree = await request<{ sha: string }>('POST', '/git/trees', { base_tree: baseCommit.data.tree.sha, tree })
      const commit = await request<{ sha: string }>('POST', '/git/commits', { message, tree: newTree.data.sha, parents: [baseSha] })

      const created = await request('POST', '/git/refs', { ref: `refs/heads/${branch}`, sha: commit.data.sha }, [422])
      if (created.status === 422) {
        await request('PATCH', `/git/refs/heads/${branch}`, { sha: commit.data.sha, force: true })
      }
    },

    async openPullRequest(input: { branch: string; title: string; body: string }): Promise<{ number: number; url: string }> {
      const pr = await request<{ number: number; html_url: string }>('POST', '/pulls', {
        title: input.title,
        head: input.branch,
        base: config.baseBranch,
        body: input.body,
        maintainer_can_modify: true,
      })
      return { number: pr.data.number, url: pr.data.html_url }
    },

    async updatePullRequest(number: number, input: { title: string; body: string }): Promise<void> {
      await request('PATCH', `/pulls/${number}`, input)
    },

    async getPullRequest(number: number): Promise<{ state: 'open' | 'closed'; merged: boolean; url: string }> {
      const pr = await request<{ state: 'open' | 'closed'; merged: boolean; html_url: string }>('GET', `/pulls/${number}`)
      return { state: pr.data.state, merged: Boolean(pr.data.merged), url: pr.data.html_url }
    },

    async closePullRequest(number: number): Promise<void> {
      await request('PATCH', `/pulls/${number}`, { state: 'closed' })
    },
  }
}

export type GalleryGithubClient = ReturnType<typeof createGalleryGithubClient>

export function galleryBranchName(competitionSlug: string, slug: string): string {
  const safe = (value: string) => value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'x'
  return `hackathon/${safe(competitionSlug)}/${safe(slug)}`
}
