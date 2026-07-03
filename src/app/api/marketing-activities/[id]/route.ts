import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { cache } from '@/lib/cache'
import { normalizeMarketingName, resolveMarketingName } from '@/lib/marketing-users'
import { canMutateMarketingActivities } from '@/lib/access'
import { unauthorizedResponse } from '@/lib/access-server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canMutateMarketingActivities(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const activityId = parseInt(id)

  try {
    const body = await request.json()
    const { date, marketingName, activity, notes, areaId, areaId2, areaId3, areaId4 } = body
    const resolvedMarketingName =
      typeof marketingName === 'undefined'
        ? undefined
        : session.user.role === 'MARKETING'
          ? normalizeMarketingName(session.user.name)
          : await resolveMarketingName(marketingName)

    if (typeof marketingName !== 'undefined' && !resolvedMarketingName) {
      return NextResponse.json({ error: 'Nama marketing harus dipilih dari user marketing yang valid' }, { status: 400 })
    }
    const nextMarketingName = resolvedMarketingName ?? undefined

    const parseOptionalInt = (v: unknown) => {
      if (v === null || typeof v === 'undefined' || v === '') return null
      const n = parseInt(String(v), 10)
      return Number.isFinite(n) ? n : null
    }

    const picked = [parseOptionalInt(areaId), parseOptionalInt(areaId2), parseOptionalInt(areaId3), parseOptionalInt(areaId4)]
    const uniquePicked = picked.map((val, idx) => {
      if (val === null) return null
      const firstIndex = picked.findIndex(v => v === val)
      return firstIndex === idx ? val : null
    })

    const updatedActivity = await prisma.marketingActivity.update({
      where: { id: activityId },
      data: {
        date: date ? new Date(date) : undefined,
        marketingName: nextMarketingName,
        activity,
        notes,
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
  if (!canMutateMarketingActivities(session.user.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  const { id } = await params
  const activityId = parseInt(id)

  try {
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
