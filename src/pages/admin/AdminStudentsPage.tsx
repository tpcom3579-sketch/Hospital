import { ChevronLeft, ChevronRight, Pencil, Search, Trash2, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../../components/layout/AdminLayout'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import {
  compareStudentsByClass,
  getStudentClassLevelOptions,
  getStudentClassRoomOptions,
  getStudentLevelFilter,
  getStudentRoomFilter,
} from '../../lib/studentClassUtils'
import {
  getCurrentStudentRoster,
  removeStudentFromRoster,
  updateStudentAcademicRecord,
} from '../../services/studentRepository'
import type { Student } from '../../types'

type StudentDraft = Pick<Student, 'number' | 'student_id' | 'name' | 'surname' | 'sex' | 'class_name' | 'academic_year'>

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
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [studentDraft, setStudentDraft] = useState<StudentDraft | null>(null)
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null)
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    void getCurrentStudentRoster()
      .then((students) => { if (active) setStudentDirectory(students) })
      .catch(() => { if (active) setError('โหลดรายชื่อนักเรียนไม่สำเร็จ') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const classLevels = getStudentClassLevelOptions(studentDirectory)
  const classRooms = getStudentClassRoomOptions(studentDirectory, selectedLevel)
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

  const startEditing = (student: Student) => {
    setEditingStudent(student)
    setStudentDraft({
      number: student.number,
      student_id: student.student_id,
      name: student.name,
      surname: student.surname,
      sex: student.sex,
      class_name: student.class_name,
      academic_year: student.academic_year,
    })
    setActionError('')
  }

  const saveStudent = async () => {
    if (!editingStudent || !studentDraft) return
    setSaving(true)
    setActionError('')
    try {
      const updatedStudent = await updateStudentAcademicRecord(editingStudent, studentDraft)
      setStudentDirectory((students) => students.map((student) =>
        student.student_id === editingStudent.student_id ? updatedStudent : student,
      ))
      setPage(1)
      setEditingStudent(null)
      setStudentDraft(null)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'บันทึกข้อมูลนักเรียนไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteStudent = async () => {
    if (!deletingStudent) return
    setSaving(true)
    setActionError('')
    try {
      await removeStudentFromRoster(deletingStudent.student_id)
      setStudentDirectory((students) => students.filter((student) => student.student_id !== deletingStudent.student_id))
      setPage(1)
      setDeletingStudent(null)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'ลบรายชื่อนักเรียนไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

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
              {classLevels.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
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
                  <th className="px-4 py-3">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">กำลังโหลดรายชื่อนักเรียน...</td></tr>
                ) : error ? (
                  <tr><td colSpan={7} role="alert" className="px-4 py-10 text-center text-rose-700">{error}</td></tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
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
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" className="px-3 py-2" onClick={() => startEditing(student)}>
                          <Pencil size={15} className="mr-1.5" />
                          แก้ไข
                        </Button>
                        <Button variant="danger" className="px-3 py-2" onClick={() => { setDeletingStudent(student); setActionError('') }}>
                          <Trash2 size={15} className="mr-1.5" />
                          ลบ
                        </Button>
                      </div>
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

      {editingStudent && studentDraft ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) { setEditingStudent(null); setStudentDraft(null) }
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="edit-student-title" className="my-auto w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl sm:p-7">
            <h2 id="edit-student-title" className="text-xl font-bold text-slate-900">แก้ไขข้อมูลนักเรียน</h2>
            <p className="mt-1 text-sm text-slate-500">แก้ไขข้อมูลรายชื่อปัจจุบัน ประวัติการใช้บริการจะยังคงอยู่</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Input label="เลขที่" type="number" min={1} value={studentDraft.number} onChange={(event) => setStudentDraft({ ...studentDraft, number: Number(event.target.value) })} />
              <Input label="รหัสนักเรียน" inputMode="numeric" maxLength={5} value={studentDraft.student_id} onChange={(event) => setStudentDraft({ ...studentDraft, student_id: event.target.value.replace(/\D/g, '').slice(0, 5) })} />
              <Input label="ชื่อ" value={studentDraft.name} onChange={(event) => setStudentDraft({ ...studentDraft, name: event.target.value })} />
              <Input label="นามสกุล" value={studentDraft.surname} onChange={(event) => setStudentDraft({ ...studentDraft, surname: event.target.value })} />
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-2 block">เพศ</span>
                <select value={studentDraft.sex} onChange={(event) => setStudentDraft({ ...studentDraft, sex: event.target.value === 'หญิง' ? 'หญิง' : 'ชาย' })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                  <option value="ชาย">ชาย</option>
                  <option value="หญิง">หญิง</option>
                </select>
              </label>
              <Input label="ชั้น" value={studentDraft.class_name} onChange={(event) => setStudentDraft({ ...studentDraft, class_name: event.target.value })} />
              <Input label="ปีการศึกษา" inputMode="numeric" maxLength={4} value={studentDraft.academic_year} onChange={(event) => setStudentDraft({ ...studentDraft, academic_year: event.target.value.replace(/\D/g, '').slice(0, 4) })} />
            </div>
            {actionError ? <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{actionError}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" disabled={saving} onClick={() => { setEditingStudent(null); setStudentDraft(null) }}>ยกเลิก</Button>
              <Button disabled={saving} onClick={() => void saveStudent()}>{saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</Button>
            </div>
          </section>
        </div>
      ) : null}

      {deletingStudent ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-student-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-7">
            <h2 id="delete-student-title" className="text-xl font-bold text-slate-900">ยืนยันการลบรายชื่อนักเรียน</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              ต้องการลบรายชื่อ <span className="font-semibold text-slate-900">{deletingStudent.name} {deletingStudent.surname}</span>
              {' '}รหัสนักเรียน {deletingStudent.student_id} ใช่หรือไม่?
            </p>
            <p className="mt-2 text-sm text-emerald-700">ประวัติการใช้บริการของนักเรียนจะไม่ถูกลบ</p>
            {actionError ? <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{actionError}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" disabled={saving} onClick={() => setDeletingStudent(null)}>ยกเลิก</Button>
              <Button variant="danger" disabled={saving} onClick={() => void confirmDeleteStudent()}>{saving ? 'กำลังลบ...' : 'ยืนยันลบรายชื่อ'}</Button>
            </div>
          </section>
        </div>
      ) : null}
    </AdminLayout>
  )
}

export default AdminStudentsPage
