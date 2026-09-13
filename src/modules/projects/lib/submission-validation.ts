/**
 * The submission requirements a project has to satisfy before it counts as a
 * real entry.
 *
 * There are two paths that turn a DRAFT project into a PUBLISHED one:
 *
 *  - the participant path — `api/portal/submit-project`, driven by the team owner;
 *  - the organiser path — `subscribers/publish-draft-projects`, driven by the
 *    `demos` stage transition.
 *
 * Both MUST apply the same rules, otherwise ignoring the deadline is cheaper than
 * complying with it. This module is the single definition, kept pure so it can be
 * unit-tested without a database.
 */

export const README_FILE_NAME = 'readme.md'

/** The subset of `Project` the submission rules actually read. */
export type ProjectSubmissionCandidate = {
  title?: string | null
  description?: string | null
  usesPreexistingCode?: boolean | null
  preexistingCodeDescription?: string | null
  attachmentIds?: string[] | null
}

export type ProjectSubmissionContext = {
  /** File names of the attachments referenced by `attachmentIds`, in any order. */
  attachmentFileNames: readonly string[]
}

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0
}

/** True when one of the project's attachments is the mandatory `README.md`. */
export function hasReadmeAttachment(fileNames: readonly string[]): boolean {
  return fileNames.some((name) => typeof name === 'string' && name.trim().toLowerCase() === README_FILE_NAME)
}

/**
 * Every reason the project cannot be submitted, as user-facing strings.
 * An empty array means the project satisfies every submission requirement.
 */
export function collectProjectSubmissionErrors(
  project: ProjectSubmissionCandidate,
  context: ProjectSubmissionContext,
): string[] {
  const errors: string[] = []

  if (isBlank(project.title)) errors.push('Title is required')
  if (isBlank(project.description)) errors.push('Description is required')
  if (project.usesPreexistingCode && isBlank(project.preexistingCodeDescription)) {
    errors.push('Pre-existing code description is required when declaring code reuse')
  }

  const attachmentIds = project.attachmentIds ?? []
  if (attachmentIds.length === 0) {
    errors.push('README.md feedback file is required')
  } else if (!hasReadmeAttachment(context.attachmentFileNames)) {
    errors.push('Upload a README.md feedback file before submitting')
  }

  return errors
}

/** Convenience predicate over {@link collectProjectSubmissionErrors}. */
export function isProjectReadyForSubmission(
  project: ProjectSubmissionCandidate,
  context: ProjectSubmissionContext,
): boolean {
  return collectProjectSubmissionErrors(project, context).length === 0
}

export type SubmissionReadinessPartition<T> = {
  /** Drafts that may be auto-published — they meet every submission requirement. */
  ready: T[]
  /** Drafts that must stay DRAFT, each with the reasons to report. */
  incomplete: Array<{ project: T; reasons: string[] }>
}

/**
 * Split a batch of drafts into the ones the `demos` transition may publish and the
 * ones it must leave alone. Pure: the caller resolves attachment names up front so
 * this never has to touch the EntityManager mid-flush.
 */
export function partitionBySubmissionReadiness<T extends ProjectSubmissionCandidate>(
  projects: readonly T[],
  attachmentFileNamesFor: (project: T) => readonly string[],
): SubmissionReadinessPartition<T> {
  const partition: SubmissionReadinessPartition<T> = { ready: [], incomplete: [] }

  for (const project of projects) {
    const reasons = collectProjectSubmissionErrors(project, {
      attachmentFileNames: attachmentFileNamesFor(project),
    })
    if (reasons.length === 0) partition.ready.push(project)
    else partition.incomplete.push({ project, reasons })
  }

  return partition
}
