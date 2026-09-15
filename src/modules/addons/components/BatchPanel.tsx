'use client'
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { EnumBadge } from '@open-mercato/ui/backend/ValueIcons'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { Button } from '@open-mercato/ui/primitives/button'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { detailSchema, batchSchema, mayConfirm, toggleSelection, type Result } from './contracts'
import { batchPath, readApi, AddonApiError } from './client'

export function BatchPanel({ id, scope, canSend, userId, onRetry, onChanged, onClose }: { id: string; scope: string; canSend: boolean; userId: string | null; onRetry: (ids: string[], competitionId: string) => void; onChanged: () => void; onClose?: () => void }) {
  const t = useT()
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<string[]>([])
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [uncertain, setUncertain] = React.useState(false)
  const [now, setNow] = React.useState(Date.now())
  const mounted = React.useRef(true)
  const lock = React.useRef(false)
  React.useEffect(() => { mounted.current = true; const timer = setInterval(() => setNow(Date.now()), 1000); return () => { mounted.current = false; clearInterval(timer) } }, [])
  const query = useQuery({ queryKey: ['addons', scope, 'batch', id, page], queryFn: () => readApi(`${batchPath}/${id}?page=${page}&pageSize=25`, detailSchema), retry: false })
  const { runMutation, retryLastMutation } = useGuardedMutation({ contextId: 'addons.batch', blockedMessage: t('addons.error.guard_blocked') })
  const batch = query.data?.batch
  const reload = async () => { const result = await query.refetch(); if (mounted.current && !result.isError) setUncertain(false) }
  const mutate = async (action: 'confirm' | 'cancel') => {
    if (lock.current || !batch || uncertain) return
    lock.current = true; setBusy(true); setError(null)
    try {
      await runMutation({ context: { entityId: 'addons:addon_delivery_batch', recordId: id, retryLastMutation }, mutationPayload: {}, operation: () => readApi(`${batchPath}/${id}/${action}`, batchSchema, {}) })
      if (!mounted.current) return
      await query.refetch(); onChanged()
      if (action === 'confirm') flash(t('addons.simulationComplete'), 'success')
      else onClose?.()
    } catch (cause) {
      if (!mounted.current) return
      setError(cause instanceof AddonApiError ? t(`addons.error.${cause.code}`, t('addons.error.request_failed')) : t('addons.error.lost_response'))
      // A failed response can follow a successful commit. Always read durable evidence first.
      setUncertain(true)
      const current = await query.refetch()
      if (mounted.current && !current.isError) { setUncertain(false); onChanged() }
    } finally { lock.current = false; if (mounted.current) setBusy(false) }
  }
  const columns = React.useMemo<ColumnDef<Result>[]>(() => [
    ...(canSend ? [{ id: 'select', header: t('addons.selectFailures'), cell: ({ row }: { row: { original: Result } }) => row.original.status === 'failed' ? <Checkbox aria-label={t('addons.selectRecipient', { id: row.original.customerUserId })} checked={selected.includes(row.original.customerUserId)} onCheckedChange={() => setSelected((ids) => toggleSelection(ids, row.original.customerUserId))} /> : null }] : []),
    { accessorKey: 'displayName', header: t('addons.name'), cell: ({ row }) => row.original.displayName ?? row.original.customerUserId },
    { accessorKey: 'email', header: t('addons.email'), cell: ({ getValue }) => getValue() ?? '—' },
    { accessorKey: 'role', header: t('addons.role'), cell: ({ row }) => row.original.role ? t(`addons.role.${row.original.role}`) : '—' },
    { accessorKey: 'status', header: t('addons.simulationStatus'), cell: ({ row }) => <EnumBadge value={row.original.status} map={{ [row.original.status]: { label: t(`addons.status.${row.original.status}`), variant: 'outline' } }} /> },
    { accessorKey: 'reasonCode', header: t('addons.reason'), cell: ({ row }) => row.original.reasonCode ? t(`addons.reason.${row.original.reasonCode}`) : '—' },
    { accessorKey: 'attemptNumber', header: t('addons.attempt'), cell: ({ getValue }) => getValue() ?? '—' },
  ], [canSend, selected, t])
  if (query.isPending) return <LoadingMessage />
  if (!batch) return <ErrorMessage label={t('addons.error.request_failed')} />
  const confirmable = mayConfirm(batch, userId, canSend, now)
  return <div className="space-y-4">
    <p>{t('addons.snapshotCount', { count: batch.recipientCount })}</p>
    <p>{t(`addons.status.${batch.status}`)} · {t('addons.expiresAt', { date: new Date(batch.expiresAt).toLocaleString() })}</p>
    {batch.status !== 'draft' && <p>{t('addons.counts', { succeeded: batch.succeededCount, failed: batch.failedCount, skipped: batch.skippedCount })}</p>}
    {batch.recipientCount > 0 && batch.skippedCount === batch.recipientCount && <p>{t('addons.allSkipped')}</p>}
    {batch.status === 'draft' && !confirmable && batch.createdBy === userId && new Date(batch.expiresAt).getTime() <= now && <ErrorMessage label={t('addons.error.preview_expired')} />}
    {error && <ErrorMessage label={error} />}
    {query.isError && <ErrorMessage label={t('addons.error.request_failed')} />}
    {uncertain && <Button type="button" onClick={() => void reload()} disabled={busy}>{t('addons.reloadStatus')}</Button>}
    <DataTable entityId="addons:addon_delivery_attempt" extensionTableId="addons.batch-recipients" columns={columns} data={query.data?.items ?? []} pagination={{ page, pageSize: 25, total: query.data?.totalCount ?? 0, totalPages: Math.ceil((query.data?.totalCount ?? 0) / 25), onPageChange: setPage }} />
    {confirmable && <CrudForm fields={[]} embedded readOnly={busy || uncertain} submitLabel={t('addons.confirm')} onSubmit={() => mutate('confirm')} />}
    {canSend && batch.createdBy === userId && batch.status === 'draft' && <Button type="button" variant="outline" disabled={busy || uncertain} onClick={() => void mutate('cancel')}>{t('addons.cancelDraft')}</Button>}
    {canSend && selected.length > 0 && batch.status !== 'draft' && <Button type="button" disabled={busy} onClick={() => onRetry(selected, batch.competitionId)}>{t('addons.retrySelected', { count: selected.length })}</Button>}
  </div>
}
