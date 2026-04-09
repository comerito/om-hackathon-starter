import { Octokit } from 'octokit'

export interface GitHubPR {
  id: number
  number: number
  html_url: string
  title: string
  body: string | null
  user: { login: string }
  labels: Array<{ name: string }>
  created_at: string
}

export interface PRFileChange {
  filename: string
  status: string // 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged'
  additions: number
  deletions: number
  changes: number
  patch?: string // per-file diff (may be omitted for binary/very large files)
}

const LOG_PREFIX = '[bounties:github]'

/** Files to skip when building diff (generated, lock files, etc.) */
const SKIP_PATTERNS = [
  /^\.mercato\/generated\//,
  /\/\.mercato\/generated\//,
  /yarn\.lock$/,
  /package-lock\.json$/,
  /pnpm-lock\.yaml$/,
  /\.snap$/,
  /\.generated\./,
]

function shouldSkipFile(filename: string): boolean {
  return SKIP_PATTERNS.some(p => p.test(filename))
}

export class GitHubService {
  private octokit: Octokit
  private repoOwner: string
  private repoName: string

  constructor() {
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN ?? '' })
    this.repoOwner = process.env.GITHUB_REPO_OWNER ?? 'open-mercato'
    this.repoName = process.env.GITHUB_REPO_NAME ?? 'open-mercato'
    console.log(`[GitHubService] Resolved repo: ${this.repoOwner}/${this.repoName} (env: GITHUB_REPO_OWNER=${process.env.GITHUB_REPO_OWNER}, GITHUB_REPO_NAME=${process.env.GITHUB_REPO_NAME})`)
  }

  /**
   * Fetch a single PR by number from the configured repo.
   */
  async fetchSinglePR(prNumber: number): Promise<GitHubPR> {
    const { data } = await this.octokit.rest.pulls.get({
      owner: this.repoOwner,
      repo: this.repoName,
      pull_number: prNumber,
    })

    return {
      id: data.id,
      number: data.number,
      html_url: data.html_url,
      title: data.title,
      body: data.body,
      user: { login: data.user?.login ?? '' },
      labels: (data.labels ?? []).map(l => ({ name: typeof l === 'string' ? l : l.name ?? '' })),
      created_at: data.created_at,
    }
  }

  /**
   * Fetch PR changes file-by-file using the files endpoint (paginated).
   * Skips generated files, lock files, and snapshots.
   * Assembles a unified diff string from per-file patches.
   */
  async fetchPRDiff(prNumber: number): Promise<string> {
    const files: PRFileChange[] = []
    let page = 1
    const perPage = 100

    while (true) {
      const { data } = await this.octokit.rest.pulls.listFiles({
        owner: this.repoOwner,
        repo: this.repoName,
        pull_number: prNumber,
        per_page: perPage,
        page,
      })

      if (data.length === 0) break

      for (const file of data) {
        if (shouldSkipFile(file.filename)) continue

        files.push({
          filename: file.filename,
          status: file.status ?? 'modified',
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          patch: file.patch,
        })
      }

      if (data.length < perPage) break
      page++

      if (page > 30) {
        console.warn(LOG_PREFIX, `PR #${prNumber}: reached file pagination limit (${files.length} files)`)
        break
      }
    }

    console.log(LOG_PREFIX, `PR #${prNumber}: ${files.length} changed files across ${page} page(s)`)

    const diffParts: string[] = []
    let totalChars = 0
    const MAX_DIFF_CHARS = 150_000

    const totalAdditions = files.reduce((s, f) => s + f.additions, 0)
    const totalDeletions = files.reduce((s, f) => s + f.deletions, 0)
    diffParts.push(`# ${files.length} files changed, ${totalAdditions} insertions(+), ${totalDeletions} deletions(-)\n`)

    for (const file of files) {
      const header = `\n--- a/${file.filename}\n+++ b/${file.filename}\n`

      if (!file.patch) {
        const note = `${header}[File changed: +${file.additions} -${file.deletions}, patch not available]\n`
        if (totalChars + note.length > MAX_DIFF_CHARS) {
          diffParts.push(`\n[...${files.length - diffParts.length} more files truncated]`)
          break
        }
        diffParts.push(note)
        totalChars += note.length
        continue
      }

      const chunk = `${header}${file.patch}\n`
      if (totalChars + chunk.length > MAX_DIFF_CHARS) {
        const summary = `${header}[Patch truncated: +${file.additions} -${file.deletions}]\n`
        diffParts.push(summary)
        totalChars += summary.length

        if (totalChars > MAX_DIFF_CHARS + 10_000) {
          diffParts.push(`\n[...${files.length - diffParts.length} more files truncated]`)
          break
        }
        continue
      }

      diffParts.push(chunk)
      totalChars += chunk.length
    }

    return diffParts.join('')
  }
}
