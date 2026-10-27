import writeXlsxFile from 'write-excel-file/browser'
import { noteOptions, symptomOptions } from '../data/mockData'
import { getLocalDateKey } from '../lib/dateUtils'
import { getServiceHistory } from './studentRepository'

const itemLabels = new Map([...symptomOptions, ...noteOptions].map((item) => [item.id, item.label]))

type ExportRecord = {
  sequence: number
  date: string
  time: string
  studentId: string
  name: string
  surname: string
  sex: string
  className: string
  academicYear: string
  symptoms: string
  notes: string
  selectedItems: string[]
}

function getSelectedItemCode(selectedItem: string): string {
  const separatorIndex = selectedItem.indexOf(':')
  return separatorIndex < 0 ? selectedItem : selectedItem.slice(0, separatorIndex)
}

function hasSelectedItem(record: ExportRecord, itemCode: string): boolean {
  return record.selectedItems.some((selectedItem) => getSelectedItemCode(selectedItem) === itemCode)
}

async function getExportRecords(dateFrom: string, dateTo: string): Promise<ExportRecord[]> {
  return (await getServiceHistory())
    .filter((record) => {
      const date = getLocalDateKey(new Date(record.service_datetime))
      return (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo)
    })
    .sort((first, second) => first.service_datetime.localeCompare(second.service_datetime))
    .map((record, index) => {
      const student = record.student
      const symptoms = record.selected_items
        .filter((item) => symptomOptions.some((option) => option.id === item))
        .map((item) => itemLabels.get(item) ?? item)
      const notes = record.selected_items
        .filter((item) => noteOptions.some((option) => option.id === getSelectedItemCode(item)))
        .map((item) => {
          const itemCode = getSelectedItemCode(item)
          const separatorIndex = item.indexOf(':')
          const detail = separatorIndex < 0 ? '' : item.slice(separatorIndex + 1).trim()
          return itemCode === 'other' && detail ? detail : itemLabels.get(itemCode) ?? itemCode
        })

      return {
        sequence: index + 1,
        date: getLocalDateKey(new Date(record.service_datetime)),
        time: new Date(record.service_datetime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        studentId: record.student_id,
        name: student?.name ?? '',
        surname: student?.surname ?? '',
        sex: student?.sex ?? '',
        className: student?.class_name ?? '',
        academicYear: student?.academic_year ?? '',
        symptoms: symptoms.join(', '),
        notes: notes.join(', '),
        selectedItems: record.selected_items,
      }
    })
}

export async function getHistoryRecordCount(dateFrom: string, dateTo: string): Promise<number> {
  return (await getExportRecords(dateFrom, dateTo)).length
}

export type ExportAvailability = {
  firstServiceDate: string | null
  lastServiceDate: string | null
  academicYears: string[]
}

export async function getExportAvailability(): Promise<ExportAvailability> {
  const records = await getServiceHistory()
  const serviceDates = records
    .map((record) => getLocalDateKey(new Date(record.service_datetime)))
    .sort()
  const academicYears = [...new Set(records.flatMap((record) => record.student?.academic_year ?? []))]
    .sort((first, second) => second.localeCompare(first))

  return {
    firstServiceDate: serviceDates[0] ?? null,
    lastServiceDate: serviceDates.at(-1) ?? null,
    academicYears,
  }
}

export async function downloadStudentTemplate(academicYear: string): Promise<void> {
  const rows: Array<Array<string | null>> = [
    [`ตารางรายชื่อนักเรียนปี ${academicYear}`, null, null, null, null, null],
    [null, null, null, null, null, null],
    ['Number', 'Student_ID', 'Sex', 'Name', 'Surname', 'Class'],
    ['ตัวอย่าง (ลบก่อนนำเข้า)', '30001', 'ชาย', 'ชื่อจริง', 'นามสกุล', 'ม.1/4'],
    ['ตัวอย่าง (ลบก่อนนำเข้า)', '30002', 'หญิง', 'ชื่อจริง', 'นามสกุล', '1/7'],
    ['ตัวอย่าง (ลบก่อนนำเข้า)', '30003', 'ชาย', 'ชื่อจริง', 'นามสกุล', 'ม.1/SMTE'],
  ]
  await writeXlsxFile(rows, { sheet: 'Students' }).toFile('student-import-template.xlsx')
}

type CellStyle = {
  align?: 'left' | 'center' | 'right'
  alignVertical?: 'top' | 'center' | 'bottom'
  backgroundColor?: string
  borderColor?: string
  borderStyle?: 'thin' | 'medium'
  columnSpan?: number
  rowSpan?: number
  fontSize?: number
  fontWeight?: 'bold'
  format?: string
  height?: number
  textColor?: string
  textRotation?: number
  wrap?: boolean
}

const historySymptoms = symptomOptions
const historyNotes = noteOptions
const gridColor = '#64748B'
const symptomLabels = [
  'ปวดหัว/เป็นไข้', 'ปวดรอบเดือน', 'ปวดท้องกระเพาะ', 'ปวดท้องอืดเฟ้อ', 'ท้องเสีย',
  'คลื่นไส้อาเจียน', 'น้ำมูก/แพ้อากาศ', 'แก้ไอมีเสมหะ', 'แพ้ผื่นคัน', 'ปวดนวด/ประคบ',
  'ล้างตา/ตาแดง', 'แมลงกัดต่อย', 'ทำแผล',
]
const reportSymptoms = symptomOptions.map((option, index) => ({ ...option, reportLabel: symptomLabels[index] }))
const monthLabels = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const termOneMonths = [5, 6, 7, 8, 9, 10]
const termTwoMonths = [11, 12, 1, 2, 3]
const termOneNoteIds = ['rest', 'accident', 'go_home', 'send_hospital', 'return_class']
const termTwoNoteIds = ['rest', 'accident', 'go_home', 'other', 'send_hospital', 'return_class']

function reportCell(value: string | number, style: CellStyle = {}) {
  return {
    value,
    borderColor: gridColor,
    borderStyle: 'thin' as const,
    alignVertical: 'center' as const,
    ...style,
  }
}

function getHistoryTotals(records: ExportRecord[]) {
  return {
    male: records.filter((record) => record.sex === 'ชาย').length,
    female: records.filter((record) => record.sex === 'หญิง').length,
    itemCounts: [...historySymptoms, ...historyNotes].map((item) =>
      records.filter((record) => hasSelectedItem(record, item.id)).length,
    ),
  }
}

function getHistoryPeriod(records: ExportRecord[], dateFrom: string, dateTo: string): string {
  const firstDate = dateFrom || records[0]?.date || ''
  const lastDate = dateTo || records[records.length - 1]?.date || firstDate
  const academicYear = records[0]?.academicYear || (firstDate ? String(Number(firstDate.slice(0, 4)) + 543) : '2569')

  if (firstDate && lastDate && firstDate.slice(0, 7) === lastDate.slice(0, 7)) {
    const month = Number(firstDate.slice(5, 7))
    const semester = termOneMonths.includes(month) ? '1' : termTwoMonths.includes(month) ? '2' : '-'
    return `เดือน ${monthLabels[month - 1]} ภาคเรียนที่ ${semester} ปีการศึกษา ${academicYear}`
  }

  return `ช่วงวันที่ ${dateFrom || 'ทั้งหมด'} ถึง ${dateTo || 'ทั้งหมด'} ปีการศึกษา ${academicYear}`
}

function buildHistorySheet(records: ExportRecord[], period: string) {
  const titleStyle: CellStyle = { align: 'center', fontSize: 16, fontWeight: 'bold', height: 28 }
  const headerStyle: CellStyle = { backgroundColor: '#D9E2F3', align: 'center', fontWeight: 'bold', wrap: true }
  const summaryStyle: CellStyle = { backgroundColor: '#93C47D', align: 'center', fontWeight: 'bold' }
  const noteStart = 9 + historySymptoms.length
  const columnCount = noteStart + historyNotes.length
  const headers = new Array(columnCount).fill(null) as Array<ReturnType<typeof reportCell> | null>

  headers[0] = reportCell('ลำดับ', { ...headerStyle, rowSpan: 2 })
  headers[1] = reportCell('วันที่', { ...headerStyle, rowSpan: 2 })
  headers[2] = reportCell('เวลา', { ...headerStyle, rowSpan: 2 })
  headers[3] = reportCell('Student_ID', { ...headerStyle, rowSpan: 2 })
  headers[4] = reportCell('ชื่อ', { ...headerStyle, rowSpan: 2 })
  headers[5] = reportCell('นามสกุล', { ...headerStyle, rowSpan: 2 })
  headers[6] = reportCell('เพศ', { ...headerStyle, columnSpan: 2 })
  headers[8] = reportCell('ชั้น', { ...headerStyle, rowSpan: 2 })
  headers[9] = reportCell('อาการ', { ...headerStyle, columnSpan: historySymptoms.length })
  headers[noteStart] = reportCell('หมายเหตุ', { ...headerStyle, columnSpan: historyNotes.length })

  const subHeaders = new Array(columnCount).fill(null) as Array<ReturnType<typeof reportCell> | null>
  subHeaders[6] = reportCell('ชาย', headerStyle)
  subHeaders[7] = reportCell('หญิง', headerStyle)
  historySymptoms.forEach((item, index) => { subHeaders[9 + index] = reportCell(item.label, headerStyle) })
  historyNotes.forEach((item, index) => { subHeaders[noteStart + index] = reportCell(item.label, headerStyle) })

  const dataRows = records.map((record, index) => {
    const row = new Array(columnCount).fill('') as string[]
    row[0] = String(index + 1)
    row[1] = record.date
    row[2] = record.time
    row[3] = record.studentId
    row[4] = record.name
    row[5] = record.surname
    row[6] = record.sex === 'ชาย' ? '✔' : ''
    row[7] = record.sex === 'หญิง' ? '✔' : ''
    row[8] = record.className
    historySymptoms.forEach((item, itemIndex) => {
      row[9 + itemIndex] = hasSelectedItem(record, item.id) ? '✔' : ''
    })
    historyNotes.forEach((item, itemIndex) => {
      row[noteStart + itemIndex] = hasSelectedItem(record, item.id) ? '✔' : ''
    })
    return row.map((value, column) => reportCell(value, {
      align: column >= 9 ? 'center' : column === 4 || column === 5 ? 'left' : 'center',
    }))
  })

  const totals = getHistoryTotals(records)
  const totalRow = new Array(columnCount).fill(null) as Array<ReturnType<typeof reportCell> | null>
  totalRow[0] = reportCell('รวม', { ...summaryStyle, columnSpan: 6 })
  totalRow[6] = reportCell(totals.male, summaryStyle)
  totalRow[7] = reportCell(totals.female, summaryStyle)
  totalRow[8] = reportCell('', summaryStyle)
  totals.itemCounts.forEach((count, index) => {
    totalRow[9 + index] = reportCell(count, summaryStyle)
  })

  return [
    [reportCell('แบบบันทึกสถิติการใช้บริการเรือนพยาบาล โรงเรียนตะพานหิน', { ...titleStyle, columnSpan: columnCount })],
    [reportCell(period, { align: 'center', columnSpan: columnCount })],
    headers,
    subHeaders,
    ...dataRows,
    totalRow,
  ]
}

export async function downloadHistoryExampleWorkbook(dateFrom: string, dateTo: string): Promise<void> {
  const blob = await createHistoryExampleWorkbook(dateFrom, dateTo)
  downloadBlob(blob, 'ประวัติบริการ.xlsx')
}

export async function createHistoryExampleWorkbook(dateFrom: string, dateTo: string): Promise<Blob> {
  const records = await getExportRecords(dateFrom, dateTo)
  const widths = [6, 12, 8, 13, 16, 16, 6, 6, 9, ...Array(historySymptoms.length + historyNotes.length).fill(5)]
  return writeXlsxFile(buildHistorySheet(records, getHistoryPeriod(records, dateFrom, dateTo)), {
    sheet: 'ประวัติบริการ',
    orientation: 'landscape',
    columns: widths.map((width) => ({ width })),
  }).toBlob()
}

function historyHtmlTable(records: ExportRecord[]): string {
  const symptomHeaders = historySymptoms.map((item) => `<th class="vertical">${escapeHtml(item.label)}</th>`).join('')
  const noteHeaders = historyNotes.map((item) => `<th class="vertical">${escapeHtml(item.label)}</th>`).join('')
  const rows = records.map((record, index) => `<tr>
    <td>${index + 1}</td><td>${escapeHtml(record.date)}</td><td>${escapeHtml(record.time)}</td>
    <td>${escapeHtml(record.studentId)}</td><td>${escapeHtml(record.name)}</td><td>${escapeHtml(record.surname)}</td>
    <td>${record.sex === 'ชาย' ? '✔' : ''}</td><td>${record.sex === 'หญิง' ? '✔' : ''}</td><td>${escapeHtml(record.className)}</td>
    ${historySymptoms.map((item) => `<td>${hasSelectedItem(record, item.id) ? '✔' : ''}</td>`).join('')}
    ${historyNotes.map((item) => `<td>${hasSelectedItem(record, item.id) ? '✔' : ''}</td>`).join('')}
  </tr>`).join('')
  const totals = getHistoryTotals(records)
  const totalRow = `<tr class="total-row"><td colspan="6">รวม</td><td>${totals.male}</td><td>${totals.female}</td><td></td>
    ${totals.itemCounts.map((count) => `<td>${count}</td>`).join('')}</tr>`

  return `<table class="history-table"><thead>
    <tr><th rowspan="2">ลำดับ</th><th rowspan="2">วันที่</th><th rowspan="2">เวลา</th><th rowspan="2">Student_ID</th>
    <th rowspan="2">ชื่อ</th><th rowspan="2">นามสกุล</th><th colspan="2">เพศ</th><th rowspan="2">ชั้น</th>
    <th colspan="${historySymptoms.length}">อาการ</th><th colspan="${historyNotes.length}">หมายเหตุ</th></tr>
    <tr><th>ชาย</th><th>หญิง</th>${symptomHeaders}${noteHeaders}</tr>
    </thead><tbody>${rows}</tbody><tfoot>${totalRow}</tfoot></table>`
}

export async function printHistoryExamplePdf(dateFrom: string, dateTo: string): Promise<void> {
  const printWindow = openPrintWindow()
  if (!printWindow) throw new Error('กรุณาอนุญาตให้เปิดหน้าต่างสำหรับพิมพ์')
  const records = await getExportRecords(dateFrom, dateTo)
  const chunks: ExportRecord[][] = []
  for (let start = 0; start < records.length; start += 10) chunks.push(records.slice(start, start + 10))
  if (chunks.length === 0) chunks.push([])
  const period = getHistoryPeriod(records, dateFrom, dateTo)
  const pages = chunks.map((chunk, index) => `<section class="print-page">
    <h1>แบบบันทึกสถิติการใช้บริการเรือนพยาบาล โรงเรียนตะพานหิน</h1>
    <p>${escapeHtml(period)} · หน้า ${index + 1}/${chunks.length}</p>
    ${historyHtmlTable(chunk)}
  </section>`)

  writePrintDocument(printWindow, 'ประวัติบริการ', pages, `
    @page { size: A3 landscape; margin: 8mm; }
    body { color:#17202a; font-family:Tahoma,"Leelawadee UI",sans-serif; font-size:8px; }
    h1 { text-align:center; font-size:17px; margin:0 0 4px; }
    p { text-align:center; margin:0 0 10px; }
    .print-page { break-after:page; page-break-after:always; }
    .print-page:last-child { break-after:auto; page-break-after:auto; }
    table { border-collapse:collapse; table-layout:fixed; width:100%; }
    th,td { border:1px solid #64748b; padding:3px 2px; text-align:center; vertical-align:middle; }
    th { background:#d9e2f3; font-weight:bold; }
    th.vertical { height:112px; writing-mode:vertical-rl; transform:rotate(180deg); white-space:nowrap; }
    td:nth-child(5),td:nth-child(6) { text-align:left; }
    .total-row td { background:#93c47d; font-weight:bold; }
    @media print { body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } }
  `)
}

export async function createHistoryExamplePdf(dateFrom: string, dateTo: string): Promise<Blob> {
  const records = await getExportRecords(dateFrom, dateTo)
  const chunks: ExportRecord[][] = []
  for (let start = 0; start < records.length; start += 10) chunks.push(records.slice(start, start + 10))
  if (chunks.length === 0) chunks.push([])
  const period = getHistoryPeriod(records, dateFrom, dateTo)
  const pages = chunks.map((chunk, index) => `
    <section class="pdf-page">
      <h1>แบบบันทึกสถิติการใช้บริการเรือนพยาบาล โรงเรียนตะพานหิน</h1>
      <p>${escapeHtml(period)} · หน้า ${index + 1}/${chunks.length}</p>
      ${historyHtmlTable(chunk)}
    </section>`)
  return createPdfBlob(pages, `
    body { color:#17202a; font-family:"Noto Sans Thai",Tahoma,sans-serif; font-size:10px; }
    h1 { text-align:center; font-size:18px; margin:0 0 8px; }
    p { text-align:center; margin:0 0 12px; }
    .pdf-page { width:1500px; background:#fff; padding:20px; }
    table { border-collapse:collapse; table-layout:fixed; width:100%; }
    th,td { border:1px solid #64748b; padding:4px 2px; text-align:center; vertical-align:middle; }
    th { background:#d9e2f3; font-weight:bold; }
    th.vertical { height:120px; writing-mode:vertical-rl; transform:rotate(180deg); white-space:nowrap; }
    td:nth-child(5),td:nth-child(6) { text-align:left; }
    .total-row td { background:#93c47d; font-weight:bold; }
  `)
}

type SemesterMonthlyRow = {
  month: number
  label: string
  male: number
  female: number
  symptoms: number[]
  notes: number[]
}

type SemesterReport = {
  semester: 1 | 2
  months: SemesterMonthlyRow[]
  totals: { male: number; female: number; symptoms: number[]; notes: number[] }
  visitTotal: number
  symptomTotals: Array<{ id: string; label: string; count: number }>
  noteTotals: Array<{ id: string; label: string; count: number }>
}

function getCalendarYearForMonth(academicYear: string, month: number): number {
  const academicStartYear = Number(academicYear) - 543
  return month >= 5 ? academicStartYear : academicStartYear + 1
}

export async function getIllnessStatistics(academicYear: string): Promise<SemesterReport[]> {
  const records = (await getExportRecords('', '')).filter((record) => record.academicYear === academicYear)
  const semesters: Array<{ semester: 1 | 2; months: number[]; noteIds: string[] }> = [
    { semester: 1, months: termOneMonths, noteIds: termOneNoteIds },
    { semester: 2, months: termTwoMonths, noteIds: termTwoNoteIds },
  ]

  return semesters.map(({ semester, months, noteIds }) => {
    const monthly = months.map((month): SemesterMonthlyRow => {
      const calendarYear = getCalendarYearForMonth(academicYear, month)
      const monthRecords = records.filter((record) =>
        Number(record.date.slice(0, 4)) === calendarYear && Number(record.date.slice(5, 7)) === month,
      )

      return {
        month,
        label: monthLabels[month - 1],
        male: monthRecords.filter((record) => record.sex === 'ชาย').length,
        female: monthRecords.filter((record) => record.sex === 'หญิง').length,
        symptoms: reportSymptoms.map((item) => monthRecords.filter((record) => hasSelectedItem(record, item.id)).length),
        notes: noteIds.map((id) => monthRecords.filter((record) => hasSelectedItem(record, id)).length),
      }
    })

    const totals = {
      male: monthly.reduce((sum, row) => sum + row.male, 0),
      female: monthly.reduce((sum, row) => sum + row.female, 0),
      symptoms: reportSymptoms.map((_, index) => monthly.reduce((sum, row) => sum + row.symptoms[index], 0)),
      notes: noteIds.map((_, index) => monthly.reduce((sum, row) => sum + row.notes[index], 0)),
    }

    return {
      semester,
      months: monthly,
      totals,
      visitTotal: totals.male + totals.female,
      symptomTotals: reportSymptoms.map((item, index) => ({
        id: item.id,
        label: item.reportLabel,
        count: totals.symptoms[index],
      })),
      noteTotals: noteIds.map((id, index) => ({
        id,
        label: illnessNoteLabel(id),
        count: totals.notes[index],
      })),
    }
  })
}

const illnessNoteLabel = (id: string): string => id === 'other'
  ? 'อื่นๆ'
  : noteOptions.find((item) => item.id === id)?.label ?? id

function illnessHeaders(noteIds: string[], excel: boolean) {
  const groupStyle: CellStyle = { align: 'center', fontWeight: 'bold', wrap: true, fontSize: 10 }
  const subStyle: CellStyle = { align: 'center', fontWeight: 'bold', wrap: true, fontSize: 9 }
  const header = new Array(23 + (noteIds.length - 4)).fill(null) as Array<ReturnType<typeof reportCell> | null>
  header[0] = reportCell('ที่', { ...groupStyle, backgroundColor: '#D9EAD3', rowSpan: 2 })
  header[1] = reportCell('เดือน', { ...groupStyle, backgroundColor: '#F6B900', rowSpan: 2 })
  header[2] = reportCell('เพศ', { ...groupStyle, backgroundColor: '#D9D2E9', columnSpan: 2 })
  header[4] = reportCell('รวม', { ...groupStyle, backgroundColor: '#F6B900', rowSpan: 2 })
  header[5] = reportCell('อาการเจ็บป่วย/การปฐมพยาบาล', { ...groupStyle, backgroundColor: '#00A6D6', columnSpan: reportSymptoms.length })
  const symptomTotalIndex = 5 + reportSymptoms.length
  header[symptomTotalIndex] = reportCell('รวม', { ...groupStyle, backgroundColor: '#8ED34F', rowSpan: 2 })
  header[symptomTotalIndex + 1] = reportCell('หมายเหตุ', { ...groupStyle, backgroundColor: '#C9DAF8', columnSpan: noteIds.length })

  const sub = new Array(header.length).fill(null) as Array<ReturnType<typeof reportCell> | null>
  sub[2] = reportCell('ช', { ...subStyle, backgroundColor: '#D9D2E9' })
  sub[3] = reportCell('ญ', { ...subStyle, backgroundColor: '#D9D2E9' })
  reportSymptoms.forEach((item, index) => {
    sub[5 + index] = reportCell(item.reportLabel, { ...subStyle, backgroundColor: '#8ED34F' })
  })
  noteIds.forEach((id, index) => {
    sub[symptomTotalIndex + 1 + index] = reportCell(illnessNoteLabel(id), { ...subStyle, backgroundColor: '#C9DAF8' })
  })

  if (!excel) return { header, sub, symptomTotalIndex }
  return { header, sub, symptomTotalIndex }
}

function semesterSheetRows(report: SemesterReport, academicYear: string): Array<Array<ReturnType<typeof reportCell> | null>> {
  const noteIds = report.semester === 1 ? termOneNoteIds : termTwoNoteIds
  const columnCount = 23 + (noteIds.length - 4)
  const { header, sub, symptomTotalIndex } = illnessHeaders(noteIds, true)
  const titleStyle: CellStyle = { align: 'center', fontSize: 15, fontWeight: 'bold', height: 30 }
  const greenStyle: CellStyle = { backgroundColor: '#93D050', align: 'center', fontWeight: 'bold' }
  const percentStyle: CellStyle = { backgroundColor: '#FFFF00', align: 'center', fontWeight: 'bold', format: '0.00' }
  const percentLabelStyle: CellStyle = { backgroundColor: '#FFFF00', align: 'center', fontWeight: 'bold' }
  const rows: Array<Array<ReturnType<typeof reportCell> | null>> = [
    [reportCell(`สรุปสถิติการเจ็บป่วยนักเรียนโรงเรียนตะพานหิน ภาคเรียนที่ ${report.semester} ปีการศึกษา ${academicYear}`, { ...titleStyle, columnSpan: columnCount })],
    new Array(columnCount).fill(null),
    header,
    sub,
  ]

  report.months.forEach((month, index) => {
    const row: Array<ReturnType<typeof reportCell> | null> = [
      reportCell(index + 1, { align: 'center' }),
      reportCell(month.label, { backgroundColor: '#F6B900', align: 'center' }),
      reportCell(month.male, { backgroundColor: '#F6B900', align: 'center' }),
      reportCell(month.female, { backgroundColor: '#F6B900', align: 'center' }),
      reportCell(month.male + month.female, { backgroundColor: '#F6B900', align: 'center' }),
      ...month.symptoms.map((count) => reportCell(count, { backgroundColor: '#FFFFFF', align: 'center' })),
      reportCell(month.symptoms.reduce((sum, count) => sum + count, 0), { backgroundColor: '#B7DDE8', align: 'center' }),
      ...month.notes.map((count) => reportCell(count, { backgroundColor: '#FFFFFF', align: 'center' })),
    ]
    rows.push(row)
  })

  rows.push(new Array(columnCount).fill(null))
  const totalRow = new Array(columnCount).fill(null) as Array<ReturnType<typeof reportCell> | null>
  totalRow[0] = reportCell('รวม', { ...greenStyle, columnSpan: 2 })
  totalRow[2] = reportCell(report.totals.male, greenStyle)
  totalRow[3] = reportCell(report.totals.female, greenStyle)
  totalRow[4] = reportCell(report.visitTotal, greenStyle)
  report.totals.symptoms.forEach((count, index) => { totalRow[5 + index] = reportCell(count, greenStyle) })
  totalRow[symptomTotalIndex] = reportCell(report.totals.symptoms.reduce((sum, count) => sum + count, 0), greenStyle)
  report.totals.notes.forEach((count, index) => { totalRow[symptomTotalIndex + 1 + index] = reportCell(count, greenStyle) })
  rows.push(totalRow)

  const percentRow = new Array(columnCount).fill(null) as Array<ReturnType<typeof reportCell> | null>
  percentRow[0] = reportCell('คิดเป็นร้อยละ', { ...percentLabelStyle, columnSpan: 5 })
  report.totals.symptoms.forEach((count, index) => {
    percentRow[5 + index] = reportCell(report.visitTotal ? (count / report.visitTotal) * 100 : 0, percentStyle)
  })
  report.totals.notes.forEach((count, index) => {
    percentRow[symptomTotalIndex + 1 + index] = reportCell(report.visitTotal ? (count / report.visitTotal) * 100 : 0, percentStyle)
  })
  rows.push(percentRow)

  return rows
}

export async function downloadIllnessStatisticsWorkbook(academicYear: string): Promise<void> {
  const blob = await createIllnessStatisticsWorkbook(academicYear)
  downloadBlob(blob, 'สถิติการเจ็บป่วย.xlsx')
}

export async function createIllnessStatisticsWorkbook(academicYear: string): Promise<Blob> {
  const reports = await getIllnessStatistics(academicYear)
  const sheetRows = reports.flatMap((report) => [...semesterSheetRows(report, academicYear), new Array(24).fill(null)])
  const widths = [
    5, 8, 6, 6, 8,
    ...Array(reportSymptoms.length).fill(8),
    8,
    ...Array(termTwoNoteIds.length).fill(8),
  ]
  return writeXlsxFile(sheetRows, {
    sheet: 'สถิติการเจ็บป่วย',
    orientation: 'landscape',
    columns: widths.map((width) => ({ width })),
  }).toBlob()
}

function illnessTableHtml(report: SemesterReport): string {
  const noteIds = report.semester === 1 ? termOneNoteIds : termTwoNoteIds
  const { header, sub } = illnessHeaders(noteIds, false)
  const headerHtml = (row: Array<ReturnType<typeof reportCell> | null>) => row.map((cell) => {
    if (!cell) return ''
    const span = cell.columnSpan ? ` colspan="${cell.columnSpan}"` : ''
    const rowSpan = cell.rowSpan ? ` rowspan="${cell.rowSpan}"` : ''
    return `<th${span}${rowSpan}>${escapeHtml(cell.value)}</th>`
  }).join('')
  const monthly = report.months.map((month, index) => `<tr>
    <td>${index + 1}</td><td>${month.label}</td><td>${month.male}</td><td>${month.female}</td><td>${month.male + month.female}</td>
    ${month.symptoms.map((count) => `<td>${count}</td>`).join('')}
    <td class="symptom-total">${month.symptoms.reduce((sum, count) => sum + count, 0)}</td>
    ${month.notes.map((count) => `<td>${count}</td>`).join('')}
  </tr>`).join('')
  const total = `<tr class="total-row"><td colspan="2">รวม</td><td>${report.totals.male}</td><td>${report.totals.female}</td><td>${report.visitTotal}</td>
    ${report.totals.symptoms.map((count) => `<td>${count}</td>`).join('')}
    <td>${report.totals.symptoms.reduce((sum, count) => sum + count, 0)}</td>
    ${report.totals.notes.map((count) => `<td>${count}</td>`).join('')}
  </tr>`
  const percentages = `<tr class="percent-row"><td colspan="5">คิดเป็นร้อยละ</td>
    ${report.totals.symptoms.map((count) => `<td>${report.visitTotal ? ((count / report.visitTotal) * 100).toFixed(2) : '0.00'}</td>`).join('')}
    <td></td>${report.totals.notes.map((count) => `<td>${report.visitTotal ? ((count / report.visitTotal) * 100).toFixed(2) : '0.00'}</td>`).join('')}
  </tr>`

  return `<table class="illness-table"><thead><tr>${headerHtml(header)}</tr><tr>${headerHtml(sub)}</tr></thead>
    <tbody>${monthly}</tbody><tfoot>${total}${percentages}</tfoot></table>`
}

export async function printIllnessStatisticsPdf(academicYear: string): Promise<void> {
  const printWindow = openPrintWindow()
  if (!printWindow) throw new Error('กรุณาอนุญาตให้เปิดหน้าต่างสำหรับพิมพ์')
  const reports = await getIllnessStatistics(academicYear)
  const pages = reports.map((report) => `<section class="print-page">
    <h1>สรุปสถิติการเจ็บป่วยนักเรียนโรงเรียนตะพานหิน ภาคเรียนที่ ${report.semester} ปีการศึกษา ${academicYear}</h1>
    ${illnessTableHtml(report)}
  </section>`)

  writePrintDocument(printWindow, 'สถิติการเจ็บป่วย', pages, `
    @page { size: A3 landscape; margin: 10mm; }
    body { color:#17202a; font-family:Tahoma,"Leelawadee UI",sans-serif; font-size:10px; }
    h1 { text-align:center; font-size:18px; margin:0 0 18px; }
    .print-page { break-after:page; page-break-after:always; }
    .print-page:last-child { break-after:auto; page-break-after:auto; }
    table { border-collapse:collapse; table-layout:fixed; width:100%; }
    th,td { border:1px solid #334155; padding:8px 3px; text-align:center; vertical-align:middle; }
    th { font-size:9px; }
    thead tr:first-child th:nth-child(1) { background:#D9EAD3; }
    thead tr:first-child th:nth-child(2),thead tr:first-child th:nth-child(4) { background:#F6B900; }
    thead tr:first-child th:nth-child(3) { background:#D9D2E9; }
    thead tr:first-child th:nth-child(5) { background:#00A6D6; }
    thead tr:first-child th:nth-child(6) { background:#8ED34F; }
    thead tr:first-child th:nth-child(7) { background:#C9DAF8; }
    thead tr:nth-child(2) th { background:#8ED34F; }
    thead tr:nth-child(2) th:nth-child(-n+2) { background:#D9D2E9; }
    .symptom-total { background:#B7DDE8; color:#c00; font-weight:bold; }
    .total-row td { background:#93D050; font-weight:bold; }
    .percent-row td { background:#FFFF00; font-weight:bold; }
    @media print { body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } }
  `)
}

export async function createIllnessStatisticsPdf(academicYear: string): Promise<Blob> {
  const reports = await getIllnessStatistics(academicYear)
  const pages = reports.map((report) => `
    <section class="pdf-page">
      <h1>สรุปสถิติการเจ็บป่วยนักเรียนโรงเรียนตะพานหิน ภาคเรียนที่ ${report.semester} ปีการศึกษา ${escapeHtml(academicYear)}</h1>
      ${illnessTableHtml(report)}
    </section>`)
  return createPdfBlob(pages, `
    body { color:#17202a; font-family:"Noto Sans Thai",Tahoma,sans-serif; font-size:11px; }
    h1 { text-align:center; font-size:18px; margin:0 0 16px; }
    .pdf-page { width:1500px; background:#fff; padding:24px; }
    table { border-collapse:collapse; table-layout:fixed; width:100%; }
    th,td { border:1px solid #334155; padding:7px 3px; text-align:center; vertical-align:middle; }
    thead th { background:#d9e2f3; }
    .symptom-total { background:#b7dde8; font-weight:bold; }
    .total-row td { background:#93d050; font-weight:bold; }
    .percent-row td { background:#ffff00; font-weight:bold; }
  `)
}

function openPrintWindow(): Window | null {
  const printWindow = window.open('', '_blank')
  return printWindow
}

function writePrintDocument(printWindow: Window, title: string, pages: string[], styles: string): void {
  printWindow.document.open()
  printWindow.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8" />
    <title>${escapeHtml(title)}</title><style>${styles}</style></head><body>${pages.join('')}
    <script>window.onload = () => window.print()</script></body></html>`)
  printWindow.document.close()
}

async function createPdfBlob(pages: string[], styles: string): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-20000px'
  host.style.top = '0'
  host.style.zIndex = '-1'
  document.body.append(host)

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
  try {
    for (const [index, page] of pages.entries()) {
      host.innerHTML = `<style>${styles}</style>${page}`
      await document.fonts.ready
      const canvas = await html2canvas(host, { scale: 1.5, backgroundColor: '#ffffff' })
      const margin = 8
      const pageWidth = 420
      const pageHeight = 297
      const imageWidth = pageWidth - margin * 2
      const imageHeight = canvas.height * imageWidth / canvas.width
      const usableHeight = pageHeight - margin * 2
      const image = canvas.toDataURL('image/jpeg', 0.92)
      let offset = 0

      while (offset < imageHeight) {
        if (index > 0 || offset > 0) pdf.addPage('a3', 'landscape')
        pdf.addImage(image, 'JPEG', margin, margin - offset, imageWidth, imageHeight)
        offset += usableHeight
      }
    }
    return pdf.output('blob')
  } finally {
    host.remove()
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}
