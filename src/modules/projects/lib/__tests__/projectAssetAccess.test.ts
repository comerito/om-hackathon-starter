import { canReadProjectAsset } from '../projectAssetAccess'

const draft = { status: 'draft' }
const published = { status: 'published' }
const underReview = { status: 'under_review' }

describe('canReadProjectAsset', () => {
  it('lets an active member of the owning team read at any status', () => {
    for (const subject of [draft, published, underReview]) {
      expect(canReadProjectAsset({ isTeamMember: true, competitionRole: null }, subject)).toBe(true)
    }
  })

  it('refuses a participant of the same competition who is on another team (issue #117)', () => {
    for (const subject of [draft, published, underReview]) {
      expect(
        canReadProjectAsset({ isTeamMember: false, competitionRole: 'participant' }, subject),
      ).toBe(false)
    }
  })

  it('refuses a caller with no relationship to the competition at all', () => {
    for (const subject of [draft, published, underReview]) {
      expect(canReadProjectAsset({ isTeamMember: false, competitionRole: null }, subject)).toBe(false)
    }
  })

  it('lets judges and mentors of the competition read submitted work', () => {
    for (const role of ['judge', 'mentor']) {
      expect(canReadProjectAsset({ isTeamMember: false, competitionRole: role }, published)).toBe(true)
      expect(canReadProjectAsset({ isTeamMember: false, competitionRole: role }, underReview)).toBe(true)
    }
  })

  it('keeps a draft private to the team even from judges and mentors', () => {
    for (const role of ['judge', 'mentor']) {
      expect(canReadProjectAsset({ isTeamMember: false, competitionRole: role }, draft)).toBe(false)
    }
  })

  it('does not treat an unknown role as a reviewer', () => {
    expect(canReadProjectAsset({ isTeamMember: false, competitionRole: 'sponsor' }, published)).toBe(false)
    expect(canReadProjectAsset({ isTeamMember: false, competitionRole: '' }, published)).toBe(false)
  })
})
