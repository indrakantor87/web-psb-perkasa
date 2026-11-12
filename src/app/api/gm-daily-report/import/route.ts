import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getSession } from '@/lib/auth'
import { canManageGmDailyReport } from '@/lib/gm-daily-report-access'
import { unauthorizedResponse } from '@/lib/access-server'
import { ensureGmDailyReportTableOnce } from '@/lib/gm-daily-report-db'
import { parseGmReportGrid } from '@/lib/gm-daily-report'
import { prisma } from '@/lib/prisma'
import { jakartaNow } from '@/lib/jakarta-time'

export const runtime = 'nodejs'

const MAX_IMPORT_BYTES = 10 * 1024 * 1024
const MAX_IMPORT_ROWS = 1000

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canManageGmDailyReport(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Pilih file Excel atau CSV untuk diimpor.' }, { status: 400 })
  if (file.size <= 0 || file.size > MAX_IMPORT_BYTES) {
    return NextResponse.json({ error: 'Ukuran file harus lebih dari 0 dan tidak melebihi 10 MB.' }, { status: 400 })
  }
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    return NextResponse.json({ error: 'Format yang didukung: .xlsx, .xls, dan .csv.' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!firstSheet) return NextResponse.json({ error: 'Worksheet tidak ditemukan di file.' }, { status: 400 })

    const grid = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, raw: true, defval: '' })
    const merges = (firstSheet['!merges'] ?? []).map((merge) => ({ s: merge.s, e: merge.e }))
    const result = parseGmReportGrid(grid, merges)
    if (result.errors.length > 0) {
      return NextResponse.json({ error: result.errors.slice(0, 20).join(' '), rowCount: result.rows.length }, { status: 400 })
    }
    if (result.rows.length > MAX_IMPORT_ROWS) {
      return NextResponse.json({ error: `Maksimal ${MAX_IMPORT_ROWS} baris rekap per impor.` }, { status: 400 })
    }
    const today = jakartaNow().toISOString().slice(0, 10)
    if (result.rows.some((row) => row.reportDate > today)) {
      return NextResponse.json({ error: 'File berisi rekap bertanggal mendatang.' }, { status: 400 })
    }

    await ensureGmDailyReportTableOnce()
    const operations = result.rows.map((row) => {
      const reportDate = new Date(`${row.reportDate}T00:00:00.000Z`)
      const data = {
        totalPsbList: row.totalPsbList,
        installationQueue: row.installationQueue,
        installedToday: row.installedToday,
        totalCustomers: row.totalCustomers,
        activeCustomers: row.activeCustomers,
        isolationContinued: row.isolationContinued,
        isolationNotContinued: row.isolationNotContinued,
        dismantleOpen: row.dismantleOpen,
        dismantleClosed: row.dismantleClosed,
        customerDeclinePercent: row.customerDeclinePercent,
        source: 'IMPORT',
        updatedByUserId: session.user.id,
        updatedByName: session.user.name,
      }

      return prisma.gmDailyReportSnapshot.upsert({
        where: { reportDate },
        create: {
          reportDate,
          ...data,
          createdByUserId: session.user.id,
          createdByName: session.user.name,
        },
        update: data,
      })
    })
    await prisma.$transaction(operations)

    return NextResponse.json(
      {
        success: true,
        imported: result.rows.length,
        message: `${result.rows.length} tanggal berhasil diimpor atau diperbarui.`,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('Failed to import GM daily report:', error)
    return NextResponse.json({ error: 'Gagal membaca atau menyimpan file laporan GM.' }, { status: 500 })
  }
}
