import { ChevronLeft, ChevronRight, Search, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../../components/layout/AdminLayout'
import { Button } from '../../components/ui/Button'
import {
  compareStudentsByClass,
  getStudentLevelFilter,
  getStudentRoomFilter,
  OTHER_CLASS_FILTER,
  parseStudentClass,
} from '../../lib/studentClassUtils'
import { getCurrentStudentRoster } from '../../services/studentRepository'
import type { Student } from '../../types'

function AdminStudentsPage() {
  const navigate = useNavigate()
  const [studentDirectory, setStudentDirectory] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedLevel, setSelectedLevel] = useState('')
  const [selectedRoom, setSelectedRoom] = useState('')
  const [selectedSex, setSelectedSex] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    let active = true
    void getCurrentStudentRoster()
      .then((students) => { if (active) setStudentDirectory(students) })
      .catch(() => { if (active) setError('โหลดรายชื่อนักเรียนไม่สำเร็จ') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const hasUnclassifiedLevel = studentDirectory.some((student) =>
    getStudentLevelFilter(student.class_name) === OTHER_CLASS_FILTER,
  )
  const classLevels = [
    ...Array.from({ length: 6 }, (_, index) => String(index + 1)),
    ...(hasUnclassifiedLevel ? [OTHER_CLASS_FILTER] : []),
  ]
  const roomMap = new Map<string, { value: string; label: string; sortClass: ReturnType<typeof parseStudentClass> }>()
  for (const student of studentDirectory) {
    if (selectedLevel && getStudentLevelFilter(student.class_name) !== selectedLevel) continue
    const parsedClass = parseStudentClass(student.class_name)
    const roomValue = getStudentRoomFilter(student.class_name)
    roomMap.set(roomValue, {
      value: roomValue,
      label: roomValue === OTHER_CLASS_FILTER ? 'อื่นๆ' : roomValue,
      sortClass: parsedClass,
    })
  }
  const roomOrder = { number: 0, letter: 1, other: 2 }
  const classRooms = [...roomMap.values()].sort((first, second) => {
    const typeOrder = roomOrder[first.sortClass.roomType] - roomOrder[second.sortClass.roomType]
    if (typeOrder !== 0) return typeOrder
    if (first.sortClass.roomType === 'number' && second.sortClass.roomType === 'number') {
      return Number(first.value) - Number(second.value)
    }
    return first.label.localeCompare(second.label, 'en', { numeric: true, sensitivity: 'base' })
  })
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const filteredStudents = studentDirectory.filter((student) => {
    const matchesSearch = !normalizedSearch || [
      student.student_id,
      student.name,
      student.surname,
      `${student.name} ${student.surname}`,
    ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch))
    const matchesLevel = !selectedLevel || getStudentLevelFilter(student.class_name) === selectedLevel
    const matchesRoom = !selectedRoom || getStudentRoomFilter(student.class_name) === selectedRoom
    return matchesSearch
      && matchesLevel
      && matchesRoom
      && (!selectedSex || student.sex === selectedSex)
  }).sort(compareStudentsByClass)
  const pageCount = Math.max(1, Math.ceil(filteredStudents.length / pageSize))
  const pagedStudents = filteredStudents.slice((page - 1) * pageSize, page * pageSize)

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">นักเรียน</h1>
          </div>
          <Button onClick={() => navigate('/nurse/admin/import')}>
            <Upload size={16} className="mr-2" />
            Import XLSX
          </Button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-3.5 text-slate-400" size={17} />
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Search"
                aria-label="ค้นหาจากรหัสหรือชื่อนักเรียน"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              />
            </div>
            <select
              aria-label="กรองตามระดับชั้น"
              value={selectedLevel}
              onChange={(event) => { setSelectedLevel(event.target.value); setSelectedRoom(''); setPage(1) }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">ทุกระดับชั้น</option>
              {classLevels.map((level) => (
                <option key={level} value={level}>
                  {level === OTHER_CLASS_FILTER ? 'อื่นๆ' : `ม.${level}`}
                </option>
              ))}
            </select>
            <select
              aria-label="กรองตามห้อง"
              value={selectedRoom}
              onChange={(event) => { setSelectedRoom(event.target.value); setPage(1) }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">ทุกห้อง</option>
              {classRooms.map((room) => <option key={room.value} value={room.value}>{room.label}</option>)}
            </select>
            <select
              aria-label="กรองตามเพศ"
              value={selectedSex}
              onChange={(event) => { setSelectedSex(event.target.value); setPage(1) }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">ทุกเพศ</option>
              <option value="ชาย">ชาย</option>
              <option value="หญิง">หญิง</option>
            </select>
            <select
              aria-label="จำนวนนักเรียนต่อหน้า"
              value={pageSize}
              onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} รายการ</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3">เลขที่</th>
                  <th className="px-4 py-3">รหัสนักเรียน</th>
                  <th className="px-4 py-3">ชื่อ</th>
                  <th className="px-4 py-3">นามสกุล</th>
                  <th className="px-4 py-3">เพศ</th>
                  <th className="px-4 py-3">ชั้น</th>
                  <th className="px-4 py-3">ปีการศึกษา</th>
                  <th className="px-4 py-3">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">กำลังโหลดรายชื่อนักเรียน...</td></tr>
                ) : error ? (
                  <tr><td colSpan={8} role="alert" className="px-4 py-10 text-center text-rose-700">{error}</td></tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      {studentDirectory.length === 0 ? 'ยังไม่มีรายชื่อนักเรียน' : 'ไม่พบข้อมูลตามตัวกรอง'}
                    </td>
                  </tr>
                ) : pagedStudents.map((student) => (
                  <tr key={student.student_id} className="border-t border-slate-200">
                    <td className="px-4 py-3">{student.number}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{student.student_id}</td>
                    <td className="px-4 py-3">{student.name}</td>
                    <td className="px-4 py-3">{student.surname}</td>
                    <td className="px-4 py-3">{student.sex}</td>
                    <td className="px-4 py-3">{student.class_name}</td>
                    <td className="px-4 py-3">{student.academic_year}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                        {student.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              แสดง {filteredStudents.length === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredStudents.length)} จาก {filteredStudents.length} คน
            </p>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <Button
                variant="secondary"
                aria-label="หน้าก่อนหน้า"
                title="หน้าก่อนหน้า"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft size={18} />
              </Button>
              <span className="min-w-24 text-center text-sm text-slate-600">หน้า {page} / {pageCount}</span>
              <Button
                variant="secondary"
                aria-label="หน้าถัดไป"
                title="หน้าถัดไป"
                disabled={page >= pageCount}
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              >
                <ChevronRight size={18} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

export default AdminStudentsPage
