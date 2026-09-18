import { createGalleryGithubClient, galleryBranchName, resolveGalleryGithubConfig, GalleryGithubError } from '../github'

type Call = { method: string; path: string; body: Record<string, unknown> | null; auth: string | null }

function fakeGithub(routes: Record<string, { status?: number; json?: unknown }>) {
  const calls: Call[] = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).replace('https://api.github.com/repos/acme/gallery', '')
    const method = init?.method ?? 'GET'
    const headers = (init?.headers ?? {}) as Record<string, string>
    calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : null, auth: headers.Authorization ?? null })
    const route = routes[`${method} ${path}`] ?? { status: 500, json: { message: `unexpected ${method} ${path}` } }
    const status = route.status ?? 200
    return { ok: status < 400, status, json: async () => route.json ?? {} } as Response
  }) as typeof fetch
  return { calls, client: createGalleryGithubClient({ token: 'tkn', repo: 'acme/gallery', baseBranch: 'main' }, fetchImpl) }
}

const commitRoutes = {
  'GET /git/ref/heads/main': { json: { object: { sha: 'base-sha' } } },
  'GET /git/commits/base-sha': { json: { tree: { sha: 'base-tree' } } },
  'POST /git/blobs': { status: 201, json: { sha: 'blob-sha' } },
  'POST /git/trees': { status: 201, json: { sha: 'tree-sha' } },
  'POST /git/commits': { status: 201, json: { sha: 'commit-sha' } },
}

describe('resolveGalleryGithubConfig', () => {
  it('is null without a token and applies defaults with one', () => {
    expect(resolveGalleryGithubConfig({} as NodeJS.ProcessEnv)).toBeNull()
    expect(resolveGalleryGithubConfig({ GALLERY_GITHUB_TOKEN: ' t ' } as unknown as NodeJS.ProcessEnv)).toEqual({
      token: 't',
      repo: 'open-mercato/project-gallery',
      baseBranch: 'main',
    })
  })
})

describe('galleryBranchName', () => {
  it('builds a ref-safe branch', () => {
    expect(galleryBranchName('HackOn 2026', 'aurora')).toBe('hackathon/hackon-2026/aurora')
    expect(galleryBranchName('', '..')).toBe('hackathon/x/x')
  })
})

describe('gallery GitHub client', () => {
  it('commits all files in one commit on top of the base branch and creates the branch', async () => {
    const { client, calls } = fakeGithub({ ...commitRoutes, 'POST /git/refs': { status: 201 } })
    await client.commitToBranch('hackathon/h/aurora', 'Add aurora', [
      { path: 'src/content/projects/aurora.md', content: '---\n' },
      { path: 'public/posters/aurora.png', content: Buffer.from([1, 2, 3]) },
    ])

    expect(calls.every((call) => call.auth === 'Bearer tkn')).toBe(true)
    expect(calls.filter((call) => call.path === '/git/blobs').map((call) => call.body)).toEqual([
      { content: Buffer.from('---\n').toString('base64'), encoding: 'base64' },
      { content: 'AQID', encoding: 'base64' },
    ])
    const tree = calls.find((call) => call.path === '/git/trees')!.body as { base_tree: string; tree: Array<{ path: string }> }
    expect(tree.base_tree).toBe('base-tree')
    expect(tree.tree.map((entry) => entry.path)).toEqual(['src/content/projects/aurora.md', 'public/posters/aurora.png'])
    expect(calls.find((call) => call.path === '/git/commits' && call.method === 'POST')!.body).toMatchObject({ parents: ['base-sha'], tree: 'tree-sha' })
    expect(calls.at(-1)).toMatchObject({ method: 'POST', path: '/git/refs', body: { ref: 'refs/heads/hackathon/h/aurora', sha: 'commit-sha' } })
  })

  it('force-moves the branch when it already exists (re-publish)', async () => {
    const { client, calls } = fakeGithub({
      ...commitRoutes,
      'POST /git/refs': { status: 422, json: { message: 'Reference already exists' } },
      'PATCH /git/refs/heads/hackathon/h/aurora': {},
    })
    await client.commitToBranch('hackathon/h/aurora', 'Add aurora', [{ path: 'a.md', content: 'x' }])
    expect(calls.at(-1)).toMatchObject({ method: 'PATCH', body: { sha: 'commit-sha', force: true } })
  })

  it('detects an existing project file and treats 404 as free', async () => {
    const taken = fakeGithub({ 'GET /contents/src/content/projects/aurora.md?ref=main': { json: {} } })
    const free = fakeGithub({ 'GET /contents/src/content/projects/aurora.md?ref=main': { status: 404, json: { message: 'Not Found' } } })
    expect(await taken.client.projectFileExists('aurora')).toBe(true)
    expect(await free.client.projectFileExists('aurora')).toBe(false)
  })

  it('opens a pull request against the base branch and reads its state', async () => {
    const { client, calls } = fakeGithub({
      'POST /pulls': { status: 201, json: { number: 7, html_url: 'https://github.com/acme/gallery/pull/7' } },
      'GET /pulls/7': { json: { state: 'closed', merged: true, html_url: 'https://github.com/acme/gallery/pull/7' } },
    })
    expect(await client.openPullRequest({ branch: 'b', title: 'T', body: 'B' })).toEqual({ number: 7, url: 'https://github.com/acme/gallery/pull/7' })
    expect(calls[0].body).toMatchObject({ head: 'b', base: 'main' })
    expect(await client.getPullRequest(7)).toEqual({ state: 'closed', merged: true, url: 'https://github.com/acme/gallery/pull/7' })
  })

  it('surfaces GitHub failures with status and message', async () => {
    const { client } = fakeGithub({ 'POST /pulls': { status: 403, json: { message: 'Resource not accessible by personal access token' } } })
    await expect(client.openPullRequest({ branch: 'b', title: 'T', body: 'B' })).rejects.toMatchObject({
      name: 'GalleryGithubError',
      status: 403,
      message: expect.stringContaining('Resource not accessible'),
    })
    expect(GalleryGithubError).toBeDefined()
  })
})
