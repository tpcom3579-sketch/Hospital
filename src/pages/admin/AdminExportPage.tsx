import { useEffect, useState } from 'react'
import { AdminLayout } from '../../components/layout/AdminLayout'
import { Button } from '../../components/ui/Button'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
  downloadHistoryExampleWorkbook,
  downloadIllnessStatisticsWorkbook,
  getExportAvailability,
  getHistoryRecordCount,
  getIllnessStatistics,
  printHistoryExamplePdf,
  printIllnessStatisticsPdf,
} from '../../services/fileExportService'

function formatDateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function AdminExportPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [semesters, setSemesters] = useState<Awaited<ReturnType<typeof getIllnessStatistics>>>([])
  const [historyRecordCount, setHistoryRecordCount] = useState<number | null>(null)
  const [historyChecking, setHistoryChecking] = useState(true)
  const [historyCheckError, setHistoryCheckError] = useState('')
  const [statisticsChecking, setStatisticsChecking] = useState(true)
  const [statisticsError, setStatisticsError] = useState('')
  const [availableDates, setAvailableDates] = useState<{ first: string; last: string } | null>(null)
  const [availableAcademicYears, setAvailableAcademicYears] = useState<string[]>([])
  const [availabilityChecking, setAvailabilityChecking] = useState(true)
  const [availabilityError, setAvailabilityError] = useState('')
  const hasIllnessData = semesters.some((semester) => semester.visitTotal > 0)
  const invalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo)

  useEffect(() => {
    let active = true
    void getExportAvailability()
      .then((availability) => {
        if (!active) return
        if (availability.firstServiceDate && availability.lastServiceDate) {
          setAvailableDates({ first: availability.firstServiceDate, last: availability.lastServiceDate })
          setDateFrom(availability.firstServiceDate)
          setDateTo(availability.lastServiceDate)
        } else {
          setHistoryRecordCount(0)
          setHistoryChecking(false)
        }
        setAvailableAcademicYears(availability.academicYears)
        if (availability.academicYears.length > 0) {
          setAcademicYear(availability.academicYears[0])
        } else {
          setStatisticsChecking(false)
        }
      })
      .catch(() => {
        if (!active) return
        setAvailabilityError('โหลดช่วงวันที่และปีการศึกษาที่มีข้อมูลไม่สำเร็จ')
        setHistoryChecking(false)
        setStatisticsChecking(false)
      })
      .finally(() => { if (active) setAvailabilityChecking(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (invalidDateRange || !dateFrom || !dateTo) return
    let active = true
    void getHistoryRecordCount(dateFrom, dateTo)
      .then((count) => { if (active) setHistoryRecordCount(count) })
      .catch(() => { if (active) setHistoryCheckError('ตรวจสอบข้อมูลประวัติไม่สำเร็จ') })
      .finally(() => { if (active) setHistoryChecking(false) })
    return () => { active = false }
  }, [dateFrom, dateTo, invalidDateRange])

  useEffect(() => {
    let active = true
    void getIllnessStatistics(academicYear)
      .then((reports) => { if (active) setSemesters(reports) })
      .catch(() => {
        if (!active) return
        setSemesters([])
        setStatisticsError('โหลดข้อมูลสถิติไม่สำเร็จ')
      })
      .finally(() => { if (active) setStatisticsChecking(false) })
    return () => { active = false }
  }, [academicYear])

  async function exportServiceXlsx() {
    setBusy(true)
    setError('')
    try {
      await downloadHistoryExampleWorkbook(dateFrom, dateTo)
    } catch {
      setError('สร้างไฟล์ Excel ไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  async function exportReportXlsx() {
    setBusy(true)
    setError('')
    try {
      await downloadIllnessStatisticsWorkbook(academicYear)
    } catch {
      setError('สร้างไฟล์รายงานไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  function exportServicePdf() {
    setError('')
    void printHistoryExamplePdf(dateFrom, dateTo).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'สร้าง PDF ไม่สำเร็จ')
    })
  }

  function exportReportPdf() {
    setError('')
    void printIllnessStatisticsPdf(academicYear).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'สร้าง PDF ไม่สำเร็จ')
    })
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Export</h1>
          <p className={`mt-1 text-sm ${isSupabaseConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
            {isSupabaseConfigured ? 'ส่งออกจากข้อมูล Supabase' : 'โหมดทดสอบ: ส่งออกจากข้อมูลในเบราว์เซอร์นี้'}
          </p>
        </div>
        {availabilityError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{availabilityError}</p> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-bold text-slate-900">ประวัติบริการ</h2>
            <p className="mb-4 text-sm text-slate-500">Excel รวมยอดทุกคน · PDF แบ่งหน้า หน้าละไม่เกิน 10 คน</p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                <span className="mb-2 block">วันที่เริ่มต้น</span>
                <input value={dateFrom} min={availableDates?.first} max={availableDates?.last} disabled={!availableDates || availabilityChecking} onChange={(event) => { setDateFrom(event.target.value); setHistoryRecordCount(null); setHistoryChecking(true); setHistoryCheckError('') }} type="date" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 disabled:cursor-not-allowed disabled:opacity-60" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                <span className="mb-2 block">วันที่สิ้นสุด</span>
                <input value={dateTo} min={availableDates?.first} max={availableDates?.last} disabled={!availableDates || availabilityChecking} onChange={(event) => { setDateTo(event.target.value); setHistoryRecordCount(null); setHistoryChecking(true); setHistoryCheckError('') }} type="date" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 disabled:cursor-not-allowed disabled:opacity-60" />
              </label>
            </div>
            <div className="mt-4 flex gap-3">
              <Button disabled={busy || availabilityChecking || !availableDates || invalidDateRange || historyChecking || historyRecordCount === null || historyRecordCount === 0} onClick={() => void exportServiceXlsx()}>
                {busy ? 'กำลังสร้างไฟล์...' : 'ดาวน์โหลด XLSX'}
              </Button>
              <Button variant="secondary" disabled={availabilityChecking || !availableDates || invalidDateRange || historyChecking || historyRecordCount === null || historyRecordCount === 0} onClick={exportServicePdf}>พิมพ์ / บันทึก PDF</Button>
            </div>
            {invalidDateRange ? <p className="mt-3 text-sm text-rose-700">วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด</p> : null}
            {availabilityChecking || (historyChecking && !invalidDateRange) ? <p role="status" className="mt-3 text-sm text-slate-500">กำลังตรวจสอบข้อมูลในช่วงวันที่...</p> : null}
            {historyCheckError ? <p role="alert" className="mt-3 text-sm text-rose-700">{historyCheckError}</p> : null}
            {!availabilityChecking && !availabilityError && !availableDates ? <p role="status" className="mt-3 text-sm text-amber-800">ไม่มีข้อมูลประวัติบริการในระบบ</p> : null}
            {!invalidDateRange && !historyChecking && !historyCheckError && Boolean(availableDates) && historyRecordCount === 0 ? (
              <p role="status" className="mt-3 text-sm text-amber-800">
                ไม่มีข้อมูลประวัติบริการตั้งแต่ {formatDateLabel(dateFrom)} ถึง {formatDateLabel(dateTo)}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-bold text-slate-900">สถิติการเจ็บป่วย</h2>
            <p className="mb-4 text-sm text-slate-500">Excel มีทั้ง 2 เทอม · PDF แยกเทอมละหน้า</p>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">
                <span className="mb-2 block">ปีการศึกษา</span>
                <select aria-label="ปีการศึกษา" value={academicYear} disabled={availabilityChecking || availableAcademicYears.length === 0} onChange={(event) => { setAcademicYear(event.target.value); setSemesters([]); setStatisticsChecking(true); setStatisticsError(''); setError('') }} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 disabled:cursor-not-allowed disabled:opacity-60">
                  {availableAcademicYears.length === 0 ? <option value="">ไม่มีปีการศึกษาที่มีข้อมูล</option> : null}
                  {availableAcademicYears.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                เทอม 1: พ.ค. – ก.ย.<br />เทอม 2: ต.ค. – มี.ค.
              </div>
            </div>
            {availabilityChecking || statisticsChecking ? <p role="status" className="mt-4 text-sm text-slate-500">กำลังตรวจสอบข้อมูลปีการศึกษา...</p> : null}
            {statisticsError ? <p role="alert" className="mt-4 text-sm text-rose-700">{statisticsError}</p> : null}
            {!availabilityChecking && !availabilityError && availableAcademicYears.length === 0 ? (
              <p role="status" className="mt-4 text-sm text-amber-800">ไม่มีข้อมูลการเจ็บป่วยในระบบ</p>
            ) : null}
            {!availabilityChecking && !statisticsChecking && !statisticsError && Boolean(academicYear) && !hasIllnessData ? (
              <p role="status" className="mt-4 text-sm text-amber-800">ไม่มีข้อมูลการเจ็บป่วยของปีการศึกษา {academicYear} ในระบบ</p>
            ) : null}
            <div className="mt-4 flex gap-3">
              <Button disabled={availabilityChecking || statisticsChecking || !academicYear || Boolean(statisticsError) || !hasIllnessData} onClick={exportReportPdf}>พิมพ์ / บันทึก PDF</Button>
              <Button variant="secondary" disabled={busy || availabilityChecking || statisticsChecking || !academicYear || Boolean(statisticsError) || !hasIllnessData} onClick={() => void exportReportXlsx()}>
                {busy ? 'กำลังสร้างไฟล์...' : 'ดาวน์โหลด XLSX'}
              </Button>
            </div>
          </div>
        </div>
        {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
      </div>
    </AdminLayout>
  )
}

export default AdminExportPage
