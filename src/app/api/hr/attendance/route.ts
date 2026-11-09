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
    const department = (url.searchParams.get('department') || '').trim()
    const employeeIdRaw = Number(url.searchParams.get('employeeId'))
    const limitRaw = Number(url.searchParams.get('limit'))
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 1000) : 500

    const where: Record<string, unknown> = {
      date: {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T23:59:59.999Z`),
      },
    }
    const isMarketing = String(session?.user.role ?? '').trim().toUpperCase() === 'MARKETING'
    if (isMarketing) {
      where.employee = { is: { userId: session?.user.id } }
    }
    if (Number.isFinite(employeeIdRaw) && employeeIdRaw > 0) {
      where.employeeId = employeeIdRaw
    }
    const employeeFilter: Record<string, unknown> = {}
    if (isMarketing) employeeFilter.userId = session?.user.id
    if (query) employeeFilter.name = { contains: query, mode: 'insensitive' }
    if (department) employeeFilter.department = department
    if (Object.keys(employeeFilter).length > 0) {
      where.employee = { is: employeeFilter }
    }

    const records = await prisma.attendance.findMany({
      where,
      include: { employee: { select: { name: true, department: true } } },
      orderBy: [{ date: 'desc' }, { employeeId: 'asc' }],
      take: limit,
    })

    const employeeIds = new Set<number>()
    let totalOvertimeMinutes = 0
    const divisionMap = new Map<string, { department: string; records: number; employees: Set<number>; overtimeMinutes: number }>()
    const items = records.map((row) => {
      const departmentName = row.employee?.department || 'Tanpa Divisi'
      employeeIds.add(row.employeeId)
      totalOvertimeMinutes += row.overtimeMinutes

      const bucket = divisionMap.get(departmentName) ?? {
        department: departmentName,
        records: 0,
        employees: new Set<number>(),
        overtimeMinutes: 0,
      }
      bucket.records += 1
      bucket.employees.add(row.employeeId)
      bucket.overtimeMinutes += row.overtimeMinutes
      divisionMap.set(departmentName, bucket)

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

    const divisions = Array.from(divisionMap.values())
      .map((bucket) => ({
        department: bucket.department,
        records: bucket.records,
        employees: bucket.employees.size,
        overtimeMinutes: bucket.overtimeMinutes,
      }))
      .sort((a, b) => a.department.localeCompare(b.department))

    const employees = await prisma.employee.findMany({
      where: isMarketing ? { userId: session?.user.id } : undefined,
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
      divisions,
      employees: employees.map((employee) => ({
        ...employee,
        fingerprintId: isMarketing ? null : employee.fingerprintId,
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Gagal memuat data absensi' }, { status: 500 })
  }
}
