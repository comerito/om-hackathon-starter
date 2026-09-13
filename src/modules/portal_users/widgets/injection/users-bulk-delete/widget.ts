import type { InjectionBulkActionWidget } from '@open-mercato/shared/modules/widgets/injection'
import { apiCall, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'

/** Shape of the rows rendered by the core customer_accounts users table. */
type CustomerUserRow = {
  id?: unknown
  email?: unknown
  displayName?: unknown
  updatedAt?: unknown
}

type ConfirmOptions = {
  title?: string
  description?: string
  confirmText?: string
  variant?: 'default' | 'destructive'
}

type BulkActionContext = {
  confirm?: (options?: ConfirmOptions) => Promise<boolean>
  refresh?: () => void
  translate?: (key: string, fallback?: string, params?: Record<string, string | number>) => string
}

function identity(key: string, fallback?: string): string {
  return fallback ?? key
}

function readRow(row: unknown): { id: string; label: string; updatedAt: string | null } | null {
  const record = row as CustomerUserRow | null
  const id = typeof record?.id === 'string' ? record.id : null
  if (!id) return null
  const displayName = typeof record?.displayName === 'string' ? record.displayName : ''
  const email = typeof record?.email === 'string' ? record.email : ''
  const updatedAt = typeof record?.updatedAt === 'string' ? record.updatedAt : null
  return { id, label: displayName || email || id, updatedAt }
}

async function deleteUser(id: string, updatedAt: string | null): Promise<string | null> {
  const call = await withScopedApiRequestHeaders(
    buildOptimisticLockHeader(updatedAt),
    () => apiCall<{ ok?: boolean; error?: string }>(
      `/api/customer_accounts/admin/users/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  )
  if (call.ok) return null
  const error = call.result?.error
  return typeof error === 'string' && error.trim().length > 0 ? error : `HTTP ${call.status}`
}

/**
 * The core users page reloads its rows from client state, so it exposes no
 * refresh callback to injected widgets. Reload through the URL instead and let
 * FlashMessages pick the result up from the query string after the navigation.
 */
function reloadWithFlash(message: string, kind: 'success' | 'error'): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.set('flash', message)
  url.searchParams.set('type', kind)
  window.location.href = url.toString()
}

const widget: InjectionBulkActionWidget = {
  metadata: {
    id: 'portal_users.injection.users-bulk-delete',
    title: 'Delete selected portal users',
    description: 'Bulk-deletes the selected customer portal users.',
    features: ['customer_accounts.manage'],
    priority: 30,
  },
  bulkActions: [
    {
      id: 'portal_users.bulk.delete-users',
      label: 'portal_users.bulk.delete.label',
      icon: 'Trash2',
      onExecute: async (selectedRows, context) => {
        const ctx = (context ?? {}) as BulkActionContext
        const t = ctx.translate ?? identity
        const rows = selectedRows.map(readRow).filter((row): row is NonNullable<ReturnType<typeof readRow>> => row !== null)

        if (rows.length === 0) {
          return { ok: false, message: t('portal_users.bulk.delete.noSelection', 'No users selected.') }
        }

        const confirmed = await ctx.confirm?.({
          title: t('portal_users.bulk.delete.confirmTitle', 'Delete {count} users?', { count: rows.length }),
          description: t(
            'portal_users.bulk.delete.confirmDescription',
            'Their portal access is revoked immediately. This cannot be undone from here.',
          ),
          variant: 'destructive',
        })
        if (confirmed !== true) return { ok: false }

        const failures: string[] = []
        for (const row of rows) {
          // Sequential on purpose: the endpoint revokes sessions and emits an
          // event per user, and an admin list is small enough that a burst of
          // parallel deletes buys nothing.
          const error = await deleteUser(row.id, row.updatedAt)
          if (error) failures.push(`${row.label}: ${error}`)
        }

        const deleted = rows.length - failures.length
        if (failures.length === 0) {
          reloadWithFlash(
            t('portal_users.bulk.delete.success', '{count} users deleted', { count: deleted }),
            'success',
          )
          // Silences the table's own flash — the reload above carries the message.
          return { ok: false }
        }

        if (deleted > 0) {
          reloadWithFlash(
            t('portal_users.bulk.delete.partial', 'Deleted {count} of {total} users. Failed: {errors}', {
              count: deleted,
              total: rows.length,
              errors: failures.join('; '),
            }),
            'error',
          )
          return { ok: false }
        }

        return {
          ok: false,
          message: t('portal_users.bulk.delete.failed', 'Could not delete the selected users. {errors}', {
            errors: failures.join('; '),
          }),
        }
      },
    },
  ],
}

export default widget
