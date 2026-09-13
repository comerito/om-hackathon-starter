import { PORTAL_SCORE_FEATURE, requirePortalFeatures } from '../portalAuth'
import type { CustomerAuthContext } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'

function portalUser(resolvedFeatures: string[]): CustomerAuthContext {
  return {
    sub: '66666666-6666-4666-8666-666666666666',
    sid: '77777777-7777-4777-8777-777777777777',
    type: 'customer',
    tenantId: '88888888-8888-4888-8888-888888888888',
    orgId: '99999999-9999-4999-8999-999999999999',
    email: 'foxtrot@hackon.test',
    displayName: 'Foxtrot',
    resolvedFeatures,
  }
}

describe('requirePortalFeatures', () => {
  it('401s an anonymous caller', () => {
    const denied = requirePortalFeatures(null, [PORTAL_SCORE_FEATURE])
    expect(denied?.status).toBe(401)
  })

  it('403s a logged-in participant who does not hold the feature', () => {
    // `foxtrot@hackon.test` from issue #116: an ordinary participant, no judging features.
    const participant = portalUser(['portal.judging.results.view', 'portal.judging.demos.view'])
    expect(requirePortalFeatures(participant, [PORTAL_SCORE_FEATURE])?.status).toBe(403)
  })

  it('allows a judge', () => {
    const judge = portalUser([PORTAL_SCORE_FEATURE, 'portal.judging.view_assigned'])
    expect(requirePortalFeatures(judge, [PORTAL_SCORE_FEATURE])).toBeNull()
  })

  it('allows a portal admin through the wildcard grant', () => {
    expect(requirePortalFeatures(portalUser(['*']), [PORTAL_SCORE_FEATURE])).toBeNull()
  })

  it('allows a scope wildcard grant', () => {
    expect(requirePortalFeatures(portalUser(['portal.judging.*']), [PORTAL_SCORE_FEATURE])).toBeNull()
  })

  it('denies a caller with no resolved features at all', () => {
    expect(requirePortalFeatures(portalUser([]), [PORTAL_SCORE_FEATURE])?.status).toBe(403)
  })
})
