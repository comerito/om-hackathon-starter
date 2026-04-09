import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import crypto from 'crypto'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { BountyPullRequest, BountyPRStatus, BountyCategory, BOUNTY_POINTS, BountyActivityType, BountyActivityLog } from '../data/entities'
import type { BountyClassification } from '../data/entities'
import { splitAnalysisResultSchema } from '../data/validators'
import type { SplitAnalysisResult } from '../data/validators'

const LOG_PREFIX = '[bounties:split-detection]'

const TIME_WINDOW_MS = 2 * 60 * 60 * 1000 // 2 hours
const FILE_OVERLAP_THRESHOLD = 0.5 // 50% shared files
const SAME_CATEGORY_MIN = 3 // 3+ same-category PRs in window

interface SplitCluster {
  prIds: string[]
  reason: string
}

export class SplitDetectionService {
  /**
   * Layer 1: Heuristic pre-filter. Checks for suspicious patterns.
   * Returns a cluster of PR IDs if flagged, null otherwise.
   */
  async checkForSplitting(em: EntityManager, pr: BountyPullRequest): Promise<SplitCluster | null> {
    const recentPRs = await em.find(BountyPullRequest, {
      githubAuthor: pr.githubAuthor,
      competitionId: pr.competitionId,
      tenantId: pr.tenantId,
      id: { $ne: pr.id },
      githubCreatedAt: { $gte: new Date(pr.githubCreatedAt.getTime() - TIME_WINDOW_MS) },
      isDuplicate: false,
      isSplitChild: false,
      deletedAt: null,
    } as FilterQuery<BountyPullRequest>)

    if (recentPRs.length === 0) return null

    console.log(LOG_PREFIX, `PR #${pr.githubPrNumber}: found ${recentPRs.length} recent PR(s) from @${pr.githubAuthor}`)

    // Check file overlap
    const newFiles = this.extractChangedFiles(pr.diffContent ?? '')
    for (const existing of recentPRs) {
      const existingFiles = this.extractChangedFiles(existing.diffContent ?? '')
      const overlap = this.calculateFileOverlap(newFiles, existingFiles)

      if (overlap >= FILE_OVERLAP_THRESHOLD) {
        console.log(LOG_PREFIX, `PR #${pr.githubPrNumber}: ${(overlap * 100).toFixed(0)}% file overlap with PR #${existing.githubPrNumber}`)
        return {
          prIds: [existing.id, pr.id],
          reason: `${(overlap * 100).toFixed(0)}% file overlap within 2h window`,
        }
      }
    }

    // Check for same-category micro-PRs
    const prCategories = pr.classifications?.map(c => c.category) ?? []
    const sameCategory = recentPRs.filter(existing => {
      const existingCats = existing.classifications?.map(c => c.category) ?? []
      return existingCats.some(c => prCategories.includes(c))
    })

    if (sameCategory.length >= SAME_CATEGORY_MIN - 1) { // -1 because newPR is also counted
      console.log(LOG_PREFIX, `PR #${pr.githubPrNumber}: ${sameCategory.length + 1} same-category PRs in 2h window`)
      return {
        prIds: [...sameCategory.map(p => p.id), pr.id],
        reason: `${sameCategory.length + 1} PRs in same category within 2h window`,
      }
    }

    return null
  }

  /**
   * Layer 2: LLM semantic analysis of a flagged cluster.
   */
  async analyzeSplitCluster(em: EntityManager, cluster: SplitCluster): Promise<SplitAnalysisResult> {
    const prs = await em.find(BountyPullRequest, {
      id: { $in: cluster.prIds },
    } as FilterQuery<BountyPullRequest>)

    const { object } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: splitAnalysisResultSchema,
      prompt: this.buildSplitAnalysisPrompt(prs),
    })

    console.log(LOG_PREFIX, `LLM split analysis: isSplit=${object.isSplit}, confidence=${object.confidence}`)
    return object
  }

  /**
   * Apply split grouping: assign splitGroupId, mark children, zero their points.
   */
  async applySplitGrouping(
    em: EntityManager,
    cluster: SplitCluster,
    analysis: SplitAnalysisResult,
  ): Promise<string> {
    const groupId = crypto.randomUUID()
    const prs = await em.find(BountyPullRequest, {
      id: { $in: cluster.prIds },
    } as FilterQuery<BountyPullRequest>, {
      orderBy: { githubCreatedAt: 'ASC' },
    })

    if (prs.length === 0) return groupId

    // Oldest PR is the primary
    const primary = prs[0]
    primary.splitGroupId = groupId

    // Re-classify the primary with combined classification if provided
    if (analysis.suggestedGroupClassification.length > 0) {
      primary.classifications = analysis.suggestedGroupClassification.map(c => ({
        category: c.category as BountyCategory,
        points: BOUNTY_POINTS[c.category as BountyCategory],
        reasoning: c.reasoning,
      }))
      primary.totalPoints = primary.classifications.reduce((sum, c) => sum + c.points, 0)
    }

    // Mark newer PRs as split children
    for (let i = 1; i < prs.length; i++) {
      prs[i].splitGroupId = groupId
      prs[i].isSplitChild = true
      prs[i].totalPoints = 0
    }

    // Log activity
    const activity = em.create(BountyActivityLog, {
      tenantId: primary.tenantId,
      organizationId: primary.organizationId,
      type: BountyActivityType.PR_SPLIT_DETECTED,
      pullRequestId: primary.id,
      message: `Split detected: ${prs.length} PRs by @${primary.githubAuthor} grouped (${cluster.reason}). Primary: PR #${primary.githubPrNumber}`,
      metadata: {
        groupId,
        prNumbers: prs.map(p => p.githubPrNumber),
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
      },
      createdAt: new Date(),
    })

    em.persist([...prs, activity])
    await em.flush()

    console.log(LOG_PREFIX, `Applied split grouping ${groupId}: primary=#${primary.githubPrNumber}, children=${prs.slice(1).map(p => `#${p.githubPrNumber}`).join(', ')}`)
    return groupId
  }

  /**
   * Ungroup a split group: restore individual scoring.
   */
  async ungroupSplit(
    em: EntityManager,
    groupId: string,
    actorUserId?: string | null,
    reason?: string,
  ): Promise<void> {
    const prs = await em.find(BountyPullRequest, {
      splitGroupId: groupId,
      deletedAt: null,
    } as FilterQuery<BountyPullRequest>)

    if (prs.length === 0) return

    for (const pr of prs) {
      pr.splitGroupId = null
      pr.isSplitChild = false
      // Recalculate points from classifications
      const classifications: BountyClassification[] = pr.pointsOverride ?? pr.classifications ?? []
      if (pr.status === BountyPRStatus.APPROVED && !pr.isDuplicate) {
        pr.totalPoints = classifications.reduce((sum, c) => sum + c.points, 0)
      }
    }

    const activity = em.create(BountyActivityLog, {
      tenantId: prs[0].tenantId,
      organizationId: prs[0].organizationId,
      type: BountyActivityType.PR_SPLIT_UNGROUPED,
      pullRequestId: prs[0].id,
      actorUserId,
      message: `Split group ungrouped${reason ? `: ${reason}` : ''}. ${prs.length} PRs restored to individual scoring.`,
      metadata: { groupId, prNumbers: prs.map(p => p.githubPrNumber) },
      createdAt: new Date(),
    })

    em.persist([...prs, activity])
    await em.flush()
  }

  private extractChangedFiles(diff: string): Set<string> {
    const files = new Set<string>()
    const regex = /^--- a\/(.+)$/gm
    let match
    while ((match = regex.exec(diff)) !== null) {
      files.add(match[1])
    }
    return files
  }

  private calculateFileOverlap(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0
    const intersection = new Set([...a].filter(f => b.has(f)))
    const smaller = Math.min(a.size, b.size)
    return intersection.size / smaller
  }

  private buildSplitAnalysisPrompt(prs: BountyPullRequest[]): string {
    return `You are an anti-gaming system for a hackathon bounty track.

Analyze whether the following PRs from the SAME AUTHOR represent a single contribution
that was intentionally split into multiple PRs to earn more points.

## Scoring Rules
- critical_bug_fix: 10 pts per PR
- regular_bug_fix: 5 pts per PR
- new_improved_test: 3 pts per PR
- documentation_improvement: 2 pts per PR
- minor_fix: 1 pt per PR

A participant benefits from splitting by earning points for each fragment separately.

## Signs of intentional splitting:
- Multiple small doc PRs editing the same or related files
- A bug fix separated from its test in different PRs
- Sequential PRs that are incremental additions to the same logical change
- PRs that only make sense together (e.g., fix part 1 / fix part 2)

## Signs of legitimate separate PRs:
- PRs address genuinely different issues or areas of the codebase
- PRs are independently valuable and self-contained
- PRs fix different bugs even if in the same file
- A test PR tests something different than what the other PR fixes

## PRs to Analyze

${prs.map(pr => `### PR #${pr.githubPrNumber}: ${pr.title}
Author: @${pr.githubAuthor}
Submitted: ${pr.githubCreatedAt.toISOString()}
Current classification: ${pr.classifications?.map(c => c.category).join(', ') ?? 'none'}

\`\`\`diff
${(pr.diffContent ?? '').substring(0, 3000)}
\`\`\``).join('\n\n')}

If this IS a split, provide the classification the COMBINED contribution should receive
(the group earns points only once, for the combined work).`
  }
}
