import { getServiceRecords, getStudentDirectory, saveServiceRecords } from './browserDataStore'
import { getLocalDateKey } from '../lib/dateUtils'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { ServiceRecord, Student } from '../types'

export type ServiceHistoryRecord = ServiceRecord & { student?: Student }
export type ServiceHistoryPage = { records: ServiceHistoryRecord[]; total: number }

export async function deleteServiceRecord(recordId: number): Promise<void> {
  if (!Number.isSafeInteger(recordId) || recordId < 1) {
    throw new Error('รหัสประวัติไม่ถูกต้อง')
  }

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.rpc('delete_service_record', { p_record_id: recordId })
    if (error?.code === '42501') throw new Error('เฉพาะ Admin เท่านั้นที่ลบประวัติได้')
    if (error?.code === 'P0002') throw new Error('ไม่พบประวัติที่ต้องการลบ อาจถูกลบไปแล้ว')
    if (error) throw new Error('ลบประวัติไม่สำเร็จ กรุณาลองใหม่')
    return
  }

  const records = getServiceRecords()
  if (!records.some((record) => record.id === recordId)) {
    throw new Error('ไม่พบประวัติที่ต้องการลบ')
  }
  saveServiceRecords(records.filter((record) => record.id !== recordId))
}

type ServiceHistoryRow = {
  id: number
  service_datetime: string
  student_id: string
  academic_record_id: string
}

async function hydrateServiceHistory(records: ServiceHistoryRow[]): Promise<ServiceHistoryRecord[]> {
  if (!supabase || records.length === 0) return []

  const recordIds = records.map((record) => record.id)
  const academicIds = [...new Set(records.map((record) => record.academic_record_id))]
  const [itemsResult, academicsResult, catalogResult] = await Promise.all([
    supabase.from('service_record_items').select('record_id, item_id, other_detail').in('record_id', recordIds),
    supabase.from('student_academic_records').select('id, student_id, number, sex, name, surname, class, academic_year').in('id', academicIds),
    supabase.from('service_item_types').select('id, code'),
  ])

  if (itemsResult.error || academicsResult.error || catalogResult.error) {
    throw new Error('โหลดรายละเอียดประวัติการใช้บริการไม่สำเร็จ')
  }

  const academicById = new Map((academicsResult.data ?? []).map((academic) => [academic.id, academic]))
  const itemCodeById = new Map((catalogResult.data ?? []).map((item) => [item.id, item.code]))
  const itemsByRecordId = new Map<number, string[]>()

  for (const item of itemsResult.data ?? []) {
    const code = itemCodeById.get(item.item_id)
    if (!code) continue
    const selectedItem = code === 'other' && item.other_detail
      ? `other:${item.other_detail}`
      : code
    const selected = itemsByRecordId.get(item.record_id) ?? []
    selected.push(selectedItem)
    itemsByRecordId.set(item.record_id, selected)
  }

  return records.map((record) => {
    const academic = academicById.get(record.academic_record_id)
    const student: Student | undefined = academic ? {
      student_id: academic.student_id,
      number: academic.number ?? 0,
      sex: academic.sex as Student['sex'],
      name: academic.name,
      surname: academic.surname,
      class_name: academic.class,
      academic_year: academic.academic_year,
      status: 'ปกติ',
    } : undefined

    return {
      id: Number(record.id),
      service_datetime: record.service_datetime,
      student_id: record.student_id,
      selected_items: itemsByRecordId.get(record.id) ?? [],
      student,
    }
  })
}

export async function getCurrentStudentRoster(): Promise<Student[]> {
  if (!isSupabaseConfigured || !supabase) return getStudentDirectory()

  const pageSize = 500
  const rows = []
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from('student_academic_records')
      .select('student_id, number, sex, name, surname, class, academic_year, students!inner(current_status)')
      .eq('is_active', true)
      .order('student_id', { ascending: true })
      .range(start, start + pageSize - 1)

    if (error) throw new Error('โหลดรายชื่อนักเรียนปัจจุบันไม่สำเร็จ')
    rows.push(...(data ?? []))
    if ((data ?? []).length < pageSize) break
  }

  return rows.map((record) => {
    const profile = record.students as unknown as { current_status: Student['status'] }
    return {
      student_id: record.student_id,
      number: record.number ?? 0,
      sex: record.sex as Student['sex'],
      name: record.name,
      surname: record.surname,
      class_name: record.class,
      academic_year: record.academic_year,
      status: profile.current_status,
    }
  })
}

export async function getServiceHistory(): Promise<ServiceHistoryRecord[]> {
  if (!isSupabaseConfigured || !supabase) {
    const studentsById = new Map(getStudentDirectory().map((student) => [student.student_id, student]))
    return getServiceRecords().map((record) => ({ ...record, student: studentsById.get(record.student_id) }))
  }

  const pageSize = 500
  const history: ServiceHistoryRecord[] = []
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from('service_records')
      .select('id, service_datetime, student_id, academic_record_id')
      .order('service_datetime', { ascending: false })
      .range(start, start + pageSize - 1)

    if (error) throw new Error('โหลดประวัติการใช้บริการไม่สำเร็จ')
    const records = data ?? []
    history.push(...await hydrateServiceHistory(records))
    if (records.length < pageSize) break
  }
  return history
}

export async function getServiceHistoryPage(
  dateKey: string,
  page: number,
  pageSize: number,
): Promise<ServiceHistoryPage> {
  const safePage = Math.max(1, Math.floor(page))
  const safePageSize = [10, 25, 50, 100].includes(pageSize) ? pageSize : 10
  const start = (safePage - 1) * safePageSize

  if (!isSupabaseConfigured || !supabase) {
    const records = (await getServiceHistory())
      .filter((record) => getLocalDateKey(new Date(record.service_datetime)) === dateKey)
      .sort((first, second) => second.service_datetime.localeCompare(first.service_datetime))
    return { records: records.slice(start, start + safePageSize), total: records.length }
  }

  const startDate = new Date(`${dateKey}T00:00:00`)
  if (Number.isNaN(startDate.getTime()) || getLocalDateKey(startDate) !== dateKey) {
    throw new Error('วันที่ไม่ถูกต้อง')
  }
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 1)

  const { data, count, error } = await supabase
    .from('service_records')
    .select('id, service_datetime, student_id, academic_record_id', { count: 'exact' })
    .gte('service_datetime', startDate.toISOString())
    .lt('service_datetime', endDate.toISOString())
    .order('service_datetime', { ascending: false })
    .range(start, start + safePageSize - 1)

  if (error) throw new Error('โหลดรายงานการใช้บริการไม่สำเร็จ')
  const records = await hydrateServiceHistory(data ?? [])
  return { records, total: count ?? 0 }
}
