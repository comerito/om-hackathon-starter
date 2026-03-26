"use client"
import { CsvImportDialog, type PreviewColumnDef } from './csv/CsvImportDialog'
import { type CsvColumnDef, normalizeDate } from './csv/parseCSV'

const VALID_TYPES = ['ceremony', 'talk', 'workshop', 'break', 'meal', 'deadline', 'demo_session', 'custom']

type AgendaRow = {
  title: string
  type: string
  starts_at: string
  ends_at: string
  description?: string
  location?: string
  speaker_name?: string
  speaker_bio?: string
  is_mandatory: boolean | string
  order: number | string
}

const columns: CsvColumnDef[] = [
  { key: 'title', csvHeaders: ['title', 'name'], required: true },
  { key: 'type', csvHeaders: ['type', 'event_type'], required: true, defaultValue: 'custom' },
  { key: 'starts_at', csvHeaders: ['starts_at', 'start', 'start_time', 'start_date'], required: true, transform: normalizeDate },
  { key: 'ends_at', csvHeaders: ['ends_at', 'end', 'end_time', 'end_date'], required: true, transform: normalizeDate },
  { key: 'description', csvHeaders: ['description', 'desc'], required: false },
  { key: 'location', csvHeaders: ['location', 'venue', 'room'], required: false },
  { key: 'speaker_name', csvHeaders: ['speaker_name', 'speaker'], required: false },
  { key: 'speaker_bio', csvHeaders: ['speaker_bio'], required: false },
  { key: 'is_mandatory', csvHeaders: ['is_mandatory', 'mandatory', 'required'], required: false, defaultValue: false },
  { key: 'order', csvHeaders: ['order', 'sort_order', 'position'], required: false, defaultValue: 0 },
]

const previewColumns: PreviewColumnDef<AgendaRow>[] = [
  { key: 'title', header: 'Title' },
  {
    key: 'type', header: 'Type',
    render: (v) => {
      const val = String(v ?? 'custom').toLowerCase()
      return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${VALID_TYPES.includes(val) ? 'bg-primary/10 text-primary' : 'bg-portal-danger/10 text-portal-danger'}`}>{val}</span>
    },
  },
  {
    key: 'starts_at', header: 'Start',
    render: (v) => { try { return new Date(v as string).toLocaleString() } catch { return String(v) } },
  },
  {
    key: 'ends_at', header: 'End',
    render: (v) => { try { return new Date(v as string).toLocaleString() } catch { return String(v) } },
  },
  { key: 'location', header: 'Location' },
]

function validateRow(row: AgendaRow, idx: number): string | null {
  if (!row.title) return `Row ${idx + 1}: Title is required`
  const type = String(row.type ?? 'custom').toLowerCase()
  if (!VALID_TYPES.includes(type)) return `Row ${idx + 1}: Invalid type "${row.type}" (must be ${VALID_TYPES.join(', ')})`
  if (!row.starts_at || isNaN(new Date(row.starts_at).getTime())) return `Row ${idx + 1}: Invalid start date "${row.starts_at}"`
  if (!row.ends_at || isNaN(new Date(row.ends_at).getTime())) return `Row ${idx + 1}: Invalid end date "${row.ends_at}"`
  if (new Date(row.ends_at) <= new Date(row.starts_at)) return `Row ${idx + 1}: End date must be after start date`
  return null
}

const TEMPLATE_CSV = `title,type,starts_at,ends_at,description,location,speaker_name,is_mandatory,order
Opening Ceremony,ceremony,2026-04-01T09:00:00Z,2026-04-01T09:30:00Z,Welcome and kickoff,Main Hall,,true,1
Keynote Talk,talk,2026-04-01T09:30:00Z,2026-04-01T10:15:00Z,Industry insights,Main Hall,Dr. Jane Smith,false,2
Coffee Break,break,2026-04-01T10:15:00Z,2026-04-01T10:45:00Z,,Lobby,,false,3`

export function BulkImportAgendaDialog({ onClose }: { onClose: () => void }) {
  return (
    <CsvImportDialog<AgendaRow>
      title="Import Agenda Items"
      onClose={onClose}
      columns={columns}
      previewColumns={previewColumns}
      validateRow={validateRow}
      apiEndpoint="/api/competitions/admin/bulk-import-agenda"
      maxRows={200}
      templateCsv={TEMPLATE_CSV}
      templateFilename="agenda-items-template.csv"
      entityLabel="agenda items"
    />
  )
}
