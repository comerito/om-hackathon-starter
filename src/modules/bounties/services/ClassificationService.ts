import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import type { EntityManager } from '@mikro-orm/postgresql'
import { BountyPullRequest, BountyPRStatus, BountyCategory, BOUNTY_POINTS } from '../data/entities'
import type { BountyClassification } from '../data/entities'
import { classificationResultSchema, duplicateCheckResultSchema } from '../data/validators'
import type { ClassificationResult } from '../data/validators'

export class ClassificationService {
  async classifyAndDetectDuplicates(em: EntityManager, pr: BountyPullRequest): Promise<void> {
    // Step 1: Classify
    const classification = await this.classify(pr)

    pr.classifications = classification.classifications.map(c => ({
      category: c.category as BountyCategory,
      points: BOUNTY_POINTS[c.category as BountyCategory],
      reasoning: c.reasoning,
    }))
    pr.classificationConfidence = classification.confidence
    pr.classificationSummary = classification.summary
    pr.status = BountyPRStatus.CLASSIFIED

    // Step 2: Duplicate detection
    await this.detectDuplicates(em, pr)

    // Step 3: Set final status
    if (!pr.isDuplicate) {
      pr.status = BountyPRStatus.PENDING_REVIEW
      pr.totalPoints = this.calculatePoints(pr.classifications)
    }

    em.persist(pr)
    await em.flush()
  }

  private async classify(pr: BountyPullRequest): Promise<ClassificationResult> {
    const { object } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: classificationResultSchema,
      prompt: this.buildClassificationPrompt(pr),
    })
    return object
  }

  private buildClassificationPrompt(pr: BountyPullRequest): string {
    return `You are a code review classifier for a hackathon bounty hunting track.

Analyze the following Pull Request and classify it into one or more categories.
A single PR can belong to multiple categories if it addresses multiple concerns.

## Categories and Criteria

- **critical_bug_fix** (10 pts): Fixes a bug that causes crashes, data loss, security vulnerabilities, or breaks core functionality. The fix is non-trivial and addresses a significant issue.
- **regular_bug_fix** (5 pts): Fixes a bug that causes incorrect behavior, UI glitches, or edge case failures. The fix is meaningful but not critical.
- **new_improved_test** (3 pts): Adds new test cases or significantly improves existing tests. Must add real coverage, not trivial/obvious tests.
- **documentation_improvement** (2 pts): Improves README, JSDoc, inline comments, or other documentation. Must be substantive (not just typo fixes in comments).
- **minor_fix** (1 pt): Small improvements like typo fixes, code formatting, minor refactoring, dependency updates, or trivial changes.

## PR Information

**Title:** ${pr.title}
**Description:** ${pr.description ?? 'No description provided.'}

## Code Diff (Primary Classification Factor)

\`\`\`diff
${pr.diffContent ?? 'No diff available.'}
\`\`\`

Classify based primarily on the code diff. The title and description provide context but the actual code changes determine the category.
Set confidence below 0.7 if the classification is ambiguous between tiers.`
  }

  private async detectDuplicates(em: EntityManager, pr: BountyPullRequest): Promise<void> {
    const existingPRs = await em.find(BountyPullRequest, {
      tenantId: pr.tenantId,
      organizationId: pr.organizationId,
      status: { $nin: [BountyPRStatus.REJECTED, BountyPRStatus.DUPLICATE] },
      id: { $ne: pr.id },
      isDuplicate: false,
    })

    if (existingPRs.length === 0) return

    const existingSummaries = existingPRs.map(existing => ({
      prNumber: existing.githubPrNumber,
      title: existing.title,
      diffPreview: (existing.diffContent ?? '').substring(0, 2000),
      categories: existing.classifications?.map(c => c.category) ?? [],
      createdAt: existing.githubCreatedAt.toISOString(),
    }))

    const { object: result } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: duplicateCheckResultSchema,
      prompt: this.buildDuplicatePrompt(pr, existingSummaries),
    })

    if (result.is_duplicate && result.duplicate_of_pr_number) {
      const originalPR = existingPRs.find(e => e.githubPrNumber === result.duplicate_of_pr_number)
      if (originalPR) {
        pr.isDuplicate = true
        pr.duplicateOfId = originalPR.id
        pr.duplicateMarkedBy = 'llm'
        pr.duplicateSimilarity = result.similarity
        pr.status = BountyPRStatus.DUPLICATE
        pr.totalPoints = 0
      }
    }
  }

  private buildDuplicatePrompt(
    pr: BountyPullRequest,
    existingPRs: Array<{
      prNumber: number
      title: string
      diffPreview: string
      categories: string[]
      createdAt: string
    }>
  ): string {
    return `You are a duplicate detection system for hackathon PR submissions.

Determine if the NEW PR below resolves the same problem as any of the EXISTING PRs.
Two PRs are duplicates if they fix the same underlying issue, even if their implementations differ.

## New PR

**#${pr.githubPrNumber}: ${pr.title}**

\`\`\`diff
${(pr.diffContent ?? '').substring(0, 3000)}
\`\`\`

## Existing PRs

${existingPRs.map(e => `### PR #${e.prNumber}: ${e.title}
Categories: ${e.categories.join(', ')}
Submitted: ${e.createdAt}
\`\`\`diff
${e.diffPreview}
\`\`\``).join('\n\n')}

If this is a duplicate, reference the EARLIEST submitted PR that addresses the same problem.
Only mark as duplicate if the PRs clearly resolve the same specific issue — not merely touching similar files or areas.`
  }

  calculatePoints(classifications: BountyClassification[]): number {
    return classifications.reduce((sum, c) => sum + c.points, 0)
  }
}
