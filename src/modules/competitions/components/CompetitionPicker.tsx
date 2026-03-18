"use client"
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

type CompetitionOption = {
  id: string
  name: string
  stage: string
}

type CompetitionPickerProps = {
  value: string
  label?: string
}

export function CompetitionPicker({ value, label = 'Competition' }: CompetitionPickerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const scopeVersion = useOrganizationScopeVersion()

  const { data } = useQuery<{ items: CompetitionOption[] }>({
    queryKey: ['competitions-picker', scopeVersion],
    queryFn: () => fetchCrudList<CompetitionOption>('competitions/competitions', { pageSize: '100', sortField: 'name', sortDir: 'asc' }),
  })

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) {
      params.set('competitionId', e.target.value)
    } else {
      params.delete('competitionId')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">{label}:</label>
      <select
        value={value}
        onChange={handleChange}
        className="rounded-md border bg-background px-3 py-1.5 text-sm min-w-[200px]"
      >
        <option value="">Select competition...</option>
        {data?.items?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  )
}
