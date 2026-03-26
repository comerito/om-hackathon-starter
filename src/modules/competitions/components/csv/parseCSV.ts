export type CsvColumnDef = {
  key: string
  csvHeaders: string[]
  required: boolean
  defaultValue?: unknown
  transform?: (value: string) => unknown
}

export type CsvParseResult<T> = {
  rows: T[]
  errors: string[]
}

/**
 * Generic CSV parser with configurable column definitions.
 * Handles quoted fields, flexible header matching, and type transforms.
 */
export function parseCSV<T extends Record<string, unknown>>(
  text: string,
  columns: CsvColumnDef[],
): CsvParseResult<T> {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return { rows: [], errors: ['CSV must have a header row and at least one data row.'] }

  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))

  // Map CSV header indices to column keys
  const colMap: Array<{ colDef: CsvColumnDef; idx: number } | null> = columns.map(col => {
    const idx = header.findIndex(h => col.csvHeaders.includes(h))
    return idx >= 0 ? { colDef: col, idx } : null
  })

  // Check required columns are present
  const errors: string[] = []
  for (const col of columns) {
    if (col.required && !colMap.find(m => m?.colDef.key === col.key)) {
      errors.push(`Missing required column: "${col.csvHeaders[0]}" (accepted headers: ${col.csvHeaders.join(', ')})`)
    }
  }
  if (errors.length > 0) return { rows: [], errors }

  const rows: T[] = []
  for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx].trim()
    if (!line) continue

    const values = parseCsvLine(line)
    const row: Record<string, unknown> = {}

    for (const mapping of colMap) {
      if (!mapping) continue
      const { colDef, idx } = mapping
      const raw = (values[idx] ?? '').trim()

      if (raw === '' && colDef.defaultValue !== undefined) {
        row[colDef.key] = colDef.defaultValue
      } else if (raw === '' && !colDef.required) {
        row[colDef.key] = undefined
      } else if (colDef.transform) {
        row[colDef.key] = colDef.transform(raw)
      } else {
        row[colDef.key] = raw
      }
    }

    // Fill in defaults for columns not in CSV
    for (const col of columns) {
      if (!(col.key in row) && col.defaultValue !== undefined) {
        row[col.key] = col.defaultValue
      }
    }

    rows.push(row as T)
  }

  return { rows, errors: [] }
}

/** Parse a single CSV line, handling quoted fields with commas and escaped quotes. */
function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue }
    current += ch
  }
  values.push(current.trim())

  return values
}

/** Try to normalize a date string to ISO 8601. Returns the original string if parsing fails. */
export function normalizeDate(value: string): string {
  if (!value) return value
  try {
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d.toISOString()
  } catch { /* return as-is */ }
  return value
}
