import { inflateRawSync } from 'zlib'
import {
  buildXlsx,
  columnLetter,
  escapeXml,
  renderSheetXml,
  sanitizeSheetName,
  toExcelSerial,
  toWallClock,
  XLSX_MAX_CELL_LENGTH,
} from '../xlsx'

/** Read a ZIP's entries via its local file headers (enough for archiver's output). */
function unzip(buffer: Buffer): Map<string, string> {
  const entries = new Map<string, string>()
  // Central directory gives reliable sizes even when local headers use data descriptors.
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  const count = buffer.readUInt16LE(eocd + 10)
  let offset = buffer.readUInt32LE(eocd + 16)
  for (let i = 0; i < count; i++) {
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const data = buffer.subarray(dataStart, dataStart + compressedSize)
    entries.set(name, (method === 8 ? inflateRawSync(data) : data).toString('utf8'))
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

describe('xlsx helpers', () => {
  it('maps column indexes to letters', () => {
    expect(columnLetter(0)).toBe('A')
    expect(columnLetter(25)).toBe('Z')
    expect(columnLetter(26)).toBe('AA')
    expect(columnLetter(27)).toBe('AB')
    expect(columnLetter(701)).toBe('ZZ')
    expect(columnLetter(702)).toBe('AAA')
  })

  it('escapes XML and strips characters XML 1.0 forbids', () => {
    expect(escapeXml('a < b & "c" > d')).toBe('a &lt; b &amp; &quot;c&quot; &gt; d')
    expect(escapeXml('bell\u0007 tab\t nl\n')).toBe('bell tab\t nl\n')
  })

  it('converts dates to Excel serial numbers', () => {
    expect(toExcelSerial(new Date(Date.UTC(1970, 0, 1)))).toBe(25569)
    expect(toExcelSerial(new Date(Date.UTC(2026, 8, 20, 12, 0)))).toBeCloseTo(46285.5, 6)
  })

  it('shifts instants to the wall clock of a time zone', () => {
    const instant = new Date('2026-09-20T09:06:00Z')
    expect(toWallClock(instant, 'Europe/Warsaw').toISOString()).toBe('2026-09-20T11:06:00.000Z')
    expect(toWallClock(instant, null).toISOString()).toBe('2026-09-20T09:06:00.000Z')
    expect(toWallClock(instant, 'Not/AZone').toISOString()).toBe('2026-09-20T09:06:00.000Z')
  })

  it('sanitizes and de-duplicates sheet names', () => {
    const used = new Set<string>()
    expect(sanitizeSheetName('Projects: 2026/09', used)).toBe('Projects  2026 09')
    expect(sanitizeSheetName('x'.repeat(40), used)).toHaveLength(31)
    expect(sanitizeSheetName('Projects  2026 09', used)).toBe('Projects  2026 09 (2)')
  })

  it('renders typed cells, a frozen header and an autofilter', () => {
    const xml = renderSheetXml({
      name: 'Projects',
      columns: [{ header: 'Title' }, { header: 'Score', width: 10 }, { header: 'Flag' }, { header: 'At' }],
      rows: [
        ['Aurora & co', 8.5, true, new Date(Date.UTC(1970, 0, 2))],
        [null, undefined, false, 'x'.repeat(XLSX_MAX_CELL_LENGTH + 10)],
      ],
    })
    expect(xml).toContain('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Title</t></is></c>')
    expect(xml).toContain('<t xml:space="preserve">Aurora &amp; co</t>')
    expect(xml).toContain('<c r="B2"><v>8.5</v></c>')
    expect(xml).toContain('<c r="C2" t="b"><v>1</v></c>')
    expect(xml).toContain('<c r="D2" s="2"><v>25570</v></c>')
    expect(xml).toContain('<c r="C3" t="b"><v>0</v></c>')
    expect(xml).not.toContain('r="A3"')
    expect(xml).toContain('state="frozen"')
    expect(xml).toContain('<autoFilter ref="A1:D3"/>')
    expect(xml).toContain('<col min="2" max="2" width="10" customWidth="1"/>')
    const longCell = xml.match(/<c r="D3"[^>]*><is><t xml:space="preserve">(x+)<\/t>/)
    expect(longCell?.[1]).toHaveLength(XLSX_MAX_CELL_LENGTH)
  })

  it('packages a valid workbook', async () => {
    const buffer = await buildXlsx([{ name: 'Projects', columns: [{ header: 'Title' }], rows: [['Zażółć gęślą jaźń']] }])
    expect(buffer.subarray(0, 2).toString()).toBe('PK')
    const entries = unzip(buffer)
    expect([...entries.keys()].sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ])
    expect(entries.get('xl/workbook.xml')).toContain('<sheet name="Projects" sheetId="1" r:id="rId1"/>')
    expect(entries.get('xl/worksheets/sheet1.xml')).toContain('Zażółć gęślą jaźń')
    expect(entries.get('[Content_Types].xml')).toContain('/xl/worksheets/sheet1.xml')
  })

  it('refuses an empty workbook', async () => {
    await expect(buildXlsx([])).rejects.toThrow('at least one sheet')
  })
})
