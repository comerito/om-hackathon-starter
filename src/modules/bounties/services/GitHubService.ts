import { Octokit } from 'octokit'

interface BountyConfig {
  githubToken: string
  repoOwner: string
  repoName: string
  bountyLabel: string
  approvedLabel: string
  rejectedLabel: string
}

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

export interface FetchOptions {
  /** Only include PRs created on or after this date */
  since?: Date
  /** Only include PRs created on or before this date */
  until?: Date
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

  private config: BountyConfig = {
    githubToken: process.env.GITHUB_TOKEN ?? '',
    repoOwner: process.env.GITHUB_REPO_OWNER ?? 'open-mercato',
    repoName: process.env.GITHUB_REPO_NAME ?? 'open-mercato',
    bountyLabel: process.env.BOUNTY_LABEL ?? 'bounty-hunting',
    approvedLabel: process.env.BOUNTY_APPROVED_LABEL ?? 'approved',
    rejectedLabel: process.env.BOUNTY_REJECTED_LABEL ?? 'rejected',
  }

  constructor() {
    this.octokit = new Octokit({ auth: this.config.githubToken })
  }

  get bountyLabel(): string {
    return this.config.bountyLabel
  }

  get approvedLabel(): string {
    return this.config.approvedLabel
  }

  get rejectedLabel(): string {
    return this.config.rejectedLabel
  }

  /**
   * Fetch all PRs with the bounty label, paginating through all results.
   * Optionally filters by creation date range (competition start/end).
   */
  async fetchBountyPRs(options?: FetchOptions): Promise<GitHubPR[]> {
    const allPRs: GitHubPR[] = []
    let page = 1
    const perPage = 100

    console.log(LOG_PREFIX, `Fetching PRs from ${this.config.repoOwner}/${this.config.repoName} (label: ${this.config.bountyLabel})`)
    if (options?.since) console.log(LOG_PREFIX, `  since: ${options.since.toISOString()}`)
    if (options?.until) console.log(LOG_PREFIX, `  until: ${options.until.toISOString()}`)

    while (true) {
      const { data } = await this.octokit.rest.pulls.list({
        owner: this.config.repoOwner,
        repo: this.config.repoName,
        state: 'all',
        sort: 'created',
        direction: 'desc',
        per_page: perPage,
        page,
      })

      if (data.length === 0) break

      const prs = (data as GitHubPR[]).filter(pr => {
        if (!pr.labels.some(label => label.name === this.config.bountyLabel)) return false
        const createdAt = new Date(pr.created_at)
        if (options?.since && createdAt < options.since) return false
        if (options?.until && createdAt > options.until) return false
        return true
      })

      allPRs.push(...prs)

      if (data.length < perPage) break

      if (options?.since) {
        const oldestOnPage = new Date(data[data.length - 1].created_at)
        if (oldestOnPage < options.since) break
      }

      page++
      if (page > 10) {
        console.warn(LOG_PREFIX, `Reached pagination limit (${page - 1} pages, ${allPRs.length} bounty PRs)`)
        break
      }
    }

    console.log(LOG_PREFIX, `Found ${allPRs.length} bounty PRs across ${page} page(s)`)
    return allPRs
  }

  /**
   * Fetch PR changes file-by-file using the files endpoint (paginated).
   * This avoids the 20,000 line limit of the single-diff endpoint.
   * Skips generated files, lock files, and snapshots.
   * Assembles a unified diff string from per-file patches.
   */
  async fetchPRDiff(prNumber: number): Promise<string> {
    const files: PRFileChange[] = []
    let page = 1
    const perPage = 100

    while (true) {
      const { data } = await this.octokit.rest.pulls.listFiles({
        owner: this.config.repoOwner,
        repo: this.config.repoName,
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
          patch: file.patch, // undefined for binary or very large individual files
        })
      }

      if (data.length < perPage) break
      page++

      // Safety: max 30 pages = 3000 files
      if (page > 30) {
        console.warn(LOG_PREFIX, `PR #${prNumber}: reached file pagination limit (${files.length} files)`)
        break
      }
    }

    console.log(LOG_PREFIX, `PR #${prNumber}: ${files.length} changed files across ${page} page(s)`)

    // Build unified diff from per-file patches
    const diffParts: string[] = []
    let totalChars = 0
    const MAX_DIFF_CHARS = 150_000 // ~150KB limit for LLM context

    // Summary header
    const totalAdditions = files.reduce((s, f) => s + f.additions, 0)
    const totalDeletions = files.reduce((s, f) => s + f.deletions, 0)
    diffParts.push(`# ${files.length} files changed, ${totalAdditions} insertions(+), ${totalDeletions} deletions(-)\n`)

    for (const file of files) {
      const header = `\n--- a/${file.filename}\n+++ b/${file.filename}\n`

      if (!file.patch) {
        // No patch available (binary or too large for single file)
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
        // Add a summary for this file instead of the full patch
        const summary = `${header}[Patch truncated: +${file.additions} -${file.deletions}]\n`
        diffParts.push(summary)
        totalChars += summary.length

        // If even summaries would overflow, stop
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

  async addLabel(prNumber: number, label: string): Promise<void> {
    await this.octokit.rest.issues.addLabels({
      owner: this.config.repoOwner,
      repo: this.config.repoName,
      issue_number: prNumber,
      labels: [label],
    })
  }

  async removeLabel(prNumber: number, label: string): Promise<void> {
    try {
      await this.octokit.rest.issues.removeLabel({
        owner: this.config.repoOwner,
        repo: this.config.repoName,
        issue_number: prNumber,
        name: label,
      })
    } catch {
      // Label may not exist, ignore
    }
  }
}
