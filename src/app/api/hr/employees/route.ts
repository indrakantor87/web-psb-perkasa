import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { ensureMenuAccess, ensureMenuMutation } from '@/lib/access-server'
import { canAccessHrEmployees, canMutateMenu } from '@/lib/access'
import { ensureHrSchemaOnce } from '@/lib/hr-schema'
import { resolveUniqueEmployeeIdByName, resolveUniqueMarketingEmployeeId } from '@/lib/hr-employee-owner'
import {
  DEFAULT_HR_DIVISION,
  isKnownDivision,
  isKnownEmploymentStatus,
  isKnownHrSubdivision,
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

function parseUserId(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : null
  if (typeof value === 'string') {
    const num = Number(value)
    return Number.isInteger(num) && num > 0 ? num : null
  }
  return null
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
    const role = String(session?.user.role ?? '').trim().toUpperCase()
    // Developer, Priority, Admin, dan HR dapat melihat semua karyawan.
    // Role lain hanya dapat melihat data karyawannya sendiri (fail-closed).
    const isSelfOnly = !canAccessHrEmployees(role)
    const canManage = canMutateMenu(role, 'hr')
    const selfEmployeeId = isSelfOnly
      ? role === 'MARKETING'
        ? await resolveUniqueMarketingEmployeeId(session!.user.id, session!.user.name)
        : await resolveUniqueEmployeeIdByName(session!.user.name, session!.user.id)
      : null

    const where: Prisma.EmployeeWhereInput = {}
    if (!includeInactive) where.isActive = true
    if (isSelfOnly) {
      where.id = selfEmployeeId ?? -1
    }
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
        subdivision: true,
        employmentStatus: true,
        joinDate: true,
        fingerprintId: true,
        isActive: true,
        userId: true,
        _count: { select: { attendances: true } },
      },
    })

    const users = canManage
      ? await prisma.user.findMany({
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : []

    return NextResponse.json({
      employees: employees.map((employee) => ({
        id: employee.id,
        name: employee.name,
        department: employee.department,
        position: employee.position,
        subdivision: employee.subdivision,
        employmentStatus: employee.employmentStatus,
        joinDate: employee.joinDate,
        fingerprintId: isSelfOnly ? null : employee.fingerprintId,
        isActive: employee.isActive,
        userId: employee.userId,
        attendanceCount: employee._count.attendances,
      })),
      users: users.map((user) => ({ id: user.id, name: user.name })),
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
  const subdivision = asTrimmed(body.subdivision)
  const employmentStatus = asTrimmed(body.employmentStatus) || 'Karyawan'
  const fingerprintId = asTrimmed(body.fingerprintId)
  const joinDate = parseJoinDate(body.joinDate)
  const userId = parseUserId(body.userId)

  if (!name) {
    return NextResponse.json({ error: 'Nama karyawan wajib diisi' }, { status: 400 })
  }
  if (!isKnownDivision(department)) {
    return NextResponse.json({ error: 'Divisi tidak valid' }, { status: 400 })
  }
  if (subdivision && !isKnownHrSubdivision(department, subdivision)) {
    return NextResponse.json({ error: 'Sub divisi tidak valid untuk divisi ini' }, { status: 400 })
  }
  if (!isKnownEmploymentStatus(employmentStatus)) {
    return NextResponse.json({ error: 'Status kepegawaian tidak valid' }, { status: 400 })
  }
  if (body.joinDate && !joinDate) {
    return NextResponse.json({ error: 'Tanggal masuk tidak valid' }, { status: 400 })
  }
  if (userId !== undefined && userId !== null) {
    const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!userExists) {
      return NextResponse.json({ error: 'Akun pengguna tidak ditemukan' }, { status: 400 })
    }
  }
  try {
    await ensureHrSchemaOnce()
    const created = await prisma.employee.create({
      data: {
        name,
        department,
        position,
        subdivision: subdivision || null,
        employmentStatus,
        joinDate: joinDate ?? new Date(),
        fingerprintId: fingerprintId || null,
        isActive: body.isActive !== false,
        userId: userId ?? null,
      },
    })
    return NextResponse.json({ employee: created })
  } catch (error) {
    if (isUniqueError(error)) {
      return NextResponse.json({ error: 'ID fingerprint atau akun pengguna sudah dipakai karyawan lain' }, { status: 409 })
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

  const data: Prisma.EmployeeUncheckedUpdateInput = {}

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
  if (body.subdivision !== undefined) {
    data.subdivision = asTrimmed(body.subdivision) || null
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
  if (body.userId !== undefined) {
    const userId = parseUserId(body.userId)
    if (userId === undefined) {
      // Tidak ada perubahan untuk field ini.
    } else if (userId === null) {
      data.userId = null
    } else {
      const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
      if (!userExists) {
        return NextResponse.json({ error: 'Akun pengguna tidak ditemukan' }, { status: 400 })
      }
      data.userId = userId
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 })
  }

  try {
    await ensureHrSchemaOnce()
    if (typeof data.subdivision === 'string') {
      const nextDepartment =
        typeof data.department === 'string'
          ? data.department
          : (await prisma.employee.findUnique({ where: { id }, select: { department: true } }))?.department ?? ''
      if (!isKnownHrSubdivision(nextDepartment, data.subdivision)) {
        return NextResponse.json({ error: 'Sub divisi tidak valid untuk divisi ini' }, { status: 400 })
      }
    }
    const updated = await prisma.employee.update({ where: { id }, data })
    return NextResponse.json({ employee: updated })
  } catch (error) {
    if (isUniqueError(error)) {
      return NextResponse.json({ error: 'ID fingerprint atau akun pengguna sudah dipakai karyawan lain' }, { status: 409 })
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
