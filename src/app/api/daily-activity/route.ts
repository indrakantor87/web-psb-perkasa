import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ensureMenuAccess, ensureMenuMutation, requireSession } from '@/lib/access-server'
import {
  createDailyActivityItems,
  getDailyActivityPageData,
  type DailyActivityFilters,
  type DailyActivityPlanInput,
} from '@/lib/daily-activity-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function readFilters(request: Request): DailyActivityFilters {
  const { searchParams } = new URL(request.url)
  const pick = (key: string) => {
    const value = searchParams.get(key)
    return value && value.trim() ? value.trim() : null
  }

  return {
    from: pick('from'),
    to: pick('to'),
    division: pick('division'),
    subdivision: pick('subdivision'),
    ownerName: pick('ownerName'),
    executionStatus: pick('executionStatus'),
    approvalStatus: pick('approvalStatus'),
    priorityLevel: pick('priorityLevel'),
    keyword: pick('keyword'),
    scope: (pick('scope') as DailyActivityFilters['scope']) ?? 'all',
  }
}

export async function GET(request: Request) {
  const session = await getSession()
  const accessError = ensureMenuAccess(session, 'daily-activity')
  if (accessError) return accessError

  try {
    const data = await getDailyActivityPageData(requireSession(session).user, readFilters(request))
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to load daily activity data:', error)
    return NextResponse.json({ error: 'Gagal memuat data Daily Activity' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  const mutationError = ensureMenuMutation(session, 'daily-activity')
  if (mutationError) return mutationError

  try {
    const body = await request.json()
    const rawItems: unknown[] = Array.isArray(body?.items) ? body.items : [body]
    const items = rawItems.filter((item): item is DailyActivityPlanInput => Boolean(item && typeof item === 'object'))

    if (items.length === 0) {
      return NextResponse.json({ error: 'Tidak ada aktivitas yang dikirim' }, { status: 400 })
    }

    const created = await createDailyActivityItems(requireSession(session).user, items)
    if (created.length === 0) {
      return NextResponse.json({ error: 'Judul aktivitas wajib diisi' }, { status: 400 })
    }

    return NextResponse.json({ created: created.length, items: created })
  } catch (error) {
    console.error('Failed to create daily activity:', error)
    return NextResponse.json({ error: 'Gagal menyimpan aktivitas' }, { status: 500 })
  }
}
