"use client"
import { useQuery } from '@tanstack/react-query'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { useCompetitionScope } from '@/lib/competition-scope'

type CompetitionOption = { value: string; label: string }

/**
 * Seed options for a `competition_id` combobox prefilled from the global scope.
 *
 * The combobox deliberately leaves its visible input blank for a preselected
 * value it cannot label — it refuses to freeze a raw UUID into the box — so a
 * scoped competition looks empty without this. `seedOptions` supplies the label
 * up front; `resolveLabel` is the wrong hook here because the combobox re-runs
 * it on every render of an unresolved value, which loops network requests.
 */
export function useScopedCompetitionSeedOptions(): CompetitionOption[] | undefined {
  const { competitionId } = useCompetitionScope()
  const { data } = useQuery({
    queryKey: ['competition-seed-option', competitionId],
    queryFn: async () => {
      if (!competitionId) return null
      const res = await fetchCrudList<{ id: string; name: string }>('competitions/competitions', {
        id: competitionId,
        pageSize: '1',
      })
      const found = res?.items?.[0]
      return found ? { value: found.id, label: found.name } : null
    },
    enabled: Boolean(competitionId),
    staleTime: 60_000,
  })
  return data ? [data] : undefined
}
