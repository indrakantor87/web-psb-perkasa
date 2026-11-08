import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { ensureMenuAccess } from '@/lib/access-server'
import { ensureHrSchemaOnce } from '@/lib/hr-schema'
import { JAKARTA_OFFSET_MS } from '@/lib/jakarta-time'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function defaultRange() {
  const nowWIB = new Date(Date.now() + JAKARTA_OFFSET_MS)
  const year = nowWIB.getUTCFullYear()
  const month = nowWIB.getUTCMonth() + 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const pad = (value: number) => String(value).padStart(2, '0')
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDay)}`,
  }
}

export async function GET(request: Request) {
  const session = await getSession()
  const accessError = ensureMenuAccess(session, 'hr')
  if (accessError) return accessError

  try {
    await ensureHrSchemaOnce()

    const url = new URL(request.url)
    const fallback = defaultRange()
    const fromParam = (url.searchParams.get('from') || '').trim()
    const toParam = (url.searchParams.get('to') || '').trim()
    const from = DATE_PATTERN.test(fromParam) ? fromParam : fallback.from
    const to = DATE_PATTERN.test(toParam) ? toParam : fallback.to
    const query = (url.searchParams.get('q') || '').trim()
    const employeeIdRaw = Number(url.searchParams.get('employeeId'))
    const limitRaw = Number(url.searchParams.get('limit'))
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 1000) : 500

    const where: Record<string, unknown> = {
      date: {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T23:59:59.999Z`),
      },
    }
    if (Number.isFinite(employeeIdRaw) && employeeIdRaw > 0) {
      where.employeeId = employeeIdRaw
    }
    if (query) {
      where.employee = { is: { name: { contains: query, mode: 'insensitive' } } }
    }

    const records = await prisma.attendance.findMany({
      where,
      include: { employee: { select: { name: true, department: true } } },
      orderBy: [{ date: 'desc' }, { employeeId: 'asc' }],
      take: limit,
    })

    const employeeIds = new Set<number>()
    let totalOvertimeMinutes = 0
    const items = records.map((row) => {
      employeeIds.add(row.employeeId)
      totalOvertimeMinutes += row.overtimeMinutes
      return {
        id: row.id,
        date: row.date,
        employeeId: row.employeeId,
        employeeName: row.employee?.name ?? `Karyawan #${row.employeeId}`,
        department: row.employee?.department ?? '',
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        status: row.status,
        source: row.source,
        overtimeMinutes: row.overtimeMinutes,
      }
    })

    const employees = await prisma.employee.findMany({
      select: { id: true, name: true, department: true, fingerprintId: true, isActive: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      items,
      range: { from, to },
      summary: {
        totalRecords: items.length,
        totalEmployees: employeeIds.size,
        totalOvertimeMinutes,
      },
      employees,
    })
  } catch {
    return NextResponse.json({ error: 'Gagal memuat data absensi' }, { status: 500 })
  }
}
