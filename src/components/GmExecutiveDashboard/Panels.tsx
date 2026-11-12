import type { GmDashboardData } from './useGmDashboard'

export function HrSection({ hr }: { hr: GmDashboardData['hr'] }) {
  const attendanceRate = hr.activeEmployees > 0
    ? (hr.averagePresentPerDay / hr.activeEmployees) * 100
    : 0

  return (
    <div className="rounded-xl border border-line bg-surface p-4 text-ink shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-ink">SDM & Kehadiran</h3>
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="text-2xl font-bold text-ink">{hr.activeEmployees}</div>
          <div className="text-[11px] text-ink-muted">Karyawan Aktif Saat Ini</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{hr.averagePresentPerDay}</div>
          <div className="text-[11px] text-ink-muted">Rata-rata Hadir / Hari</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-500 dark:text-red-400">{hr.averageAbsentPerDay}</div>
          <div className="text-[11px] text-ink-muted">Rata-rata Tidak Hadir</div>
        </div>
      </div>
      {hr.attendanceDays > 0 ? (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[11px] text-ink-muted">
            <span>Rata-rata kehadiran periode</span>
            <span className="font-semibold">{attendanceRate.toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(0, Math.min(100, attendanceRate))}%` }} />
          </div>
          <div className="mt-1 text-[10px] text-ink-muted">{hr.attendanceDays} hari tercatat</div>
          <div className="text-[10px] text-ink-muted">Headcount pembanding memakai data saat ini</div>
        </div>
      ) : (
        <div className="mt-3 text-center text-[11px] text-ink-muted">Belum ada data kehadiran pada periode ini</div>
      )}
    </div>
  )
}

export function RisksTable({ risks }: { risks: GmDashboardData['risks'] }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 text-ink shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Kendala & Risiko</h3>
          <p className="text-[11px] text-ink-muted">Risiko aktif saat ini dan aktivitas periode terpilih</p>
        </div>
        {risks.length > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:bg-red-950 dark:text-red-300">{risks.length} item</span>
        )}
      </div>
      {risks.length === 0 ? (
        <div className="py-6 text-center text-sm text-ink-muted">Tidak ada risiko teridentifikasi 🎉</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line text-ink-muted">
                <th className="text-left py-2 px-2">Kategori</th>
                <th className="text-center py-2 px-2">Jumlah</th>
                <th className="text-left py-2 px-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r, i) => (
                <tr key={i} className="border-b border-line hover:bg-surface-muted">
                  <td className="px-2 py-2 font-medium text-ink">{r.category}</td>
                  <td className="py-2 px-2 text-center">
                    <span className="inline-flex min-w-[24px] items-center justify-center rounded-full bg-red-100 px-1.5 text-[11px] font-bold text-red-600 dark:bg-red-950 dark:text-red-300 h-5">
                      {r.count}
                    </span>
                  </td>
                  <td className="max-w-[200px] truncate px-2 py-2 text-ink-muted">{r.detail}</td>
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
