"use client"
import { useQuery } from '@tanstack/react-query'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'

export type CompetitionOption = {
  id: string
  name: string
  stage: string
  starts_at?: string
  location?: string | null
}

/**
 * Competitions available in the current organization scope, newest event first.
 * Shared by the header scope picker and by pages that still render their own
 * competition column, so they all resolve names from one cached query.
 */
export function useCompetitionOptions() {
  const scopeVersion = useOrganizationScopeVersion()
  return useQuery({
    queryKey: ['competition-scope-options', scopeVersion],
    queryFn: async () => {
      const res = await fetchCrudList<CompetitionOption>('competitions/competitions', {
        pageSize: '100',
        sortField: 'starts_at',
        sortDir: 'desc',
      })
      return res?.items ?? []
    },
    staleTime: 60_000,
  })
}
