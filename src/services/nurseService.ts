import {
  getHistoricalStudentDirectory,
  getServiceRecords,
  getStudentDirectory,
  saveServiceRecords,
} from './browserDataStore'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { ServiceRecord, Student } from '../types'

export const findStudentById = (studentId: string): Student | undefined =>
  getStudentDirectory().find((student) => student.student_id === studentId)

export async function lookupStudentById(studentId: string): Promise<Student | undefined> {
  if (!isSupabaseConfigured || !supabase) return findStudentById(studentId)

  const { data, error } = await supabase.functions.invoke<{ student: Student }>('student-lookup', {
    body: { student_id: studentId },
  })
  if (error) {
    const response = 'context' in error ? error.context : undefined
    if (response instanceof Response && response.status === 404) return undefined
    throw new Error('ค้นหาข้อมูลนักเรียนไม่สำเร็จ กรุณาลองใหม่')
  }
  return data?.student
}

export const createServiceRecord = async (studentId: string, selectedItems: string[]): Promise<ServiceRecord> => {
  if (isSupabaseConfigured && supabase) {
    const itemCodes: string[] = []
    let otherDetail: string | null = null

    for (const selectedItem of selectedItems) {
      const otherSeparator = selectedItem.indexOf(':')
      const itemCode = otherSeparator < 0 ? selectedItem : selectedItem.slice(0, otherSeparator)
      if (!itemCodes.includes(itemCode)) itemCodes.push(itemCode)
      if (itemCode === 'other' && otherSeparator >= 0) {
        otherDetail = selectedItem.slice(otherSeparator + 1).trim()
      }
    }

    const { data, error } = await supabase.functions.invoke<{
      record_id: number
      service_datetime: string
      selected_items: string[]
    }>('service-submit', {
      body: { student_id: studentId, item_codes: itemCodes, other_detail: otherDetail },
    })

    if (error || !data) throw new Error('บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่')
    return {
      id: Number(data.record_id),
      service_datetime: data.service_datetime,
      student_id: studentId,
      selected_items: selectedItems,
    }
  }

  const serviceRecords = getServiceRecords()
  const newRecord: ServiceRecord = {
    id: Math.max(...serviceRecords.map((record) => record.id), 1000) + 1,
    service_datetime: new Date().toISOString(),
    student_id: studentId,
    selected_items: selectedItems,
  }

  serviceRecords.unshift(newRecord)
  saveServiceRecords(serviceRecords)

  return newRecord
}

export const getRecentActivity = () => {
  const students = getHistoricalStudentDirectory()

  return getServiceRecords().slice(0, 8).map((record) => {
    const student = students.find((item) => item.student_id === record.student_id)
    return {
      ...record,
      student,
    }
  })
}

export const getStudentMetrics = () => {
  const students = getStudentDirectory()

  return {
    total: students.length,
    male: students.filter((student) => student.sex === 'ชาย').length,
    female: students.filter((student) => student.sex === 'หญิง').length,
  }
}

export const getServiceSummary = () => {
  const students = getHistoricalStudentDirectory()
  const serviceRecords = getServiceRecords()
  const total = serviceRecords.length
  const male = serviceRecords.filter((record) => {
    const student = students.find((item) => item.student_id === record.student_id)
    return student?.sex === 'ชาย'
  }).length

  const female = serviceRecords.filter((record) => {
    const student = students.find((item) => item.student_id === record.student_id)
    return student?.sex === 'หญิง'
  }).length

  return { total, male, female }
}
