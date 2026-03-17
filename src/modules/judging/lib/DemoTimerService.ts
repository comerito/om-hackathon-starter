import type { EntityManager } from '@mikro-orm/postgresql'
import { DemoStatus, JudgingRound } from '../data/entities'

interface DemoSessionRow {
  id: string
  competition_id: string
  team_id: string
  project_id: string
  track_id: string
  presentation_order: number
  scheduled_start: string | null
  presentation_duration_minutes: number
  qa_duration_minutes: number
  status: string
  actual_start: string | null
  actual_end: string | null
  round: string
  tenant_id: string
  organization_id: string
  created_at: string
  updated_at: string
}

const STATUS_ADVANCE_MAP: Record<string, string> = {
  [DemoStatus.QUEUED]: DemoStatus.ON_DECK,
  [DemoStatus.ON_DECK]: DemoStatus.PRESENTING,
  [DemoStatus.PRESENTING]: DemoStatus.QA,
  [DemoStatus.QA]: DemoStatus.COMPLETED,
}

export class DemoTimerService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Generate a demo queue from published projects for a given competition and round.
   * Creates DemoSession entries ordered by track, then by team presentation_order.
   */
  async generateQueue(
    competitionId: string,
    round: string,
    tenantId: string,
    organizationId: string,
  ): Promise<{ created: number }> {
    const knex = this.em.getKnex()

    // Delete existing queue for this competition+round to allow regeneration
    await knex('judging_demo_session')
      .where({ competition_id: competitionId, round })
      .delete()

    // Fetch published projects with their teams, ordered by track then presentation_order
    const projects = await knex('projects_project as p')
      .join('teams_team as t', 't.id', 'p.team_id')
      .where('p.competition_id', competitionId)
      .where('p.is_active', true)
      .whereIn('p.status', ['PUBLISHED', 'UNDER_REVIEW'])
      .where('t.status', 'ACTIVE')
      .whereNull('t.deleted_at')
      .orderBy('p.track_id', 'asc')
      .orderBy('t.presentation_order', 'asc')
      .orderBy('p.created_at', 'asc')
      .select(
        'p.id as project_id',
        'p.team_id as team_id',
        'p.track_id as track_id',
        'p.competition_id as competition_id',
      )

    if (projects.length === 0) return { created: 0 }

    // Get demo config from competition
    const competition = await knex('competitions_competition')
      .where('id', competitionId)
      .first()

    const demoConfig = (competition?.demo_config ?? {}) as Record<string, unknown>
    const presentationDuration = Number(demoConfig.presentationDurationMinutes) || 3
    const qaDuration = Number(demoConfig.qaDurationMinutes) || 2

    const rows = projects.map((p: Record<string, string>, idx: number) => ({
      competition_id: competitionId,
      team_id: p.team_id,
      project_id: p.project_id,
      track_id: p.track_id,
      presentation_order: idx + 1,
      presentation_duration_minutes: presentationDuration,
      qa_duration_minutes: qaDuration,
      status: DemoStatus.QUEUED,
      round,
      tenant_id: tenantId,
      organization_id: organizationId,
      created_at: new Date(),
      updated_at: new Date(),
    }))

    await knex('judging_demo_session').insert(rows)

    return { created: rows.length }
  }

  /**
   * Advance a demo session to the next status.
   * QUEUED -> ON_DECK -> PRESENTING -> QA -> COMPLETED
   */
  async advanceDemo(demoId: string): Promise<{
    demo: DemoSessionRow
    previousStatus: string
    newStatus: string
  }> {
    const knex = this.em.getKnex()

    const demo = await knex('judging_demo_session')
      .where('id', demoId)
      .first() as DemoSessionRow | undefined

    if (!demo) {
      throw new Error('Demo session not found')
    }

    const newStatus = STATUS_ADVANCE_MAP[demo.status]
    if (!newStatus) {
      throw new Error(`Cannot advance demo from status ${demo.status}`)
    }

    const previousStatus = demo.status
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date(),
    }

    // Record actual_start when transitioning to PRESENTING
    if (newStatus === DemoStatus.PRESENTING) {
      updates.actual_start = new Date()
    }

    // Record actual_end when transitioning to COMPLETED
    if (newStatus === DemoStatus.COMPLETED) {
      updates.actual_end = new Date()
    }

    await knex('judging_demo_session')
      .where('id', demoId)
      .update(updates)

    const updated = await knex('judging_demo_session')
      .where('id', demoId)
      .first() as DemoSessionRow

    return {
      demo: updated,
      previousStatus,
      newStatus,
    }
  }

  /**
   * Skip a demo session, marking it as SKIPPED.
   */
  async skipDemo(demoId: string): Promise<DemoSessionRow> {
    const knex = this.em.getKnex()

    const demo = await knex('judging_demo_session')
      .where('id', demoId)
      .first() as DemoSessionRow | undefined

    if (!demo) {
      throw new Error('Demo session not found')
    }

    if (demo.status === DemoStatus.COMPLETED || demo.status === DemoStatus.SKIPPED) {
      throw new Error(`Cannot skip demo with status ${demo.status}`)
    }

    await knex('judging_demo_session')
      .where('id', demoId)
      .update({
        status: DemoStatus.SKIPPED,
        actual_end: new Date(),
        updated_at: new Date(),
      })

    return await knex('judging_demo_session')
      .where('id', demoId)
      .first() as DemoSessionRow
  }

  /**
   * Get the currently active demo session (PRESENTING or QA status).
   * Falls back to ON_DECK if nothing is presenting.
   */
  async getCurrentDemo(competitionId: string): Promise<DemoSessionRow | null> {
    const knex = this.em.getKnex()

    // First try to find a PRESENTING or QA session
    let demo = await knex('judging_demo_session')
      .where('competition_id', competitionId)
      .whereIn('status', [DemoStatus.PRESENTING, DemoStatus.QA])
      .orderBy('presentation_order', 'asc')
      .first() as DemoSessionRow | undefined

    if (demo) return demo

    // Fall back to ON_DECK
    demo = await knex('judging_demo_session')
      .where('competition_id', competitionId)
      .where('status', DemoStatus.ON_DECK)
      .orderBy('presentation_order', 'asc')
      .first() as DemoSessionRow | undefined

    return demo ?? null
  }

  /**
   * Get the next queued demo (for marking as ON_DECK).
   */
  async getNextQueued(competitionId: string): Promise<DemoSessionRow | null> {
    const knex = this.em.getKnex()

    const demo = await knex('judging_demo_session')
      .where('competition_id', competitionId)
      .where('status', DemoStatus.QUEUED)
      .orderBy('presentation_order', 'asc')
      .first() as DemoSessionRow | undefined

    return demo ?? null
  }
}
