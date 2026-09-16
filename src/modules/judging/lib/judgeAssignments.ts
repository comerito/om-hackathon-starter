import type { QueueDemo } from './votingQueue'

/**
 * Client-side shapes of `GET /api/judging/portal/my-assignments` (SPEC-007).
 *
 * Shared by the voting queue, the voting page and the project card side panel so the three
 * surfaces read the same payload. Types only — nothing here may pull entity code into the bundle.
 */

export type JudgeProjectScreenshot = { id: string; url: string }

/** One assigned project, already sorted by demo order by the API. */
export type JudgeProjectCard = {
  id: string
  title: string
  tagline: string | null
  team_id: string
  team_name: string | null
  track_id: string
  track_name: string | null
  status: string
  flagged_for_reuse: boolean
  uses_preexisting_code: boolean
  preexisting_code_description: string | null
  description: string | null
  problem_statement: string | null
  demo_url: string | null
  repo_url: string | null
  video_url: string | null
  presentation_url: string | null
  tech_stack: string[]
  demo: QueueDemo | null
  criteria_count: number
  screenshots: JudgeProjectScreenshot[]
}

/** The judge's own score row for a project, as returned alongside the assignments. */
export type JudgeAssignmentScore = {
  id: string
  project_id: string
  round: string
  total_score: number | null
  is_submitted: boolean
  conflict_of_interest: boolean
  track_id: string | null
}

export type JudgeAssignmentsResponse = {
  panels: Array<{ id: string; name: string; round: string }>
  projects: JudgeProjectCard[]
  scores: JudgeAssignmentScore[]
  voting_open: boolean
}
