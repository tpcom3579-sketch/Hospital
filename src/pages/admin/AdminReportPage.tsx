import { useEffect, useState } from 'react'
import { AdminLayout } from '../../components/layout/AdminLayout'
import { isSupabaseConfigured } from '../../lib/supabase'
import { getIllnessStatistics } from '../../services/fileExportService'

function AdminReportPage() {
  const [academicYear, setAcademicYear] = useState('2569')
  const [semesters, setSemesters] = useState<Awaited<ReturnType<typeof getIllnessStatistics>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void getIllnessStatistics(academicYear)
      .then((result) => { if (active) setSemesters(result) })
      .catch(() => { if (active) setError('โหลดรายงานสถิติไม่สำเร็จ') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [academicYear])

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Report</h1>
          <p className={`mt-1 text-sm ${isSupabaseConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
            {isSupabaseConfigured ? 'คำนวณจากข้อมูล Supabase' : 'โหมดทดสอบ: คำนวณจากข้อมูลในเบราว์เซอร์นี้'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <select value={academicYear} onChange={(event) => { setAcademicYear(event.target.value); setLoading(true); setError('') }} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
              <option value="2568">ปีการศึกษา 2568</option>
              <option value="2569">ปีการศึกษา 2569</option>
            </select>
            <p className="text-sm text-slate-500">เทอม 1: พฤษภาคม–กันยายน · เทอม 2: ตุลาคม–มีนาคม</p>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            {loading ? <p className="text-sm text-slate-500">กำลังโหลดข้อมูลสถิติ...</p> : null}
            {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
            {semesters.map((semester) => (
              <section key={semester.semester} className="min-w-0 border-t border-slate-200 pt-5">
                <h2 className="font-bold text-slate-900">ภาคเรียนที่ {semester.semester}</h2>
                <p className="mt-1 text-sm text-slate-500">จำนวน {semester.visitTotal} ครั้ง · ชาย {semester.totals.male} · หญิง {semester.totals.female}</p>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr><th className="px-3 py-2">เดือน</th><th className="px-3 py-2">ชาย</th><th className="px-3 py-2">หญิง</th><th className="px-3 py-2">รวม</th></tr>
                    </thead>
                    <tbody>
                      {semester.months.map((month) => (
                        <tr key={month.month} className="border-t border-slate-200">
                          <td className="px-3 py-2">{month.label}</td><td className="px-3 py-2">{month.male}</td><td className="px-3 py-2">{month.female}</td><td className="px-3 py-2">{month.male + month.female}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 grid gap-5 md:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">อาการ / การปฐมพยาบาล</h3>
                    <div className="mt-2 divide-y divide-slate-100">
                      {semester.symptomTotals.map((item) => <div key={item.id} className="flex justify-between gap-3 py-1.5 text-sm"><span>{item.label}</span><span className="font-medium">{item.count}</span></div>)}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">หมายเหตุ</h3>
                    <div className="mt-2 divide-y divide-slate-100">
                      {semester.noteTotals.map((item, index) => <div key={`${item.id}-${index}`} className="flex justify-between gap-3 py-1.5 text-sm"><span>{item.label}</span><span className="font-medium">{item.count}</span></div>)}
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>

        </div>
      </div>
    </AdminLayout>
  )
}

export default AdminReportPage
