import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

// `customer_accounts.admin.users` is the tableId the core users page passes to
// its DataTable; the table enables row selection as soon as a bulk action is
// injected here.
export const injectionTable: ModuleInjectionTable = {
  'data-table:customer_accounts.admin.users:bulk-actions': [
    { widgetId: 'portal_users.injection.users-bulk-delete', priority: 30 },
  ],
}

export default injectionTable
