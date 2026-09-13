/**
 * Who may read a project attachment from the portal?
 *
 * A project's screenshots and README belong to the team that submitted them. The portal has no
 * organiser session — every caller is a customer user — so entitlement comes from exactly two
 * relationships, both of which are rows in the database and neither of which is "is logged in":
 *
 *  - **the owning team**: an active `TeamMember` of `project.team_id` may always read;
 *  - **a judge or mentor of the project's competition**: may read once the project has left
 *    `draft`, because that is the material they are there to review. A draft is the team's own
 *    scratch space and stays private to them.
 *
 * Everyone else gets a 403 — including a participant of the same competition who is on another
 * team, which is the case reported in issue #117.
 */

/** `Attachment.entityId` of a project attachment; anything else is not this route's business. */
export const PROJECT_ATTACHMENT_ENTITY_ID = 'projects:project'

/** `ProjectStatus.DRAFT` — kept as a literal so this module stays free of entity imports. */
const DRAFT_STATUS = 'draft'

export type ProjectAssetViewer = {
  /** Is the caller an active member (not left, not deleted) of the owning team? */
  isTeamMember: boolean
  /** The caller's participation role in the project's competition, or `null` if they have none. */
  competitionRole: string | null
}

export type ProjectAssetSubject = {
  /** The owning project's status; `draft` means the team is still working on it. */
  status: string
}

/** Roles that review submitted work and therefore need to open its attachments. */
const REVIEWER_ROLES = new Set(['judge', 'mentor'])

export function canReadProjectAsset(
  viewer: ProjectAssetViewer,
  subject: ProjectAssetSubject,
): boolean {
  if (viewer.isTeamMember) return true
  if (subject.status === DRAFT_STATUS) return false
  return viewer.competitionRole != null && REVIEWER_ROLES.has(viewer.competitionRole)
}
