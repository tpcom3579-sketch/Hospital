import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AdminLayout } from '../../components/layout/AdminLayout'
import { Button } from '../../components/ui/Button'
import { noteOptions, symptomOptions } from '../../data/mockData'
import { getLocalDateKey } from '../../lib/dateUtils'
import { getActiveStaffProfile } from '../../services/authService'
import { deleteServiceRecord, getServiceHistory } from '../../services/studentRepository'
import type { ServiceHistoryRecord } from '../../services/studentRepository'

const symptomLabels = new Map(symptomOptions.map((item) => [item.id, item.label]))
const noteLabels = new Map(noteOptions.map((item) => [item.id, item.label]))

function getSelectedLabels(selectedItems: string[]) {
  const symptoms: string[] = []
  const notes: string[] = []

  for (const selectedItem of selectedItems) {
    const detailSeparator = selectedItem.indexOf(':')
    const itemId = detailSeparator < 0 ? selectedItem : selectedItem.slice(0, detailSeparator)
    const detail = detailSeparator < 0 ? '' : selectedItem.slice(detailSeparator + 1).trim()
    const symptomLabel = symptomLabels.get(itemId)
    const noteLabel = noteLabels.get(itemId)

    if (symptomLabel) symptoms.push(symptomLabel)
    else if (noteLabel) notes.push(itemId === 'other' && detail ? detail : detail ? `${noteLabel}: ${detail}` : noteLabel)
    else notes.push(selectedItem)
  }

  return { symptoms, notes }
}

function AdminHistoryPage() {
  const [serviceRecords, setServiceRecords] = useState<ServiceHistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [canDelete, setCanDelete] = useState(false)
  const [deletingRecordId, setDeletingRecordId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleteMessage, setDeleteMessage] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [studentId, setStudentId] = useState('')
  const [selectedLevel, setSelectedLevel] = useState('')
  const [selectedRoom, setSelectedRoom] = useState('')
  const [sex, setSex] = useState('')

  useEffect(() => {
    let active = true
    void Promise.all([getServiceHistory(), getActiveStaffProfile()])
      .then(([records, profile]) => {
        if (!active) return
        setServiceRecords(records)
        setCanDelete(profile?.role === 'admin')
      })
      .catch(() => { if (active) setError('โหลดประวัติการใช้บริการไม่สำเร็จ') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function handleDeleteRecord(record: ServiceHistoryRecord) {
    if (!canDelete || deletingRecordId !== null) return

    const studentName = record.student ? `${record.student.name} ${record.student.surname}` : record.student_id
    const serviceDate = new Date(record.service_datetime).toLocaleString('th-TH')
    const confirmed = window.confirm(
      `ยืนยันลบประวัติของ ${studentName} (รหัส ${record.student_id}) วันที่ ${serviceDate} หรือไม่?\n\nรายการนี้จะถูกลบจากฐานข้อมูลอย่างถาวร ส่วนไฟล์สำรองประจำปีที่สร้างไว้ก่อนหน้านี้จะไม่เปลี่ยนแปลง`,
    )
    if (!confirmed) return

    setDeletingRecordId(record.id)
    setDeleteError('')
    setDeleteMessage('')
    try {
      await deleteServiceRecord(record.id)
      setServiceRecords((currentRecords) => currentRecords.filter((item) => item.id !== record.id))
      setDeleteMessage(`ลบประวัติรหัสนักเรียน ${record.student_id} แล้ว`)
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'ลบประวัติไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setDeletingRecordId(null)
    }
  }

  const invalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo)
  const columnCount = canDelete ? 8 : 7
  const normalizedStudentId = studentId.trim().toLocaleLowerCase()
  const classLevels = [...new Set(serviceRecords.map((record) => {
    const className = record.student?.class_name ?? ''
    const classMatch = className.match(/ม\.\s*\d+/)
    return classMatch ? classMatch[0].replace(/\s+/g, ' ') : ''
  }).filter(Boolean))].sort((first, second) => first.localeCompare(second, 'th'))
  const classRooms = [...new Set(serviceRecords
    .filter((record) => !selectedLevel || (record.student?.class_name ?? '').includes(selectedLevel))
    .map((record) => {
      const className = record.student?.class_name ?? ''
      const roomMatch = className.match(/\/\s*(\d+)/)
      return roomMatch ? roomMatch[1] : ''
    }).filter(Boolean))].sort((first, second) => Number(first) - Number(second))
  const filteredRecords = serviceRecords.filter((record) => {
    const className = record.student?.class_name ?? ''
    const recordLevel = className.match(/ม\.\s*\d+/)?.[0].replace(/\s+/g, ' ') ?? ''
    const recordRoom = className.match(/\/\s*(\d+)/)?.[1] ?? ''
    const recordDate = getLocalDateKey(new Date(record.service_datetime))
    const matchesLevel = !selectedLevel || recordLevel === selectedLevel
    const matchesRoom = !selectedRoom || recordRoom === selectedRoom
    return (!dateFrom || recordDate >= dateFrom)
      && (!dateTo || recordDate <= dateTo)
      && (!normalizedStudentId || record.student_id.toLocaleLowerCase().includes(normalizedStudentId))
      && matchesLevel
      && matchesRoom
      && (!sex || record.student?.sex === sex)
  })

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ประวัติการใช้บริการ</h1>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <input aria-label="วันที่เริ่มต้น" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" type="date" />
            <input aria-label="วันที่สิ้นสุด" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" type="date" />
            <input aria-label="รหัสนักเรียน" value={studentId} onChange={(event) => setStudentId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" placeholder="รหัสนักเรียน" />
            <select
              aria-label="ระดับชั้น"
              value={selectedLevel}
              onChange={(event) => { setSelectedLevel(event.target.value); setSelectedRoom('') }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
            >
              <option value="">ทุกระดับชั้น</option>
              {classLevels.map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
            <select
              aria-label="ห้อง"
              value={selectedRoom}
              onChange={(event) => setSelectedRoom(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">ทุกห้อง</option>
              {classRooms.map((room) => <option key={room} value={room}>{room}</option>)}
            </select>
            <select aria-label="เพศ" value={sex} onChange={(event) => setSex(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
              <option value="">เพศ</option>
              <option value="ชาย">ชาย</option>
              <option value="หญิง">หญิง</option>
            </select>
          </div>
        </div>
        {invalidDateRange ? <p role="alert" className="text-sm text-rose-700">วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด</p> : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3">วันที่</th>
                  <th className="px-4 py-3">เวลา</th>
                  <th className="px-4 py-3">รหัสนักเรียน</th>
                  <th className="px-4 py-3">ชื่อ-นามสกุล</th>
                  <th className="px-4 py-3">ชั้น</th>
                  <th className="px-4 py-3">อาการ</th>
                  <th className="px-4 py-3">หมายเหตุ</th>
                  {canDelete ? <th className="px-4 py-3">จัดการ</th> : null}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={columnCount} className="px-4 py-10 text-center text-slate-500">กำลังโหลดประวัติ...</td></tr>
                ) : error ? (
                  <tr><td colSpan={columnCount} role="alert" className="px-4 py-10 text-center text-rose-700">{error}</td></tr>
                ) : invalidDateRange ? (
                  <tr><td colSpan={columnCount} className="px-4 py-10 text-center text-slate-500">โปรดแก้ไขช่วงวันที่</td></tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} className="px-4 py-10 text-center text-slate-500">
                      {serviceRecords.length === 0 ? 'ยังไม่มีประวัติการใช้บริการ' : 'ไม่พบรายการตามตัวกรอง'}
                    </td>
                  </tr>
                ) : filteredRecords.map((record) => {
                  const selectedLabels = getSelectedLabels(record.selected_items)
                  return (
                    <tr key={record.id} className="border-t border-slate-200">
                      <td className="px-4 py-3">{new Date(record.service_datetime).toLocaleDateString('th-TH')}</td>
                      <td className="px-4 py-3">{new Date(record.service_datetime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-4 py-3 font-medium">{record.student_id}</td>
                      <td className="px-4 py-3">{record.student ? `${record.student.name} ${record.student.surname}` : '-'}</td>
                      <td className="px-4 py-3">{record.student?.class_name ?? '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-48 flex-wrap gap-1.5">
                          {selectedLabels.symptoms.length > 0 ? selectedLabels.symptoms.map((label) => (
                            <span key={label} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{label}</span>
                          )) : <span className="text-slate-400">-</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-32 flex-wrap gap-1.5">
                          {selectedLabels.notes.length > 0 ? selectedLabels.notes.map((label) => (
                            <span key={label} className="rounded-full bg-sky-50 px-2 py-1 text-xs text-sky-800">{label}</span>
                          )) : <span className="text-slate-400">-</span>}
                        </div>
                      </td>
                      {canDelete ? (
                        <td className="px-4 py-3">
                          <Button
                            type="button"
                            variant="danger"
                            className="gap-2 px-3 py-2"
                            disabled={deletingRecordId !== null}
                            aria-label={`ลบประวัติรหัสนักเรียน ${record.student_id}`}
                            onClick={() => void handleDeleteRecord(record)}
                          >
                            <Trash2 size={16} />
                            {deletingRecordId === record.id ? 'กำลังลบ...' : 'ลบ'}
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        {deleteError ? <p role="alert" className="text-sm text-rose-700">{deleteError}</p> : null}
        {deleteMessage ? <p role="status" className="text-sm text-emerald-700">{deleteMessage}</p> : null}
      </div>
    </AdminLayout>
  )
}

export default AdminHistoryPage
