import { readSheet } from 'read-excel-file/browser'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Sex, Student } from '../types'
import { getStudentDirectory, saveStudentDirectory } from './browserDataStore'
import { getCurrentStudentRoster } from './studentRepository'

export type StudentImportStatus = 'new' | 'same' | 'changed' | 'invalid'

export type StudentImportRow = {
  rowNumber: number
  student: Student | null
  existingStudent: Student | null
  status: StudentImportStatus
  details: string[]
  action: 'update' | 'keep'
}

type ImportField = 'number' | 'studentId' | 'sex' | 'name' | 'surname' | 'className'

const requiredHeaders: Record<ImportField, string[]> = {
  number: ['number', 'no', 'เลขที่'],
  studentId: ['studentid', 'รหัสนักเรียน'],
  sex: ['sex', 'gender', 'เพศ'],
  name: ['name', 'firstname', 'ชื่อ'],
  surname: ['surname', 'lastname', 'นามสกุล'],
  className: ['class', 'classname', 'ชั้น', 'ห้อง'],
}

const optionalYearHeaders = ['academicyear', 'schoolyear', 'ปีการศึกษา']

const normalizeHeader = (value: unknown): string =>
  String(value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '')

const cellText = (value: unknown): string => String(value ?? '').trim()

function normalizeStudentId(value: unknown): string {
  const text = cellText(value)
  if (!/^\d{1,5}$/.test(text)) return ''
  return text.padStart(5, '0')
}

function normalizeSex(value: unknown): Sex | null {
  const sex = cellText(value).toLowerCase()
  if (['ชาย', 'ช.', 'ช', 'm', 'male'].includes(sex)) return 'ชาย'
  if (['หญิง', 'ญ.', 'ญ', 'f', 'female'].includes(sex)) return 'หญิง'
  return null
}

function getDifferences(current: Student, imported: Student): string[] {
  const fields: Array<[keyof Student, string]> = [
    ['number', 'เลขที่'],
    ['sex', 'เพศ'],
    ['name', 'ชื่อ'],
    ['surname', 'นามสกุล'],
    ['class_name', 'ชั้น'],
    ['academic_year', 'ปีการศึกษา'],
  ]

  return fields
    .filter(([field]) => current[field] !== imported[field])
    .map(([, label]) => label)
}

export async function previewStudentImport(file: File, defaultAcademicYear: string): Promise<StudentImportRow[]> {
  const sheetRows = await readSheet(file)
  const normalizedRows = sheetRows.map((row) => row?.map(normalizeHeader) ?? [])
  const headerRowIndex = normalizedRows.findIndex((headers) =>
    Object.values(requiredHeaders).every((aliases) => headers.some((header) => aliases.includes(header))),
  )

  if (headerRowIndex < 0) {
    throw new Error('ไม่พบแถวหัวตารางที่มี Number, Student_ID, Sex, Name, Surname และ Class')
  }

  const headers = normalizedRows[headerRowIndex]
  const indexes: Partial<Record<ImportField, number>> = {}

  for (const [field, aliases] of Object.entries(requiredHeaders) as Array<[ImportField, string[]]>) {
    const index = headers.findIndex((header) => aliases.includes(header))
    if (index >= 0) indexes[field] = index
  }

  const missingHeaders = Object.keys(requiredHeaders)
    .filter((field) => indexes[field as ImportField] === undefined)
    .map((field) => requiredHeaders[field as ImportField][0])

  if (missingHeaders.length > 0) {
    throw new Error(`ไม่พบคอลัมน์ที่จำเป็น: ${missingHeaders.join(', ')}`)
  }

  const titleText = sheetRows
    .slice(0, headerRowIndex)
    .flatMap((row) => row ?? [])
    .map(cellText)
    .join(' ')
  const titleAcademicYear = titleText.match(/25\d{2}/)?.[0]
  const fileAcademicYear = titleAcademicYear ?? defaultAcademicYear
  const yearIndex = headers.findIndex((header) => optionalYearHeaders.includes(header))
  const existingStudents = await getCurrentStudentRoster()
  const existingById = new Map(existingStudents.map((student) => [student.student_id, student]))
  const seenIds = new Set<string>()
  const rows: StudentImportRow[] = []

  for (const [index, values] of sheetRows.slice(headerRowIndex + 1).entries()) {
    if (!values || values.every((value) => cellText(value) === '')) continue

    const valueAt = (field: ImportField): unknown => values[indexes[field] as number]
    if (cellText(valueAt('number')) === 'ตัวอย่าง (ลบก่อนนำเข้า)') continue
    const studentId = normalizeStudentId(valueAt('studentId'))
    const number = Number(cellText(valueAt('number')))
    const sex = normalizeSex(valueAt('sex'))
    const name = cellText(valueAt('name'))
    const surname = cellText(valueAt('surname'))
    const className = cellText(valueAt('className'))
    const academicYear = cellText(yearIndex >= 0 ? values[yearIndex] : '') || fileAcademicYear
    const errors: string[] = []

    if (!studentId) errors.push('Student_ID ต้องเป็นตัวเลขไม่เกิน 5 หลัก')
    if (!Number.isInteger(number) || number < 1) errors.push('เลขที่ต้องเป็นจำนวนเต็มมากกว่า 0')
    if (!sex) errors.push('เพศต้องเป็น ชาย หรือ หญิง')
    if (!name) errors.push('กรุณาระบุชื่อ')
    if (!surname) errors.push('กรุณาระบุนามสกุล')
    if (!className) errors.push('กรุณาระบุชั้น')
    if (!/^\d{4}$/.test(academicYear)) errors.push('ปีการศึกษาต้องเป็นตัวเลข 4 หลัก')
    if (studentId && seenIds.has(studentId)) errors.push('Student_ID ซ้ำภายในไฟล์')
    if (studentId) seenIds.add(studentId)

    if (errors.length > 0) {
      rows.push({ rowNumber: index + headerRowIndex + 2, student: null, existingStudent: null, status: 'invalid', details: errors, action: 'keep' })
      continue
    }

    const importedStudent: Student = {
      student_id: studentId,
      number,
      name,
      surname,
      sex: sex as Sex,
      class_name: className,
      academic_year: academicYear,
      status: existingById.get(studentId)?.status ?? 'ปกติ',
    }
    const existing = existingById.get(studentId)

    if (!existing) {
      rows.push({ rowNumber: index + headerRowIndex + 2, student: importedStudent, existingStudent: null, status: 'new', details: [], action: 'update' })
      continue
    }

    const differences = getDifferences(existing, importedStudent)
    rows.push({
      rowNumber: index + headerRowIndex + 2,
      student: importedStudent,
      existingStudent: existing,
      status: differences.length > 0 ? 'changed' : 'same',
      details: differences,
      action: 'keep',
    })
  }

  if (rows.length === 0) throw new Error('ไม่พบข้อมูลนักเรียนในไฟล์')
  return rows
}

export type StudentRosterImportResult = {
  academicYear: string
  studentCount: number
  newStudentCount: number
}

export async function commitStudentRoster(rows: StudentImportRow[]): Promise<StudentRosterImportResult> {
  if (rows.length === 0 || rows.some((row) => row.status === 'invalid' || !row.student)) {
    throw new Error('กรุณาแก้ไขแถวที่ผิดพลาดทั้งหมดก่อนยืนยันนำเข้า')
  }

  const importedStudents = rows.map((row) => {
    if (row.status === 'changed' && row.action === 'keep' && row.existingStudent) {
      return { ...row.existingStudent, academic_year: row.student?.academic_year ?? row.existingStudent.academic_year }
    }
    return row.student as Student
  })
  const academicYear = importedStudents[0]?.academic_year

  if (!academicYear || importedStudents.some((student) => student.academic_year !== academicYear)) {
    throw new Error('ไฟล์ต้องเป็นรายชื่อนักเรียนของปีการศึกษาเดียวกัน')
  }

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('import_student_roster', {
      p_academic_year: academicYear,
      p_students: importedStudents.map(({ student_id, number, sex, name, surname, class_name }) => ({
        student_id,
        number,
        sex,
        name,
        surname,
        class_name,
      })),
    })

    if (error || !data) throw new Error('นำเข้ารายชื่อนักเรียนไม่สำเร็จ')
    return {
      academicYear,
      studentCount: Number(data.student_count),
      newStudentCount: Number(data.new_student_count),
    }
  }

  const currentStudents = getStudentDirectory()
  const currentYearHasRoster = currentStudents.some((student) => student.academic_year === academicYear)
  const mergedStudents = new Map(
    (currentYearHasRoster ? currentStudents : [])
      .map((student) => [student.student_id, student]),
  )
  for (const student of importedStudents) mergedStudents.set(student.student_id, student)

  const nextDirectory = [...mergedStudents.values()]
  saveStudentDirectory(nextDirectory)
  return {
    academicYear,
    studentCount: nextDirectory.filter((student) => student.academic_year === academicYear).length,
    newStudentCount: rows.filter((row) => row.status === 'new').length,
  }
}