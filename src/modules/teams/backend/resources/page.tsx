"use client"
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { EnumBadge } from '@open-mercato/ui/backend/ValueIcons'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type ResourceRow = {
  id: string
  team_id: string
  name: string
  type: string
  url: string | null
  added_by: string
  created_at: string
}

type ListResponse = {
  items: ResourceRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const typePreset: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  file: { label: 'File', variant: 'secondary' },
  link: { label: 'Link', variant: 'default' },
  repository: { label: 'Repository', variant: 'outline' },
}

export default function ResourcesListPage() {
  const t = useT()
  const router = useRouter()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'created_at', desc: true }])
  const [page, setPage] = React.useState(1)
  const [searchValue, setSearchValue] = React.useState('')
  const scopeVersion = useOrganizationScopeVersion()

  const queryParams = React.useMemo(() => {
    const params: Record<string, string> = {
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'created_at',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    }
    return new URLSearchParams(params).toString()
  }, [page, sorting])

  const { data, isLoading, error } = useQuery<ListResponse>({
    queryKey: ['teams-resources', queryParams, scopeVersion],
    queryFn: () => fetchCrudList<ResourceRow>('teams/resources', Object.fromEntries(new URLSearchParams(queryParams))),
  })

  const columns = React.useMemo<ColumnDef<ResourceRow>[]>(() => [
    {
      accessorKey: 'name',
      header: t('teams.resources.table.name', 'Name'),
      meta: { priority: 1 },
    },
    {
      accessorKey: 'type',
      header: t('teams.resources.table.type', 'Type'),
      meta: { priority: 2 },
      cell: ({ getValue }) => {
        const val = String(getValue())
        return <EnumBadge value={val} map={typePreset} />
      },
    },
    {
      accessorKey: 'url',
      header: t('teams.resources.table.url', 'URL'),
      meta: { priority: 3 },
      cell: ({ getValue }) => {
        const val = getValue() as string | null
        if (!val) return '\u2014'
        const truncated = val.length > 40 ? val.substring(0, 40) + '...' : val
        return (
          <a href={val} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {truncated}
          </a>
        )
      },
    },
    {
      accessorKey: 'team_id',
      header: t('teams.resources.table.team', 'Team'),
      meta: { priority: 4 },
      cell: ({ getValue }) => {
        const val = getValue() as string
        return val ? val.substring(0, 8) + '...' : '\u2014'
      },
    },
    {
      accessorKey: 'created_at',
      header: t('teams.resources.table.createdAt', 'Created At'),
      meta: { priority: 5 },
      cell: ({ getValue }) => {
        const v = getValue()
        return v ? new Date(v as string).toLocaleDateString() : '\u2014'
      },
    },
  ], [t])

  if (error) {
    return (
      <Page>
        <PageBody>
          <div className="text-sm text-destructive">{t('teams.resources.table.error', 'Failed to load resources')}</div>
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('teams.resources.table.title', 'Resources')}
          actions={
            <Button asChild>
              <Link href="/backend/teams/resources/create">{t('teams.resources.table.create', 'New Resource')}</Link>
            </Button>
          }
          columns={columns}
          data={data?.items ?? []}
          searchValue={searchValue}
          onSearchChange={(v) => { setSearchValue(v); setPage(1) }}
          searchAlign="right"
          sortable
          sorting={sorting}
          onSortingChange={(s) => { setSorting(s); setPage(1) }}
          rowActions={(row) => (
            <RowActions
              items={[
                { label: t('teams.resources.table.edit', 'Edit'), href: `/backend/teams/resources/${row.id}/edit` },
              ]}
            />
          )}
          pagination={{
            page,
            pageSize: 50,
            total: data?.total || 0,
            totalPages: data?.totalPages || 0,
            onPageChange: setPage,
          }}
          isLoading={isLoading}
          onRowClick={(row) => router.push(`/backend/teams/resources/${row.id}/edit`)}
        />
      </PageBody>
    </Page>
  )
}
