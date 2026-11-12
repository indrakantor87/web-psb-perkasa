import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { canManageGmDailyReport, canReadGmDailyReport } from '@/lib/gm-daily-report-access'
import { ensureGmDailyReportTableOnce } from '@/lib/gm-daily-report-db'
import { parseGmReportDate, type GmDailyReportValues } from '@/lib/gm-daily-report'
import { prisma } from '@/lib/prisma'
import { unauthorizedResponse } from '@/lib/access-server'
import { jakartaNow } from '@/lib/jakarta-time'

export const runtime = 'nodejs'

const reportInputSchema = z.object({
  reportDate: z.string(),
  totalPsbList: z.number().int().nonnegative(),
  installationQueue: z.number().int().nonnegative(),
  installedToday: z.number().int().nonnegative(),
  totalCustomers: z.number().int().positive(),
  activeCustomers: z.number().int().nonnegative(),
  isolationContinued: z.number().int().nonnegative(),
  isolationNotContinued: z.number().int().nonnegative(),
  dismantleOpen: z.number().int().nonnegative(),
  dismantleClosed: z.number().int().nonnegative(),
  customerDeclinePercent: z.number().min(0).max(100),
})

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function shiftDateKey(key: string, days: number) {
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

function presentEntry(entry: {
  reportDate: Date
  createdAt: Date
  updatedAt: Date
  source: string
} & GmDailyReportValues) {
  return {
    reportDate: dateKey(entry.reportDate),
    totalPsbList: entry.totalPsbList,
    installationQueue: entry.installationQueue,
    installedToday: entry.installedToday,
    totalCustomers: entry.totalCustomers,
    activeCustomers: entry.activeCustomers,
    isolationContinued: entry.isolationContinued,
    isolationNotContinued: entry.isolationNotContinued,
    dismantleOpen: entry.dismantleOpen,
    dismantleClosed: entry.dismantleClosed,
    source: entry.source,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    customerDeclinePercent: Number(entry.customerDeclinePercent),
  }
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canReadGmDailyReport(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    await ensureGmDailyReportTableOnce()
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    if (date) {
      const normalizedDate = parseGmReportDate(date)
      if (!normalizedDate) return NextResponse.json({ error: 'Tanggal tidak valid.' }, { status: 400 })
      const entry = await prisma.gmDailyReportSnapshot.findUnique({
        where: { reportDate: new Date(`${normalizedDate}T00:00:00.000Z`) },
      })
      return NextResponse.json({ entry: entry ? presentEntry(entry) : null }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const daysRaw = Number(searchParams.get('days') ?? 30)
    const days = Number.isInteger(daysRaw) ? Math.max(1, Math.min(daysRaw, 366)) : 30
    const today = dateKey(jakartaNow())
    const startDate = shiftDateKey(today, -(days - 1))
    const endDate = shiftDateKey(today, 1)
    const entries = await prisma.gmDailyReportSnapshot.findMany({
      where: {
        reportDate: {
          gte: new Date(`${startDate}T00:00:00.000Z`),
          lt: new Date(`${endDate}T00:00:00.000Z`),
        },
      },
      orderBy: { reportDate: 'asc' },
    })
    const mappedEntries = entries.map(presentEntry)

    return NextResponse.json(
      { entries: mappedEntries, latest: mappedEntries.at(-1) ?? null, days },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('Failed to load GM daily report:', error)
    return NextResponse.json({ error: 'Gagal memuat laporan harian GM.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canManageGmDailyReport(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = reportInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Periksa kembali nilai rekap yang dimasukkan.' }, { status: 400 })
  }

  const reportDate = parseGmReportDate(parsed.data.reportDate)
  if (!reportDate) return NextResponse.json({ error: 'Tanggal rekap tidak valid.' }, { status: 400 })
  if (reportDate > dateKey(jakartaNow())) {
    return NextResponse.json({ error: 'Rekap harian tidak dapat dibuat untuk tanggal mendatang.' }, { status: 400 })
  }

  const values = parsed.data
  try {
    await ensureGmDailyReportTableOnce()
    const dateValue = new Date(`${reportDate}T00:00:00.000Z`)
    const entry = await prisma.gmDailyReportSnapshot.upsert({
      where: { reportDate: dateValue },
      create: {
        reportDate: dateValue,
        totalPsbList: values.totalPsbList,
        installationQueue: values.installationQueue,
        installedToday: values.installedToday,
        totalCustomers: values.totalCustomers,
        activeCustomers: values.activeCustomers,
        isolationContinued: values.isolationContinued,
        isolationNotContinued: values.isolationNotContinued,
        dismantleOpen: values.dismantleOpen,
        dismantleClosed: values.dismantleClosed,
        customerDeclinePercent: values.customerDeclinePercent,
        source: 'MANUAL',
        createdByUserId: session.user.id,
        createdByName: session.user.name,
        updatedByUserId: session.user.id,
        updatedByName: session.user.name,
      },
      update: {
        totalPsbList: values.totalPsbList,
        installationQueue: values.installationQueue,
        installedToday: values.installedToday,
        totalCustomers: values.totalCustomers,
        activeCustomers: values.activeCustomers,
        isolationContinued: values.isolationContinued,
        isolationNotContinued: values.isolationNotContinued,
        dismantleOpen: values.dismantleOpen,
        dismantleClosed: values.dismantleClosed,
        customerDeclinePercent: values.customerDeclinePercent,
        source: 'MANUAL',
        updatedByUserId: session.user.id,
        updatedByName: session.user.name,
      },
    })

    return NextResponse.json({ entry: presentEntry(entry) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Failed to save GM daily report:', error)
    return NextResponse.json({ error: 'Gagal menyimpan rekap harian GM.' }, { status: 500 })
  }
}
