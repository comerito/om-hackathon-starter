import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { JudgePanelJudge, JudgePanelTrack } from '../../judging/data/entities'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'

const BOUNTY_TRACK_MAPPINGS_KEY = 'bounty_track_mappings'

type PortalAuth = {
  sub: string
  tenantId: string
  orgId: string
}

/**
 * Verify that a portal-authenticated user is a judge on a panel
 * assigned to the bounty track for at least one competition.
 * Returns the set of bounty track IDs they judge, or null if not a bounty judge.
 */
export async function verifyBountyJudge(
  em: EntityManager,
  auth: PortalAuth,
  configService: ModuleConfigService,
): Promise<{ bountyTrackIds: string[]; panelIds: string[] } | null> {
  // 1. Get bounty track mappings (competition_id -> track_id)
  const mappings = await configService.getValue<Record<string, string>>(
    'bounties',
    BOUNTY_TRACK_MAPPINGS_KEY,
    { defaultValue: {} },
  )
  if (!mappings || Object.keys(mappings).length === 0) return null

  const bountyTrackIds = Object.values(mappings)

  // 2. Find judge panels this user is on
  const panelJudges = await em.find(JudgePanelJudge, {
    judgeId: auth.sub,
    tenantId: auth.tenantId,
    organizationId: auth.orgId,
  } as FilterQuery<JudgePanelJudge>)

  if (panelJudges.length === 0) return null

  const panelIds = panelJudges.map(pj => pj.panelId)

  // 3. Check if any of their panels are assigned to a bounty track
  const panelTracks = await em.find(JudgePanelTrack, {
    panelId: { $in: panelIds },
    trackId: { $in: bountyTrackIds },
  } as FilterQuery<JudgePanelTrack>)

  if (panelTracks.length === 0) return null

  const matchedTrackIds = [...new Set(panelTracks.map(pt => pt.trackId))]
  const matchedPanelIds = [...new Set(panelTracks.map(pt => pt.panelId))]

  return { bountyTrackIds: matchedTrackIds, panelIds: matchedPanelIds }
}
