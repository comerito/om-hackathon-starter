import { CompetitionStage, STAGE_ORDER } from '../../../competitions/data/entities'
import { areResultsPublished } from '../resultsScope'

describe('areResultsPublished', () => {
  it('keeps the ranking closed for every stage before judging ends', () => {
    // `deliberation` is the one that matters: judging is in progress, so the ranking is both
    // incomplete and exactly what a competitor must not see.
    const closed = [
      CompetitionStage.DRAFT,
      CompetitionStage.OPEN,
      CompetitionStage.TEAM_FORMATION,
      CompetitionStage.TRACK_SELECTION,
      CompetitionStage.HACKING,
      CompetitionStage.DEMOS,
      CompetitionStage.DELIBERATION,
    ]
    for (const stage of closed) {
      expect(areResultsPublished(stage)).toBe(false)
    }
  })

  it('opens the ranking once the competition is finished or archived', () => {
    expect(areResultsPublished(CompetitionStage.FINISHED)).toBe(true)
    expect(areResultsPublished(CompetitionStage.ARCHIVED)).toBe(true)
  })

  it('agrees with the portal results page, which unlocks on finished/archived only', () => {
    const published = STAGE_ORDER.filter(areResultsPublished)
    expect(published).toEqual([CompetitionStage.FINISHED, CompetitionStage.ARCHIVED])
  })

  it('fails closed on a missing or unknown stage', () => {
    expect(areResultsPublished(null)).toBe(false)
    expect(areResultsPublished(undefined)).toBe(false)
    expect(areResultsPublished('')).toBe(false)
    expect(areResultsPublished('not_a_stage')).toBe(false)
  })
})
