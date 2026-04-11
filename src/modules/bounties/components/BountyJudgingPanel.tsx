"use client"

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { EnumBadge } from '@open-mercato/ui/backend/ValueIcons'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { apiCallOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useAppEvent } from '@open-mercato/ui/backend/injection/useAppEvent'
import Link from 'next/link'
import BountyDetailPanel from './BountyDetailPanel'
import BountyActivityFeed from './BountyActivityFeed'

type BountyPRRow = {
  id: string
  github_pr_number: number
  github_pr_url: string
  title: string
  github_author: string
  status: string
  classifications: Array<{ category: string; points: number; reasoning: string }> | null
  classification_confidence: number | null
  classification_summary: string | null
  total_points: number
  points_override: Array<{ category: string; points: number; reasoning: string }> | null
  is_duplicate: boolean
  duplicate_marked_by: string | null
  github_created_at: string
  created_at: string
  split_group_id?: string | null
  is_split_child?: boolean
  _participant?: { name: string | null; github_username: string | null }
  _team?: { name: string | null }
}

type CompetitionOption = {
  id: string
  name: string
  stage?: string | null
}

const statusPreset: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  detected: { label: 'Detected', variant: 'secondary' },
  classified: { label: 'Classified', variant: 'outline' },
  pending_review: { label: 'Pending Review', variant: 'default' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  duplicate: { label: 'Duplicate', variant: 'secondary' },
}

const STATUS_TABS = ['all', 'pending_review', 'classified', 'approved', 'rejected', 'duplicate'] as const

export default function BountyJudgingPanel() {
  const t = useT()
  const queryClient = useQueryClient()
  const scopeVersion = useOrganizationScopeVersion()
  const [page, setPage] = React.useState(1)
  const [statusFilter, setStatusFilter] = React.useState<string>('all')
  const [competitionFilter, setCompetitionFilter] = React.useState<string>('all')
  const [selectedPRId, setSelectedPRId] = React.useState<string | null>(null)

  // Real-time updates
  useAppEvent('bounties.*', () => {
    queryClient.invalidateQueries({ queryKey: ['bounty-prs'] })
    queryClient.invalidateQueries({ queryKey: ['bounty-activity'] })
  }, [queryClient])

  const { data: competitions, isLoading: competitionsLoading } = useQuery({
    queryKey: ['bounty-competitions', scopeVersion],
    queryFn: async () => {
      const res = await fetchCrudList<CompetitionOption>('competitions/competitions', {
        pageSize: '100',
        sortField: 'created_at',
        sortDir: 'desc',
      })
      return res?.items ?? []
    },
  })

  React.useEffect(() => {
    if (!competitions || competitions.length === 0) return
    const stored = window.localStorage.getItem('bounties:selected-competition')
    if (stored && competitions.some((competition) => competition.id === stored)) {
      setCompetitionFilter(stored)
      return
    }
    setCompetitionFilter((current) => (
      current !== 'all' && competitions.some((competition) => competition.id === current)
        ? current
        : 'all'
    ))
    window.localStorage.removeItem('bounties:selected-competition')
  }, [competitions])

  const queryParams = React.useMemo(() => {
    const params: Record<string, string> = {
      page: page.toString(),
      pageSize: '50',
      sortField: 'created_at',
      sortDir: 'desc',
    }
    if (statusFilter !== 'all') params.status = statusFilter
    if (competitionFilter !== 'all') params.competition_id = competitionFilter
    return params
  }, [competitionFilter, page, statusFilter])

  const { data, isLoading } = useQuery({
    queryKey: ['bounty-prs', queryParams, scopeVersion],
    queryFn: () => fetchCrudList<BountyPRRow>('bounties/prs', queryParams),
  })

  React.useEffect(() => {
    if (!data?.items?.some(pr => pr.id === selectedPRId)) {
      setSelectedPRId(null)
    }
  }, [data, selectedPRId])

  const selectedPR = React.useMemo(
    () => data?.items?.find(pr => pr.id === selectedPRId) ?? null,
    [data, selectedPRId]
  )

  const handleApprove = React.useCallback(async (id: string) => {
    try {
      await apiCallOrThrow(`/api/bounties/prs/${id}/approve`, { method: 'PATCH', body: '{}' })
      flash(t('bounties.flash.approved', 'PR approved'), 'success')
      queryClient.invalidateQueries({ queryKey: ['bounty-prs'] })
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to approve', 'error')
    }
  }, [t, queryClient])

  const handleReject = React.useCallback(async (id: string) => {
    try {
      await apiCallOrThrow(`/api/bounties/prs/${id}/reject`, { method: 'PATCH', body: '{}' })
      flash(t('bounties.flash.rejected', 'PR rejected'), 'success')
      queryClient.invalidateQueries({ queryKey: ['bounty-prs'] })
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to reject', 'error')
    }
  }, [t, queryClient])

  const columns = React.useMemo<ColumnDef<BountyPRRow>[]>(() => [
    {
      accessorKey: 'github_pr_number',
      header: '#',
      meta: { priority: 1 },
      cell: ({ row }) => (
        <a href={row.original.github_pr_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          #{row.original.github_pr_number}
        </a>
      ),
    },
    {
      accessorKey: 'title',
      header: t('bounties.table.title', 'Title'),
      meta: { priority: 1 },
      cell: ({ getValue }) => {
        const title = String(getValue())
        return title.length > 60 ? title.substring(0, 60) + '...' : title
      },
    },
    {
      accessorKey: 'github_author',
      header: t('bounties.table.author', 'Author'),
      meta: { priority: 1 },
      cell: ({ row }) => (
        <span>@{row.original.github_author}{row.original._team?.name ? ` (${row.original._team.name})` : ''}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('bounties.table.status', 'Status'),
      meta: { priority: 1 },
      cell: ({ getValue }) => <EnumBadge value={String(getValue())} map={statusPreset} />,
    },
    {
      accessorKey: 'classification_confidence',
      header: t('bounties.table.confidence', 'Conf.'),
      meta: { priority: 2 },
      cell: ({ getValue }) => {
        const conf = getValue() as number | null
        if (conf == null) return '-'
        const pct = Math.round(conf * 100)
        const color = conf < 0.7 ? 'text-amber-600 font-semibold' : 'text-green-600'
        return <span className={color}>{pct}%</span>
      },
    },
    {
      accessorKey: 'total_points',
      header: t('bounties.table.points', 'Points'),
      meta: { priority: 1 },
      cell: ({ row, getValue }) => (
        <span className="font-semibold inline-flex items-center gap-1">
          {Number(getValue())}
          {row.original.is_split_child && <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-1 rounded" title="Split child — points awarded to primary PR">SPLIT</span>}
        </span>
      ),
    },
  ], [t])

  return (
    <div className="flex flex-col gap-4">
      {/* Page nav */}
      <div className="flex items-center gap-3 text-sm">
        <Link href="/backend/bounties-leaderboard" className="text-muted-foreground hover:text-foreground transition-colors">
          {t('bounties.nav.leaderboard', 'Leaderboard')}
        </Link>
        <span className="text-muted-foreground">|</span>
        <Link href="/backend/bounties-settings" className="text-muted-foreground hover:text-foreground transition-colors">
          {t('bounties.nav.settings', 'Settings')}
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={competitionFilter}
          onChange={(e) => {
            const next = e.target.value
            setCompetitionFilter(next)
            setPage(1)
            window.localStorage.setItem('bounties:selected-competition', next)
          }}
          className="h-9 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
          disabled={competitionsLoading}
        >
          <option value="all">{t('bounties.filter.allCompetitions', 'All competitions')}</option>
          {(competitions ?? []).map((competition) => (
            <option key={competition.id} value={competition.id}>
              {competition.name}
            </option>
          ))}
        </select>
        {STATUS_TABS.map(tab => (
          <Button
            key={tab}
            variant={statusFilter === tab ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setStatusFilter(tab); setPage(1) }}
          >
            {tab === 'all' ? t('bounties.filter.all', 'All') : statusPreset[tab]?.label ?? tab}
          </Button>
        ))}
      </div>

      {/* Main layout: table + detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <DataTable
            title={t('bounties.table.tableTitle', 'Bounty PRs')}
            columns={columns}
            data={data?.items ?? []}
            isLoading={isLoading}
            rowActions={(row) => (
              <RowActions items={[
                ...(row.status === 'pending_review' || row.status === 'classified'
                  ? [
                      { id: 'approve', label: t('bounties.actions.approve', 'Approve'), onSelect: () => handleApprove(row.id) },
                      { id: 'reject', label: t('bounties.actions.reject', 'Reject'), destructive: true as const, onSelect: () => handleReject(row.id) },
                    ]
                  : []
                ),
                ...(row.status === 'rejected'
                  ? [{ id: 'approve', label: t('bounties.actions.approve', 'Approve'), onSelect: () => handleApprove(row.id) }]
                  : []
                ),
              ]} />
            )}
            pagination={{
              page,
              pageSize: 50,
              total: data?.total || 0,
              totalPages: data?.totalPages || 0,
              onPageChange: setPage,
            }}
            onRowClick={(row) => setSelectedPRId(row.id)}
          />
        </div>

        <div>
          {selectedPR ? (
            <BountyDetailPanel pr={selectedPR} onAction={() => queryClient.invalidateQueries({ queryKey: ['bounty-prs'] })} />
          ) : (
            <div className="rounded-lg border p-8 text-center text-muted-foreground">
              {t('bounties.detail.selectPR', 'Select a PR from the list to view details')}
            </div>
          )}
        </div>
      </div>

      {/* Activity feed */}
      <BountyActivityFeed competitionId={competitionFilter !== 'all' ? competitionFilter : null} />
    </div>
  )
}
