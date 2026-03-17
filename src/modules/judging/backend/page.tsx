'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { EnumBadge } from '@open-mercato/ui/backend/ValueIcons'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useSearchParams, useRouter } from 'next/navigation'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

type Tab = 'panels' | 'criteria' | 'progress' | 'demos'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PanelRow = {
  id: string
  competition_id: string
  name: string
  round: string
  created_at: string
}

type CriterionRow = {
  id: string
  competition_id: string
  track_id: string | null
  round: string
  name: string
  description: string | null
  max_score: number
  weight: number
  order: number
  created_at: string
}

type ProgressSummary = {
  totalProjects: number
  totalJudges: number
  totalExpectedScores: number
  totalCompletedScores: number
  progressPercent: number
}

const ROUND_SEVERITY: Record<string, 'info' | 'warning' | 'success' | 'neutral'> = {
  PRELIMINARY: 'info',
  FINAL: 'warning',
  BOTH: 'neutral',
}

// ---------------------------------------------------------------------------
// Panel columns
// ---------------------------------------------------------------------------

function buildPanelColumns(t: (key: string, fallback?: string) => string): ColumnDef<PanelRow>[] {
  return [
    { accessorKey: 'name', header: t('judging.panels.column.name', 'Name'), meta: { priority: 1 } },
    {
      accessorKey: 'round',
      header: t('judging.panels.column.round', 'Round'),
      meta: { priority: 2 },
      cell: ({ getValue }) => <EnumBadge value={getValue() as string} map={ROUND_SEVERITY} />,
    },
    {
      accessorKey: 'created_at',
      header: t('judging.panels.column.createdAt', 'Created'),
      meta: { priority: 3 },
      cell: ({ getValue }) => {
        try { return new Date(getValue() as string).toLocaleDateString() } catch { return String(getValue()) }
      },
    },
  ]
}

// ---------------------------------------------------------------------------
// Criterion columns
// ---------------------------------------------------------------------------

function buildCriterionColumns(t: (key: string, fallback?: string) => string): ColumnDef<CriterionRow>[] {
  return [
    { accessorKey: 'name', header: t('judging.criteria.column.name', 'Name'), meta: { priority: 1 } },
    {
      accessorKey: 'round',
      header: t('judging.criteria.column.round', 'Round'),
      meta: { priority: 2 },
      cell: ({ getValue }) => <EnumBadge value={getValue() as string} map={ROUND_SEVERITY} />,
    },
    { accessorKey: 'max_score', header: t('judging.criteria.column.maxScore', 'Max'), meta: { priority: 3 } },
    {
      accessorKey: 'weight',
      header: t('judging.criteria.column.weight', 'Weight'),
      meta: { priority: 4 },
      cell: ({ getValue }) => `${((getValue() as number) * 100).toFixed(0)}%`,
    },
    { accessorKey: 'order', header: t('judging.criteria.column.order', 'Order'), meta: { priority: 5 } },
  ]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function JudgingPage() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const searchParams = useSearchParams()
  const competitionId = searchParams.get('competitionId') ?? ''
  const scopeVersion = useOrganizationScopeVersion()

  const [activeTab, setActiveTab] = React.useState<Tab>('panels')
  const [panelSorting, setPanelSorting] = React.useState<SortingState>([{ id: 'name', desc: false }])
  const [criterionSorting, setCriterionSorting] = React.useState<SortingState>([{ id: 'order', desc: false }])
  const [panelPage, setPanelPage] = React.useState(1)
  const [criterionPage, setCriterionPage] = React.useState(1)

  // Panels query
  const panelQueryParams = React.useMemo(() => {
    const p = new URLSearchParams({
      page: panelPage.toString(),
      pageSize: '50',
      sortField: panelSorting[0]?.id || 'name',
      sortDir: panelSorting[0]?.desc ? 'desc' : 'asc',
    })
    if (competitionId) p.set('competitionId', competitionId)
    return p.toString()
  }, [panelPage, panelSorting, competitionId])

  const { data: panelData, isLoading: panelsLoading } = useQuery({
    queryKey: ['judging-panels', panelQueryParams, scopeVersion],
    queryFn: () => fetchCrudList<PanelRow>('judging/panels', Object.fromEntries(new URLSearchParams(panelQueryParams))),
    enabled: activeTab === 'panels',
  })

  // Criteria query
  const criterionQueryParams = React.useMemo(() => {
    const p = new URLSearchParams({
      page: criterionPage.toString(),
      pageSize: '50',
      sortField: criterionSorting[0]?.id || 'order',
      sortDir: criterionSorting[0]?.desc ? 'desc' : 'asc',
    })
    if (competitionId) p.set('competitionId', competitionId)
    return p.toString()
  }, [criterionPage, criterionSorting, competitionId])

  const { data: criterionData, isLoading: criteriaLoading } = useQuery({
    queryKey: ['judging-criteria', criterionQueryParams, scopeVersion],
    queryFn: () => fetchCrudList<CriterionRow>('judging/criteria', Object.fromEntries(new URLSearchParams(criterionQueryParams))),
    enabled: activeTab === 'criteria',
  })

  // Progress query
  const { data: progressData, isLoading: progressLoading } = useQuery<{ summary: ProgressSummary }>({
    queryKey: ['judging-progress', competitionId, scopeVersion],
    queryFn: async () => {
      const params = competitionId ? `?competitionId=${competitionId}` : ''
      return apiCall(`/api/judging/scores/progress${params}`)
    },
    enabled: activeTab === 'progress' && !!competitionId,
  })

  const panelColumns = React.useMemo(() => buildPanelColumns(t), [t])
  const criterionColumns = React.useMemo(() => buildCriterionColumns(t), [t])

  const handleDeletePanel = async (id: string) => {
    const confirmed = await confirm({
      title: t('judging.panels.confirm.delete', 'Delete this panel?'),
      variant: 'destructive',
    })
    if (!confirmed) return
    try {
      await deleteCrud('judging/panels', id)
      flash(t('judging.panels.flash.deleted', 'Panel deleted'), 'success')
      queryClient.invalidateQueries({ queryKey: ['judging-panels'] })
    } catch (err) {
      flash(err instanceof Error ? err.message : t('judging.panels.error.delete', 'Failed to delete panel'), 'error')
    }
  }

  const handleDeleteCriterion = async (id: string) => {
    const confirmed = await confirm({
      title: t('judging.criteria.confirm.delete', 'Delete this criterion?'),
      variant: 'destructive',
    })
    if (!confirmed) return
    try {
      await deleteCrud('judging/criteria', id)
      flash(t('judging.criteria.flash.deleted', 'Criterion deleted'), 'success')
      queryClient.invalidateQueries({ queryKey: ['judging-criteria'] })
    } catch (err) {
      flash(err instanceof Error ? err.message : t('judging.criteria.error.delete', 'Failed to delete criterion'), 'error')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('judging.title', 'Demos & Judging')}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['panels', 'criteria', 'progress', 'demos'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'panels' && t('judging.tab.panels', 'Panels')}
            {tab === 'criteria' && t('judging.tab.criteria', 'Criteria')}
            {tab === 'progress' && t('judging.tab.progress', 'Scoring Progress')}
            {tab === 'demos' && t('judging.tab.demos', 'Demos')}
          </button>
        ))}
      </div>

      {/* Panels Tab */}
      {activeTab === 'panels' && (
        <DataTable
          title={t('judging.panels.title', 'Judge Panels')}
          actions={
            <Button variant="default" disabled>
              {t('judging.panels.actions.create', 'Add panel')}
            </Button>
          }
          columns={panelColumns}
          data={panelData?.items ?? []}
          sortable
          sorting={panelSorting}
          onSortingChange={(s) => { setPanelSorting(s); setPanelPage(1) }}
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  label: t('judging.panels.actions.delete', 'Delete'),
                  destructive: true,
                  onSelect: () => handleDeletePanel(row.id),
                },
              ]}
            />
          )}
          pagination={{
            page: panelPage,
            pageSize: 50,
            total: panelData?.total || 0,
            totalPages: panelData?.totalPages || 0,
            onPageChange: setPanelPage,
          }}
          isLoading={panelsLoading}
        />
      )}

      {/* Criteria Tab */}
      {activeTab === 'criteria' && (
        <DataTable
          title={t('judging.criteria.title', 'Judging Criteria')}
          actions={
            <Button variant="default" disabled>
              {t('judging.criteria.actions.create', 'Add criterion')}
            </Button>
          }
          columns={criterionColumns}
          data={criterionData?.items ?? []}
          sortable
          sorting={criterionSorting}
          onSortingChange={(s) => { setCriterionSorting(s); setCriterionPage(1) }}
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  label: t('judging.criteria.actions.delete', 'Delete'),
                  destructive: true,
                  onSelect: () => handleDeleteCriterion(row.id),
                },
              ]}
            />
          )}
          pagination={{
            page: criterionPage,
            pageSize: 50,
            total: criterionData?.total || 0,
            totalPages: criterionData?.totalPages || 0,
            onPageChange: setCriterionPage,
          }}
          isLoading={criteriaLoading}
        />
      )}

      {/* Scoring Progress Tab */}
      {activeTab === 'progress' && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">{t('judging.progress.title', 'Scoring Progress')}</h2>
          {!competitionId ? (
            <p className="text-muted-foreground">{t('judging.progress.noCompetition', 'Select a competition to view scoring progress.')}</p>
          ) : progressLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
            </div>
          ) : progressData?.summary ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">Projects</p>
                  <p className="text-2xl font-bold">{progressData.summary.totalProjects}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">Judges</p>
                  <p className="text-2xl font-bold">{progressData.summary.totalJudges}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">Scores</p>
                  <p className="text-2xl font-bold">{progressData.summary.totalCompletedScores} / {progressData.summary.totalExpectedScores}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">Progress</p>
                  <p className="text-2xl font-bold">{progressData.summary.progressPercent}%</p>
                </div>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progressData.summary.progressPercent}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">{t('judging.progress.noData', 'No scoring data available yet.')}</p>
          )}
        </div>
      )}

      {/* Demos Tab */}
      {activeTab === 'demos' && (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t('judging.demos.title', 'Demo Sessions')}</h2>
            <Button
              variant="default"
              onClick={() => router.push(`/backend/judging/demos${competitionId ? `?competitionId=${competitionId}` : ''}`)}
            >
              {t('judging.demos.actions.manage', 'Manage demos')}
            </Button>
          </div>
          <p className="text-muted-foreground">
            {t('judging.demos.description', 'Use the demo management page for queue control, timer, and status updates.')}
          </p>
        </div>
      )}

      {ConfirmDialogElement}
    </div>
  )
}
