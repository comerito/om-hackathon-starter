"use client"

import { useQuery } from '@tanstack/react-query'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

export type BountyTrackMappings = Record<string, string>

type PortalBountyConfigResponse = {
  ok: boolean
  mappings: BountyTrackMappings
}

/** Shared across the portal so the config is fetched once per session. */
export const PORTAL_BOUNTY_CONFIG_QUERY_KEY = ['portal-bounty-config']

/** Competition → bounty track mappings configured in backend → Bounty Settings. */
export function usePortalBountyMappings() {
  return useQuery<PortalBountyConfigResponse>({
    queryKey: PORTAL_BOUNTY_CONFIG_QUERY_KEY,
    queryFn: async () => {
      const { ok, result } = await apiCall<PortalBountyConfigResponse>('/api/bounties/portal/config')
      return ok && result ? result : { ok: false, mappings: {} }
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Bounty hunting only exists for competitions that have a bounty track assigned.
 * Callers must treat `isLoading` as "not available yet" so nav items and pages
 * never flash before the mapping is known.
 */
export function usePortalBountyTrack(competitionId: string | null | undefined): {
  trackId: string | null
  hasBountyTrack: boolean
  isLoading: boolean
} {
  const { data, isLoading } = usePortalBountyMappings()
  const trackId = competitionId ? data?.mappings?.[competitionId] ?? null : null
  return { trackId, hasBountyTrack: !!trackId, isLoading }
}
