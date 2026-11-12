import type { GmDashboardData } from './useGmDashboard'

export function HrSection({ hr }: { hr: GmDashboardData['hr'] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">SDM & Kehadiran</h3>
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-800">{hr.activeEmployees}</div>
          <div className="text-[11px] text-slate-400">Karyawan Aktif</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-600">{hr.presentToday}</div>
          <div className="text-[11px] text-slate-400">Hadir Hari Ini</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-500">{hr.absentToday}</div>
          <div className="text-[11px] text-slate-400">Tidak Hadir</div>
        </div>
      </div>
      {hr.activeEmployees > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-slate-500 mb-1">
            <span>Tingkat Kehadiran</span>
            <span className="font-semibold">{((hr.presentToday / hr.activeEmployees) * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (hr.presentToday / hr.activeEmployees) * 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}

export function RisksTable({ risks }: { risks: GmDashboardData['risks'] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Kendala & Risiko Utama</h3>
        {risks.length > 0 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">{risks.length} item</span>
        )}
      </div>
      {risks.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-6">Tidak ada risiko teridentifikasi 🎉</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="text-left py-2 px-2">Kategori</th>
                <th className="text-center py-2 px-2">Jumlah</th>
                <th className="text-left py-2 px-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-2 font-medium text-slate-700">{r.category}</td>
                  <td className="py-2 px-2 text-center">
                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded-full bg-red-100 text-red-600 font-bold text-[11px]">
                      {r.count}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-slate-500 truncate max-w-[200px]">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function ExecutiveSummary({ summary }: { summary: string }) {
  return (
    <div className="rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 p-4 text-white shadow-sm">
      <div className="flex items-start gap-3">
        <div className="text-2xl">📊</div>
        <div>
          <h3 className="text-sm font-bold mb-1">Ringkasan Eksekutif</h3>
          <p className="text-xs text-slate-200 leading-relaxed">{summary}</p>
        </div>
      </div>
    </div>
  )
}
