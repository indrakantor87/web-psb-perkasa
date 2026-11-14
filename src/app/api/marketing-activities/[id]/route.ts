import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { cache } from '@/lib/cache'
import {
  normalizeMarketingName,
  resolveMarketingName,
  isMarketingOwnerMatch,
} from '@/lib/marketing-users'
import { canMutateMarketingActivities, isMarketingServiceManager } from '@/lib/access'
import { unauthorizedResponse } from '@/lib/access-server'
import { ensureMarketingActivityColumnsOnce } from '@/lib/marketing-activity-schema'

export const runtime = 'nodejs'

function parseOptionalInt(value: unknown) {
  if (value === null || typeof value === 'undefined' || value === '') return null
  const n = parseInt(String(value), 10)
  return Number.isFinite(n) ? n : null
}

function toNonNegativeInt(value: unknown) {
  const n = parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

async function ensureOwnership(activityId: number, role: string, userName: string, isManager: boolean) {
  if (role !== 'MARKETING' || isManager) return { ok: true as const }
  const existing = await prisma.marketingActivity.findUnique({
    where: { id: activityId },
    select: { marketingName: true },
  })
  if (!existing) return { ok: false as const, status: 404, error: 'Data tidak ditemukan' }
  if (!isMarketingOwnerMatch(existing.marketingName, userName)) {
    return { ok: false as const, status: 403, error: 'Anda hanya dapat mengubah data milik Anda sendiri' }
  }
  return { ok: true as const }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  const isManager = isMarketingServiceManager(session.user.role, session.user.position, session.user.division)
  if (!canMutateMarketingActivities(session.user.role) && !isManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureMarketingActivityColumnsOnce()

  const { id } = await params
  const activityId = parseInt(id)

  try {
    const ownership = await ensureOwnership(activityId, session.user.role, session.user.name, isManager)
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status })
    }

    const body = await request.json()
    const {
      date,
      marketingName,
      activity,
      notes,
      areaId,
      areaId2,
      areaId3,
      areaId4,
      flyer,
      sosialisasi,
      dataBase,
      event,
    } = body

    const resolvedMarketingName =
      typeof marketingName === 'undefined'
        ? undefined
        : session.user.role === 'MARKETING' && !isManager
          ? normalizeMarketingName(session.user.name)
          : await resolveMarketingName(marketingName)

    if (typeof marketingName !== 'undefined' && !resolvedMarketingName) {
      return NextResponse.json({ error: 'Nama marketing harus dipilih dari user marketing yang valid' }, { status: 400 })
    }
    const nextMarketingName = resolvedMarketingName ?? undefined

    const picked = [parseOptionalInt(areaId), parseOptionalInt(areaId2), parseOptionalInt(areaId3), parseOptionalInt(areaId4)]
    const uniquePicked = picked.map((val, idx) => {
      if (val === null) return null
      const firstIndex = picked.findIndex(v => v === val)
      return firstIndex === idx ? val : null
    })

    const hasNumbers =
      typeof flyer !== 'undefined' || typeof sosialisasi !== 'undefined' || typeof dataBase !== 'undefined' || typeof event !== 'undefined'

    let numericData: { flyer?: number; sosialisasi?: number; dataBase?: number; event?: number; total?: number } = {}
    if (hasNumbers) {
      const current = await prisma.marketingActivity.findUnique({
        where: { id: activityId },
        select: { flyer: true, sosialisasi: true, dataBase: true, event: true },
      })
      const flyerValue = typeof flyer === 'undefined' ? current?.flyer ?? 0 : toNonNegativeInt(flyer)
      const sosialisasiValue =
        typeof sosialisasi === 'undefined' ? current?.sosialisasi ?? 0 : toNonNegativeInt(sosialisasi)
      const dataBaseValue = typeof dataBase === 'undefined' ? current?.dataBase ?? 0 : toNonNegativeInt(dataBase)
      const eventValue = typeof event === 'undefined' ? current?.event ?? 0 : toNonNegativeInt(event)
      numericData = {
        flyer: flyerValue,
        sosialisasi: sosialisasiValue,
        dataBase: dataBaseValue,
        event: eventValue,
        total: flyerValue + sosialisasiValue + eventValue,
      }
    }

    const updatedActivity = await prisma.marketingActivity.update({
      where: { id: activityId },
      data: {
        date: date ? new Date(date) : undefined,
        marketingName: nextMarketingName,
        activity,
        notes,
        ...numericData,
        areaId: areaId !== undefined ? uniquePicked[0] : undefined,
        areaId2: areaId2 !== undefined ? uniquePicked[1] : undefined,
        areaId3: areaId3 !== undefined ? uniquePicked[2] : undefined,
        areaId4: areaId4 !== undefined ? uniquePicked[3] : undefined,
      },
    })

    cache.invalidateByPrefix('marketing-activities:')
    return NextResponse.json(updatedActivity)
  } catch (error) {
    console.error('Failed to update marketing activity:', error)
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  const isManager = isMarketingServiceManager(session.user.role, session.user.position, session.user.division)
  if (!canMutateMarketingActivities(session.user.role) && !isManager) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  const { id } = await params
  const activityId = parseInt(id)

  try {
    const ownership = await ensureOwnership(activityId, session.user.role, session.user.name, isManager)
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status })
    }

    await prisma.marketingActivity.delete({
      where: { id: activityId },
    })

    cache.invalidateByPrefix('marketing-activities:')
    return NextResponse.json({ message: 'Activity deleted' })
  } catch (error) {
    console.error('Failed to delete marketing activity:', error)
    return NextResponse.json({ error: 'Failed to delete activity' }, { status: 500 })
  }
}
