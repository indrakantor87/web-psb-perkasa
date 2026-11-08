import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { ensureMenuAccess, ensureMenuMutation } from '@/lib/access-server'
import { ensureHrSchemaOnce } from '@/lib/hr-schema'
import {
  DEFAULT_HR_DIVISION,
  isKnownDivision,
  isKnownEmploymentStatus,
} from '@/lib/hr-departments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function asTrimmed(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isUniqueError(error: unknown) {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
}

function isNotFoundError(error: unknown) {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2025'
}

function parseJoinDate(value: unknown): Date | null {
  const raw = asTrimmed(value)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function GET(request: Request) {
  const session = await getSession()
  const accessError = ensureMenuAccess(session, 'hr')
  if (accessError) return accessError

  try {
    await ensureHrSchemaOnce()

    const url = new URL(request.url)
    const query = asTrimmed(url.searchParams.get('q'))
    const department = asTrimmed(url.searchParams.get('department'))
    const includeInactive = url.searchParams.get('inactive') === '1'

    const where: Prisma.EmployeeWhereInput = {}
    if (!includeInactive) where.isActive = true
    if (department) where.department = department
    if (query) where.name = { contains: query, mode: 'insensitive' }

    const employees = await prisma.employee.findMany({
      where,
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        department: true,
        position: true,
        employmentStatus: true,
        joinDate: true,
        fingerprintId: true,
        isActive: true,
        _count: { select: { attendances: true } },
      },
    })

    return NextResponse.json({
      employees: employees.map((employee) => ({
        id: employee.id,
        name: employee.name,
        department: employee.department,
        position: employee.position,
        employmentStatus: employee.employmentStatus,
        joinDate: employee.joinDate,
        fingerprintId: employee.fingerprintId,
        isActive: employee.isActive,
        attendanceCount: employee._count.attendances,
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Gagal memuat daftar karyawan' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  const accessError = ensureMenuMutation(session, 'hr')
  if (accessError) return accessError

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const name = asTrimmed(body.name)
  const department = asTrimmed(body.department) || DEFAULT_HR_DIVISION
  const position = asTrimmed(body.position) || 'STAFF'
  const employmentStatus = asTrimmed(body.employmentStatus) || 'Karyawan'
  const fingerprintId = asTrimmed(body.fingerprintId)
  const joinDate = parseJoinDate(body.joinDate)

  if (!name) {
    return NextResponse.json({ error: 'Nama karyawan wajib diisi' }, { status: 400 })
  }
  if (!isKnownDivision(department)) {
    return NextResponse.json({ error: 'Divisi tidak valid' }, { status: 400 })
  }
  if (!isKnownEmploymentStatus(employmentStatus)) {
    return NextResponse.json({ error: 'Status kepegawaian tidak valid' }, { status: 400 })
  }
  if (body.joinDate && !joinDate) {
    return NextResponse.json({ error: 'Tanggal masuk tidak valid' }, { status: 400 })
  }

  try {
    await ensureHrSchemaOnce()
    const created = await prisma.employee.create({
      data: {
        name,
        department,
        position,
        employmentStatus,
        joinDate: joinDate ?? new Date(),
        fingerprintId: fingerprintId || null,
        isActive: body.isActive !== false,
      },
    })
    return NextResponse.json({ employee: created })
  } catch (error) {
    if (isUniqueError(error)) {
      return NextResponse.json({ error: 'ID fingerprint sudah dipakai karyawan lain' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Gagal menyimpan karyawan' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getSession()
  const accessError = ensureMenuMutation(session, 'hr')
  if (accessError) return accessError

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = Number(body.id)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'ID karyawan tidak valid' }, { status: 400 })
  }

  const data: Prisma.EmployeeUpdateInput = {}

  if (body.name !== undefined) {
    const name = asTrimmed(body.name)
    if (!name) return NextResponse.json({ error: 'Nama karyawan wajib diisi' }, { status: 400 })
    data.name = name
  }
  if (body.department !== undefined) {
    const department = asTrimmed(body.department)
    if (!isKnownDivision(department)) {
      return NextResponse.json({ error: 'Divisi tidak valid' }, { status: 400 })
    }
    data.department = department
  }
  if (body.position !== undefined) {
    data.position = asTrimmed(body.position) || 'STAFF'
  }
  if (body.employmentStatus !== undefined) {
    const employmentStatus = asTrimmed(body.employmentStatus)
    if (!isKnownEmploymentStatus(employmentStatus)) {
      return NextResponse.json({ error: 'Status kepegawaian tidak valid' }, { status: 400 })
    }
    data.employmentStatus = employmentStatus
  }
  if (body.fingerprintId !== undefined) {
    data.fingerprintId = asTrimmed(body.fingerprintId) || null
  }
  if (body.joinDate !== undefined) {
    const joinDate = parseJoinDate(body.joinDate)
    if (!joinDate) return NextResponse.json({ error: 'Tanggal masuk tidak valid' }, { status: 400 })
    data.joinDate = joinDate
  }
  if (body.isActive !== undefined) {
    data.isActive = body.isActive !== false
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 })
  }

  try {
    await ensureHrSchemaOnce()
    const updated = await prisma.employee.update({ where: { id }, data })
    return NextResponse.json({ employee: updated })
  } catch (error) {
    if (isUniqueError(error)) {
      return NextResponse.json({ error: 'ID fingerprint sudah dipakai karyawan lain' }, { status: 409 })
    }
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Gagal memperbarui karyawan' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSession()
  const accessError = ensureMenuMutation(session, 'hr')
  if (accessError) return accessError

  const url = new URL(request.url)
  const id = Number(url.searchParams.get('id'))
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'ID karyawan tidak valid' }, { status: 400 })
  }

  try {
    await ensureHrSchemaOnce()
    const attendanceCount = await prisma.attendance.count({ where: { employeeId: id } })
    if (attendanceCount > 0) {
      return NextResponse.json(
        { error: 'Karyawan memiliki riwayat absensi. Nonaktifkan saja agar riwayat tetap utuh.' },
        { status: 409 }
      )
    }
    await prisma.employee.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Gagal menghapus karyawan' }, { status: 500 })
  }
}
