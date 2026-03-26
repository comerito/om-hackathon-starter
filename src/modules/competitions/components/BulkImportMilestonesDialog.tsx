"use client"
import { CsvImportDialog, type PreviewColumnDef } from './csv/CsvImportDialog'
import { type CsvColumnDef, normalizeDate } from './csv/parseCSV'

const VALID_STATUSES = ['upcoming', 'active', 'completed']

type MilestoneRow = {
  name: string
  due_date: string
  description?: string
  status: string
  sort_order: number | string
}

const columns: CsvColumnDef[] = [
  { key: 'name', csvHeaders: ['name', 'title', 'milestone'], required: true },
  { key: 'due_date', csvHeaders: ['due_date', 'due', 'deadline', 'date'], required: true, transform: normalizeDate },
  { key: 'description', csvHeaders: ['description', 'desc'], required: false },
  { key: 'status', csvHeaders: ['status'], required: false, defaultValue: 'upcoming' },
  { key: 'sort_order', csvHeaders: ['sort_order', 'order', 'position'], required: false, defaultValue: 0 },
]

const previewColumns: PreviewColumnDef<MilestoneRow>[] = [
  { key: 'name', header: 'Name' },
  {
    key: 'due_date', header: 'Due Date',
    render: (v) => { try { return new Date(v as string).toLocaleString() } catch { return String(v) } },
  },
  {
    key: 'status', header: 'Status',
    render: (v) => {
      const val = String(v ?? 'upcoming').toLowerCase()
      return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${VALID_STATUSES.includes(val) ? 'bg-primary/10 text-primary' : 'bg-portal-danger/10 text-portal-danger'}`}>{val}</span>
    },
  },
]

function validateRow(row: MilestoneRow, idx: number): string | null {
  if (!row.name) return `Row ${idx + 1}: Name is required`
  if (!row.due_date || isNaN(new Date(row.due_date).getTime())) return `Row ${idx + 1}: Invalid due date "${row.due_date}"`
  const status = String(row.status ?? 'upcoming').toLowerCase()
  if (!VALID_STATUSES.includes(status)) return `Row ${idx + 1}: Invalid status "${row.status}" (must be ${VALID_STATUSES.join(', ')})`
  return null
}

const TEMPLATE_CSV = `name,due_date,description,status,sort_order
Registration Opens,2026-03-15T09:00:00Z,Open registration for all participants,completed,1
Team Formation Deadline,2026-03-28T23:59:00Z,All teams must be formed,upcoming,2
Project Submission,2026-04-01T18:00:00Z,Submit your project for judging,upcoming,3`

export function BulkImportMilestonesDialog({ onClose }: { onClose: () => void }) {
  return (
    <CsvImportDialog<MilestoneRow>
      title="Import Milestones"
      onClose={onClose}
      columns={columns}
      previewColumns={previewColumns}
      validateRow={validateRow}
      apiEndpoint="/api/competitions/admin/bulk-import-milestones"
      maxRows={100}
      templateCsv={TEMPLATE_CSV}
      templateFilename="milestones-template.csv"
      entityLabel="milestones"
    />
  )
}
