import {
  collectProjectSubmissionErrors,
  hasReadmeAttachment,
  isProjectReadyForSubmission,
  partitionBySubmissionReadiness,
  type ProjectSubmissionCandidate,
} from '../lib/submission-validation'

const completeProject: ProjectSubmissionCandidate = {
  title: 'Aurora',
  description: 'A working description.',
  usesPreexistingCode: false,
  preexistingCodeDescription: null,
  attachmentIds: ['att-1'],
}

const completeContext = { attachmentFileNames: ['README.md'] }

describe('hasReadmeAttachment', () => {
  it('matches README.md regardless of case and surrounding whitespace', () => {
    expect(hasReadmeAttachment(['readme.md'])).toBe(true)
    expect(hasReadmeAttachment(['  README.MD  '])).toBe(true)
    expect(hasReadmeAttachment(['docs.pdf', 'ReadMe.md'])).toBe(true)
  })

  it('does not match a file that merely contains "readme"', () => {
    expect(hasReadmeAttachment(['readme.txt'])).toBe(false)
    expect(hasReadmeAttachment(['my-readme.md'])).toBe(false)
    expect(hasReadmeAttachment([])).toBe(false)
  })
})

describe('collectProjectSubmissionErrors', () => {
  it('accepts a project that satisfies every requirement', () => {
    expect(collectProjectSubmissionErrors(completeProject, completeContext)).toEqual([])
    expect(isProjectReadyForSubmission(completeProject, completeContext)).toBe(true)
  })

  it('rejects the untouched auto-created draft that issue #105 force-published', () => {
    // Exactly the record `create-draft-projects` leaves behind for a team that
    // never opened the project editor.
    const untouchedDraft: ProjectSubmissionCandidate = {
      title: "Team Borealis's Project",
      description: null,
      usesPreexistingCode: false,
      attachmentIds: [],
    }

    expect(collectProjectSubmissionErrors(untouchedDraft, { attachmentFileNames: [] })).toEqual([
      'Description is required',
      'README.md feedback file is required',
    ])
    expect(isProjectReadyForSubmission(untouchedDraft, { attachmentFileNames: [] })).toBe(false)
  })

  it('treats a blank or whitespace-only title and description as missing', () => {
    expect(
      collectProjectSubmissionErrors({ ...completeProject, title: '   ', description: '\n' }, completeContext),
    ).toEqual(['Title is required', 'Description is required'])
  })

  it('requires an originality disclosure only when code reuse is declared', () => {
    expect(
      collectProjectSubmissionErrors(
        { ...completeProject, usesPreexistingCode: true, preexistingCodeDescription: null },
        completeContext,
      ),
    ).toEqual(['Pre-existing code description is required when declaring code reuse'])

    expect(
      collectProjectSubmissionErrors(
        { ...completeProject, usesPreexistingCode: true, preexistingCodeDescription: 'Reused our auth lib.' },
        completeContext,
      ),
    ).toEqual([])

    expect(
      collectProjectSubmissionErrors(
        { ...completeProject, usesPreexistingCode: false, preexistingCodeDescription: null },
        completeContext,
      ),
    ).toEqual([])
  })

  it('distinguishes "no attachments at all" from "attachments but no README"', () => {
    expect(
      collectProjectSubmissionErrors({ ...completeProject, attachmentIds: [] }, { attachmentFileNames: [] }),
    ).toEqual(['README.md feedback file is required'])

    expect(
      collectProjectSubmissionErrors(
        { ...completeProject, attachmentIds: ['att-1'] },
        { attachmentFileNames: ['screenshot.png'] },
      ),
    ).toEqual(['Upload a README.md feedback file before submitting'])
  })

  it('reports every unmet requirement at once, not just the first', () => {
    expect(
      collectProjectSubmissionErrors(
        { title: '', description: '', usesPreexistingCode: true, preexistingCodeDescription: '', attachmentIds: [] },
        { attachmentFileNames: [] },
      ),
    ).toHaveLength(4)
  })
})

describe('partitionBySubmissionReadiness', () => {
  // The two teams from the issue report, side by side.
  const aurora = {
    id: 'p-aurora',
    title: 'Aurora',
    description: 'Complete submission.',
    usesPreexistingCode: false,
    attachmentIds: ['att-readme'],
  }
  const borealis = {
    id: 'p-borealis',
    title: "Team Borealis's Project",
    description: '',
    usesPreexistingCode: false,
    attachmentIds: [] as string[],
  }
  const fileNames: Record<string, string[]> = { 'p-aurora': ['README.md'], 'p-borealis': [] }

  it('publishes the complete submission and holds back the untouched draft', () => {
    const partition = partitionBySubmissionReadiness([aurora, borealis], (p) => fileNames[p.id])

    expect(partition.ready.map((p) => p.id)).toEqual(['p-aurora'])
    expect(partition.incomplete.map((entry) => entry.project.id)).toEqual(['p-borealis'])
  })

  it('carries the reasons for every held-back draft, so they can be reported', () => {
    const partition = partitionBySubmissionReadiness([aurora, borealis], (p) => fileNames[p.id])

    expect(partition.incomplete[0].reasons).toEqual([
      'Description is required',
      'README.md feedback file is required',
    ])
  })

  it('is empty-safe', () => {
    expect(partitionBySubmissionReadiness([], () => [])).toEqual({ ready: [], incomplete: [] })
  })
})
