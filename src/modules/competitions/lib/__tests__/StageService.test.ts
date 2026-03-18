import { StageService } from '../StageService'

describe('StageService', () => {
  const service = new StageService()

  describe('isValidTransition', () => {
    // Valid transitions
    it('allows DRAFT -> OPEN', () => {
      expect(service.isValidTransition('DRAFT', 'OPEN')).toBe(true)
    })

    it('allows OPEN -> TEAM_FORMATION', () => {
      expect(service.isValidTransition('OPEN', 'TEAM_FORMATION')).toBe(true)
    })

    it('allows TEAM_FORMATION -> TRACK_SELECTION', () => {
      expect(service.isValidTransition('TEAM_FORMATION', 'TRACK_SELECTION')).toBe(true)
    })

    it('allows TEAM_FORMATION -> HACKING (skip track selection)', () => {
      expect(service.isValidTransition('TEAM_FORMATION', 'HACKING')).toBe(true)
    })

    it('allows TRACK_SELECTION -> HACKING', () => {
      expect(service.isValidTransition('TRACK_SELECTION', 'HACKING')).toBe(true)
    })

    it('allows HACKING -> DEMOS', () => {
      expect(service.isValidTransition('HACKING', 'DEMOS')).toBe(true)
    })

    it('allows DEMOS -> DELIBERATION', () => {
      expect(service.isValidTransition('DEMOS', 'DELIBERATION')).toBe(true)
    })

    it('allows DELIBERATION -> FINISHED', () => {
      expect(service.isValidTransition('DELIBERATION', 'FINISHED')).toBe(true)
    })

    it('allows FINISHED -> ARCHIVED', () => {
      expect(service.isValidTransition('FINISHED', 'ARCHIVED')).toBe(true)
    })

    // Invalid transitions
    it('rejects DRAFT -> HACKING', () => {
      expect(service.isValidTransition('DRAFT', 'HACKING')).toBe(false)
    })

    it('rejects DRAFT -> TEAM_FORMATION', () => {
      expect(service.isValidTransition('DRAFT', 'TEAM_FORMATION')).toBe(false)
    })

    it('rejects OPEN -> HACKING', () => {
      expect(service.isValidTransition('OPEN', 'HACKING')).toBe(false)
    })

    it('rejects HACKING -> FINISHED (must go through DEMOS)', () => {
      expect(service.isValidTransition('HACKING', 'FINISHED')).toBe(false)
    })

    it('rejects ARCHIVED -> DRAFT', () => {
      expect(service.isValidTransition('ARCHIVED', 'DRAFT')).toBe(false)
    })

    it('rejects ARCHIVED -> OPEN', () => {
      expect(service.isValidTransition('ARCHIVED', 'OPEN')).toBe(false)
    })

    it('rejects ARCHIVED -> FINISHED', () => {
      expect(service.isValidTransition('ARCHIVED', 'FINISHED')).toBe(false)
    })

    it('rejects backward transition FINISHED -> DEMOS', () => {
      expect(service.isValidTransition('FINISHED', 'DEMOS')).toBe(false)
    })

    it('rejects self-transition HACKING -> HACKING', () => {
      expect(service.isValidTransition('HACKING', 'HACKING')).toBe(false)
    })

    it('returns false for unknown stage', () => {
      expect(service.isValidTransition('UNKNOWN', 'OPEN')).toBe(false)
    })
  })

  describe('getNextStages', () => {
    it('DRAFT has one next stage: OPEN', () => {
      expect(service.getNextStages('DRAFT')).toEqual(['OPEN'])
    })

    it('OPEN has one next stage: TEAM_FORMATION', () => {
      expect(service.getNextStages('OPEN')).toEqual(['TEAM_FORMATION'])
    })

    it('TEAM_FORMATION has two options: TRACK_SELECTION and HACKING', () => {
      const next = service.getNextStages('TEAM_FORMATION')
      expect(next).toHaveLength(2)
      expect(next).toContain('TRACK_SELECTION')
      expect(next).toContain('HACKING')
    })

    it('TRACK_SELECTION has one next stage: HACKING', () => {
      expect(service.getNextStages('TRACK_SELECTION')).toEqual(['HACKING'])
    })

    it('HACKING has one next stage: DEMOS', () => {
      expect(service.getNextStages('HACKING')).toEqual(['DEMOS'])
    })

    it('DEMOS has one next stage: DELIBERATION', () => {
      expect(service.getNextStages('DEMOS')).toEqual(['DELIBERATION'])
    })

    it('DELIBERATION has one next stage: FINISHED', () => {
      expect(service.getNextStages('DELIBERATION')).toEqual(['FINISHED'])
    })

    it('FINISHED has one next stage: ARCHIVED', () => {
      expect(service.getNextStages('FINISHED')).toEqual(['ARCHIVED'])
    })

    it('ARCHIVED has no next stages', () => {
      expect(service.getNextStages('ARCHIVED')).toEqual([])
    })

    it('returns empty array for unknown stage', () => {
      expect(service.getNextStages('UNKNOWN')).toEqual([])
    })
  })
})
