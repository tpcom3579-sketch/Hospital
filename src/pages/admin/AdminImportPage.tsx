import { useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react'
import { AdminLayout } from '../../components/layout/AdminLayout'
import { Button } from '../../components/ui/Button'
import { isSupabaseConfigured } from '../../lib/supabase'
import { downloadStudentTemplate } from '../../services/fileExportService'
import { commitStudentRoster, previewStudentImport } from '../../services/studentImportService'
import type { StudentImportRow } from '../../services/studentImportService'

const steps = ['Upload XLSX', 'ตรวจสอบ Column', 'ตรวจข้อมูลซ้ำ', 'Preview', 'Confirm Import']
const MAX_FILE_SIZE = 10 * 1024 * 1024

const statusLabels = {
  new: 'ข้อมูลใหม่',
  same: 'เหมือนข้อมูลเดิม',
  changed: 'ข้อมูลเปลี่ยน',
  invalid: 'ข้อมูลผิดพลาด',
} satisfies Record<StudentImportRow['status'], string>

function AdminImportPage() {
  const [step, setStep] = useState(0)
  const [academicYear, setAcademicYear] = useState('2569')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<StudentImportRow[]>([])
  const [error, setError] = useState('')
  const [importedCount, setImportedCount] = useState(0)
  const [studentCount, setStudentCount] = useState(0)
  const [isReading, setIsReading] = useState(false)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const counts = rows.reduce(
    (total, row) => ({ ...total, [row.status]: total[row.status] + 1 }),
    { new: 0, same: 0, changed: 0, invalid: 0 },
  )

  async function handleFile(file?: File) {
    if (!file) return
    setError('')

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('เลือกไฟล์ Excel นามสกุล .xlsx')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('ไฟล์ต้องมีขนาดไม่เกิน 10 MB')
      return
    }

    setIsReading(true)
    try {
      const preview = await previewStudentImport(file, academicYear)
      setRows(preview)
      setFileName(file.name)
      setStep(1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'อ่านไฟล์ไม่สำเร็จ กรุณาตรวจสอบไฟล์แล้วลองใหม่')
    } finally {
      setIsReading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function changeAction(rowNumber: number, action: 'update' | 'keep') {
    setRows((currentRows) => currentRows.map((row) =>
      row.rowNumber === rowNumber ? { ...row, action } : row,
    ))
  }

  async function confirmImport() {
    try {
      const result = await commitStudentRoster(rows)
      setImportedCount(result.newStudentCount)
      setStudentCount(result.studentCount)
      setError('')
      setStep(4)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'นำเข้ารายชื่อไม่สำเร็จ กรุณาลองใหม่')
    }
  }

  function resetImport() {
    setStep(0)
    setRows([])
    setFileName('')
    setError('')
  }

  async function downloadTemplate() {
    setIsDownloadingTemplate(true)
    setError('')
    try {
      await downloadStudentTemplate(academicYear)
    } catch {
      setError('สร้างไฟล์แม่แบบไม่สำเร็จ')
    } finally {
      setIsDownloadingTemplate(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import</h1>
          <p className={`mt-1 text-sm ${isSupabaseConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
            {isSupabaseConfigured ? 'ข้อมูลจะบันทึกลง Supabase' : 'โหมดทดสอบ: ข้อมูลจะเก็บในเบราว์เซอร์นี้'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="sticky top-0 z-20 mb-4 rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm backdrop-blur-sm sm:mb-6">
            <div className="flex flex-wrap gap-2">
              {steps.map((label, index) => (
                <div
                  key={label}
                  className={`rounded-full px-2.5 py-1.5 text-[11px] font-medium sm:px-3 sm:text-sm ${
                    index <= step ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {index + 1}. {label}
                </div>
              ))}
            </div>
          </div>

          {step === 0 ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
                <label className="text-sm font-medium text-slate-700">
                  <span className="mb-2 block">ปีสำรองเมื่อไม่มีปีในไฟล์</span>
                  <input
                    value={academicYear}
                    onChange={(event) => setAcademicYear(event.target.value)}
                    inputMode="numeric"
                    maxLength={4}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                  />
                </label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 leading-relaxed">
                  ใช้คอลัมน์ Number → Student_ID → Sex → Name → Surname → Class; อ่านปีจากข้อความด้านบน และรองรับเพศ ช./ญ.
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
              <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center sm:p-8">
                <FileSpreadsheet className="mx-auto text-emerald-700" size={32} />
                <p className="mt-3 text-base font-semibold text-slate-700 sm:text-lg">เลือกไฟล์รายชื่อนักเรียน</p>
                <p className="mt-2 text-sm text-slate-500">รองรับ .xlsx ขนาดไม่เกิน 10 MB</p>
                <div className="mt-5 flex justify-center">
                  <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
                    <Button className="w-full sm:w-auto" disabled={isReading} onClick={() => fileInputRef.current?.click()}>
                      <Upload size={16} className="mr-2" />
                      {isReading ? 'กำลังอ่านไฟล์...' : 'เลือกไฟล์'}
                    </Button>
                    <Button className="w-full sm:w-auto" variant="secondary" disabled={isDownloadingTemplate} onClick={() => void downloadTemplate()}>
                      {isDownloadingTemplate ? 'กำลังสร้างแม่แบบ...' : 'ดาวน์โหลดแม่แบบ'}
                    </Button>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-left text-xs leading-relaxed text-blue-900 sm:text-sm">
                  <p className="font-semibold">ตัวอย่างข้อมูลแต่ละคอลัมน์ในไฟล์แม่แบบ</p>
                  <p className="mt-1">Number: 1 · Student_ID: 30001 · Sex: ชาย หรือ หญิง · Name: ชื่อจริง · Surname: นามสกุล</p>
                  <p>Class: ม.1/4, 1/7 หรือ ม.1/SMTE (ให้มี / คั่นระหว่างชั้นกับห้อง)</p>
                  <p className="mt-1">แถวที่ขึ้นต้นว่า “ตัวอย่าง (ลบก่อนนำเข้า)” เป็นข้อมูลสาธิต ระบบจะข้ามให้อัตโนมัติ</p>
                </div>
              </div>
              {error ? <ErrorMessage message={error} /> : null}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                <CheckCircle2 size={20} />
                <div>
                  <h3 className="font-bold">อ่านไฟล์สำเร็จ</h3>
                  <p className="text-sm">{fileName} · {rows.length} แถว · ตรวจพบคอลัมน์ที่จำเป็นครบ</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <CountTile label="ข้อมูลใหม่" value={counts.new} />
                <CountTile label="ข้อมูลเหมือนเดิม" value={counts.same} />
                <CountTile label="ข้อมูลเปลี่ยน" value={counts.changed} />
                <CountTile label="ข้อมูลผิดพลาด" value={counts.invalid} />
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setStep(0)}>ย้อนกลับ</Button>
                <Button className="w-full sm:w-auto" onClick={() => setStep(2)}>ต่อไป</Button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">ตรวจข้อมูลซ้ำและความถูกต้อง</h3>
                <p className="mt-1 text-sm text-slate-500">ข้อมูลที่เปลี่ยนเลือกได้ว่าจะใช้ข้อมูลใหม่หรือเก็บข้อมูลเดิม ต้องแก้แถวผิดพลาดก่อนจึงยืนยันได้</p>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-0 text-left text-[11px] sm:text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-2 py-2.5 sm:px-4 sm:py-3">แถว</th>
                        <th className="hidden px-2 py-2.5 md:table-cell sm:px-4 sm:py-3">Number</th>
                        <th className="hidden px-2 py-2.5 lg:table-cell sm:px-4 sm:py-3">Student_ID</th>
                        <th className="px-2 py-2.5 sm:px-4 sm:py-3">Sex</th>
                        <th className="px-2 py-2.5 sm:px-4 sm:py-3">Name</th>
                        <th className="px-2 py-2.5 sm:px-4 sm:py-3">Surname</th>
                        <th className="px-2 py-2.5 sm:px-4 sm:py-3">Class</th>
                        <th className="hidden px-2 py-2.5 xl:table-cell sm:px-4 sm:py-3">Academic_Year</th>
                        <th className="px-2 py-2.5 sm:px-4 sm:py-3">Status</th>
                        <th className="px-2 py-2.5 sm:px-4 sm:py-3">รายละเอียด / การตัดสินใจ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.rowNumber} className="border-t border-slate-200 align-top">
                          <td className="px-2 py-2.5 sm:px-4 sm:py-3">{row.rowNumber}</td>
                          <td className="hidden px-2 py-2.5 md:table-cell sm:px-4 sm:py-3">{row.student?.number ?? '-'}</td>
                          <td className="hidden px-2 py-2.5 lg:table-cell sm:px-4 sm:py-3">{row.student?.student_id ?? '-'}</td>
                          <td className="px-2 py-2.5 sm:px-4 sm:py-3">{row.student?.sex ?? '-'}</td>
                          <td className="px-2 py-2.5 sm:px-4 sm:py-3">{row.student?.name ?? '-'}</td>
                          <td className="px-2 py-2.5 sm:px-4 sm:py-3">{row.student?.surname ?? '-'}</td>
                          <td className="px-2 py-2.5 sm:px-4 sm:py-3">{row.student?.class_name ?? '-'}</td>
                          <td className="hidden px-2 py-2.5 xl:table-cell sm:px-4 sm:py-3">{row.student?.academic_year ?? '-'}</td>
                          <td className="px-2 py-2.5 sm:px-4 sm:py-3">
                            <span className={`inline-block rounded-full px-2 py-1 text-[10px] font-medium sm:text-xs ${
                              row.status === 'new' ? 'bg-emerald-100 text-emerald-700' :
                                row.status === 'same' ? 'bg-slate-100 text-slate-700' :
                                  row.status === 'changed' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700'
                            }`}>
                              {statusLabels[row.status]}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 sm:px-4 sm:py-3">
                            {row.status === 'changed' ? (
                              <label className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <span className="sr-only">เลือกการจัดการข้อมูลที่เปลี่ยน</span>
                                <select
                                  value={row.action}
                                  onChange={(event) => changeAction(row.rowNumber, event.target.value as 'update' | 'keep')}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 sm:w-auto"
                                >
                                  <option value="keep">เก็บข้อมูลเดิม</option>
                                  <option value="update">ใช้ข้อมูลใหม่</option>
                                </select>
                                <span className="text-[10px] text-slate-500 sm:text-xs">เปลี่ยน: {row.details.join(', ')}</span>
                              </label>
                            ) : row.details.length > 0 ? (
                              <span className="text-[11px] text-rose-700 sm:text-xs">{row.details.join(' · ')}</span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setStep(1)}>ย้อนกลับ</Button>
                <Button className="w-full sm:w-auto" onClick={() => setStep(3)}>ต่อไป</Button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Preview</h3>
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                เพิ่มนักเรียนจากไฟล์นี้ได้หลายครั้งในปีการศึกษาเดียวกัน รายชื่อเดิมที่ไม่ได้อยู่ในไฟล์จะยังคงอยู่
              </p>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm text-slate-600">ไฟล์: {fileName}</p>
                <p className="mt-2 text-sm text-slate-600">เพิ่มข้อมูลใหม่: {counts.new} รายการ</p>
                <p className="mt-2 text-sm text-slate-600">อัปเดตข้อมูลเดิม: {rows.filter((row) => row.status === 'changed' && row.action === 'update').length} รายการ</p>
                <p className="mt-2 text-sm text-slate-600">เก็บข้อมูลเดิม/แถวผิดพลาด: {counts.same + rows.filter((row) => row.status === 'changed' && row.action === 'keep').length} รายการซ้ำ, {counts.invalid} แถวผิดพลาด</p>
              </div>
              {error ? <ErrorMessage message={error} /> : null}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setStep(2)}>ย้อนกลับ</Button>
                <Button className="w-full sm:w-auto" disabled={counts.invalid > 0} onClick={() => void confirmImport()}>ยืนยันนำเข้า</Button>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Confirm Import</h3>
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                เพิ่มนักเรียนใหม่ {importedCount} คน · roster ปีการศึกษานี้ทั้งหมด {studentCount} คน
              </div>
              <div className="flex justify-end">
                <Button className="w-full sm:w-auto" onClick={resetImport}>นำเข้าไฟล์อื่น</Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AdminLayout>
  )
}

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
      <AlertCircle size={18} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

export default AdminImportPage
