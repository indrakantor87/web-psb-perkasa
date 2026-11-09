import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { countExpiredOperationalPhotos, purgeExpiredOperationalPhotos } from '@/lib/photo-retention'
import { getPhotoRetentionCutoff } from '@/lib/photo-retention-policy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAuthorized(request: Request, secret: string) {
  const authorization = request.headers.get('authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return false

  const provided = Buffer.from(authorization.slice('Bearer '.length))
  const expected = Buffer.from(secret)
  if (provided.length !== expected.length) return false

  return timingSafeEqual(provided, expected)
}

export async function POST(request: Request) {
  const secret = process.env.PHOTO_RETENTION_CRON_SECRET ?? ''
  if (Buffer.byteLength(secret) < 32) {
    return NextResponse.json(
      { error: 'Photo retention cron is not configured' },
      { status: 503 },
    )
  }
  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cutoff = getPhotoRetentionCutoff()
    const expiredBefore = await countExpiredOperationalPhotos(cutoff)
    const mode = new URL(request.url).searchParams.get('mode')

    if (mode !== 'delete') {
      return NextResponse.json({
        ok: true,
        mode: 'dry-run',
        cutoff: cutoff.toISOString(),
        expiredBefore,
        deleted: {
          psbRecords: 0,
          troubleTicketFiles: 0,
          troubleTicketLegacyRecords: 0,
          dismantleRecords: 0,
          linkedIsolationPhotos: 0,
        },
        remaining: expiredBefore,
      })
    }

    const result = await purgeExpiredOperationalPhotos(cutoff, expiredBefore)
    return NextResponse.json({ ok: true, mode: 'delete', ...result })
  } catch (error: unknown) {
    console.error('Operational photo retention job failed:', error)
    return NextResponse.json(
      { error: 'Operational photo retention job failed' },
      { status: 500 },
    )
  }
}
