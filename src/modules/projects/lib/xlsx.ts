import { PassThrough } from 'stream'
import archiver from 'archiver'

/**
 * Minimal, dependency-free Office Open XML (.xlsx) writer built on `archiver` (already a
 * dependency for the attachments ZIP). Supports what a data export needs: one or more sheets,
 * a bold frozen header row with an autofilter, column widths, and string / number / boolean /
 * date cells. Strings are written inline, so no shared-string table is needed.
 */

export type XlsxCellValue = string | number | boolean | Date | null | undefined

export type XlsxColumn = {
  header: string
  /** Width in Excel character units. */
  width?: number
}

export type XlsxSheet = {
  name: string
  columns: XlsxColumn[]
  rows: XlsxCellValue[][]
}

/** Excel refuses cells longer than this. */
export const XLSX_MAX_CELL_LENGTH = 32767
const EXCEL_EPOCH_OFFSET_DAYS = 25569 // days between 1899-12-30 and 1970-01-01
const MS_PER_DAY = 86_400_000

// Style indexes into cellXfs below.
const STYLE_DEFAULT = 0
const STYLE_HEADER = 1
const STYLE_DATETIME = 2

/** XML 1.0 forbids most C0 control characters; strip them before escaping. */
// eslint-disable-next-line no-control-regex
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g

export function escapeXml(value: string): string {
  return value
    .replace(INVALID_XML_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 0 → A, 25 → Z, 26 → AA. */
export function columnLetter(index: number): string {
  let n = index + 1
  let letters = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    letters = String.fromCharCode(65 + rem) + letters
    n = Math.floor((n - 1) / 26)
  }
  return letters
}

/**
 * Excel stores dates as serial day numbers with no time zone. The caller passes the wall-clock
 * time it wants displayed, encoded as a UTC Date (see `toWallClock`).
 */
export function toExcelSerial(date: Date): number {
  return date.getTime() / MS_PER_DAY + EXCEL_EPOCH_OFFSET_DAYS
}

/**
 * Shift an instant to the wall-clock time of `timeZone`, returned as a Date whose UTC fields hold
 * that wall-clock time. Falls back to UTC for an unknown zone.
 */
export function toWallClock(date: Date, timeZone: string | null | undefined): Date {
  if (!timeZone) return date
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(date)
  } catch {
    return date
  }
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')))
}

/** Excel sheet names: max 31 chars, none of []:*?/\ and unique within the workbook. */
export function sanitizeSheetName(name: string, used: Set<string>): string {
  const base = (name.replace(/[[\]:*?/\\]/g, ' ').trim() || 'Sheet').slice(0, 31)
  let candidate = base
  let counter = 2
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${counter++})`
    candidate = base.slice(0, 31 - suffix.length) + suffix
  }
  used.add(candidate.toLowerCase())
  return candidate
}

function renderCell(ref: string, value: XlsxCellValue, style: number): string {
  if (value === null || value === undefined || value === '') return ''
  const styleAttr = style === STYLE_DEFAULT ? '' : ` s="${style}"`
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return `<c r="${ref}" s="${STYLE_DATETIME}"><v>${toExcelSerial(value)}</v></c>`
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return ''
    return `<c r="${ref}"${styleAttr}><v>${value}</v></c>`
  }
  if (typeof value === 'boolean') {
    return `<c r="${ref}"${styleAttr} t="b"><v>${value ? 1 : 0}</v></c>`
  }
  const text = value.length > XLSX_MAX_CELL_LENGTH ? value.slice(0, XLSX_MAX_CELL_LENGTH) : value
  return `<c r="${ref}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`
}

export function renderSheetXml(sheet: XlsxSheet): string {
  const columnCount = Math.max(sheet.columns.length, 1)
  const lastColumn = columnLetter(columnCount - 1)
  const lastRow = sheet.rows.length + 1

  const cols = sheet.columns
    .map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width ?? 18}" customWidth="1"/>`)
    .join('')

  const header = `<row r="1">${sheet.columns
    .map((column, index) => renderCell(`${columnLetter(index)}1`, column.header, STYLE_HEADER))
    .join('')}</row>`

  const body = sheet.rows
    .map((row, rowIndex) => {
      const r = rowIndex + 2
      const cells = row.map((value, colIndex) => renderCell(`${columnLetter(colIndex)}${r}`, value, STYLE_DEFAULT)).join('')
      return `<row r="${r}">${cells}</row>`
    })
    .join('')

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<dimension ref="A1:${lastColumn}${lastRow}"/>` +
    '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '</sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    (cols ? `<cols>${cols}</cols>` : '') +
    `<sheetData>${header}${body}</sheetData>` +
    `<autoFilter ref="A1:${lastColumn}${lastRow}"/>` +
    '</worksheet>'
  )
}

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/></numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="3">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>'

export async function buildXlsx(sheets: XlsxSheet[]): Promise<Buffer> {
  if (sheets.length === 0) throw new Error('An XLSX workbook needs at least one sheet')
  const usedNames = new Set<string>()
  const names = sheets.map((sheet) => sanitizeSheetName(sheet.name, usedNames))

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('') +
    '</Types>'

  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>'

  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets>${names.map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>` +
    '<definedNames>' +
    sheets
      .map((sheet, i) => {
        const lastColumn = columnLetter(Math.max(sheet.columns.length, 1) - 1)
        const quoted = `'${names[i].replace(/'/g, "''")}'`
        return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${escapeXml(quoted)}!$A$1:$${lastColumn}$${sheet.rows.length + 1}</definedName>`
      })
      .join('') +
    '</definedNames>' +
    '</workbook>'

  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join('') +
    `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    '</Relationships>'

  const archive = archiver('zip', { zlib: { level: 6 } })
  const output = new PassThrough()
  const chunks: Buffer[] = []
  const done = new Promise<Buffer>((resolve, reject) => {
    output.on('data', (chunk: Buffer) => chunks.push(chunk))
    output.on('end', () => resolve(Buffer.concat(chunks)))
    output.on('error', reject)
    archive.on('error', reject)
    archive.on('warning', reject)
  })
  archive.pipe(output)

  archive.append(contentTypes, { name: '[Content_Types].xml' })
  archive.append(rootRels, { name: '_rels/.rels' })
  archive.append(workbook, { name: 'xl/workbook.xml' })
  archive.append(workbookRels, { name: 'xl/_rels/workbook.xml.rels' })
  archive.append(STYLES_XML, { name: 'xl/styles.xml' })
  sheets.forEach((sheet, i) => {
    archive.append(renderSheetXml(sheet), { name: `xl/worksheets/sheet${i + 1}.xml` })
  })
  await archive.finalize()
  return done
}
