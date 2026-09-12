import { matchesEntity } from '@open-mercato/shared/lib/crud/mutation-guard-registry'
import { canonicalizeResourceTag } from '@open-mercato/shared/lib/crud/cache'
import { SCORE_RESOURCE_KIND } from '../resourceKinds'
import judgingEvents from '../../events'

// These assertions run against the framework's *real* predicates, not a local re-implementation:
// the whole point of the finding is that a resource kind can look fine and still be unreachable
// by the matcher that actually decides whether a guard fires.
describe('SCORE_RESOURCE_KIND', () => {
  it('is reachable by a scope wildcard guard', () => {
    // `targetEntity: 'judging.*'` is how an operator freezes every judging write after the
    // deadline. With a colon in the resource kind this was false and the guard silently no-oped
    // on the one route that bothered to run the registry.
    expect(matchesEntity('judging.*', SCORE_RESOURCE_KIND)).toBe(true)
  })

  it('is reachable by the global and the exact pattern too', () => {
    expect(matchesEntity('*', SCORE_RESOURCE_KIND)).toBe(true)
    expect(matchesEntity(SCORE_RESOURCE_KIND, SCORE_RESOURCE_KIND)).toBe(true)
  })

  it('is not matched by an unrelated module scope', () => {
    expect(matchesEntity('sponsors.*', SCORE_RESOURCE_KIND)).toBe(false)
    expect(matchesEntity('teams.*', SCORE_RESOURCE_KIND)).toBe(false)
  })

  it('is already canonical, so it agrees with what makeCrudRoute reports', () => {
    // `makeCrudRoute` runs its resource through `canonicalizeResourceTag`. A guard registered for
    // the canonical tag has to hit this route too, which requires the constant to be a fixed
    // point of that function.
    expect(canonicalizeResourceTag(SCORE_RESOURCE_KIND)).toBe(SCORE_RESOURCE_KIND)
  })

  it('carries no separator the matcher cannot parse', () => {
    // `matchesEntity` only ever splits on '.', so ':' / '_' / '/' are dead ends.
    expect(SCORE_RESOURCE_KIND).toMatch(/^[a-z0-9]+(\.[a-z0-9]+)+$/)
  })

  it('uses the noun this module already uses for the record in its event ids', () => {
    // `judging.score.submitted` etc. — one vocabulary for the entity, not two.
    const ids = judgingEvents.events.map((e) => e.id)
    expect(ids).toContain(`${SCORE_RESOURCE_KIND}.submitted`)
  })
})
