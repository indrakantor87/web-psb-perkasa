import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureMenuMutation, requireSession } from '@/lib/access-server'

export const runtime = 'nodejs'

function parseDate(value: unknown): Date {
  if (!value) return new Date()
  if (typeof value === 'number') {
    return new Date(Math.round((value - 25569) * 86400 * 1000))
  }
  if (typeof value === 'string') {
    const str = value.trim()
    const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
    if (slashMatch) {
      const [, d, m, y] = slashMatch
      const year = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10)
      return new Date(year, parseInt(m, 10) - 1, parseInt(d, 10))
    }
    const dt = new Date(str)
    return isNaN(dt.getTime()) ? new Date() : dt
  }
  if (value instanceof Date) return value
  return new Date()
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || value === '-') return null
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function toText(value: unknown): string | null {
  if (value === null || value === undefined || value === '' || value === '-') return null
  return String(value).trim()
}

const norm = (s: unknown) =>
  typeof s === 'string' ? s.trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ') : ''

function mapField(key: string): string {
  const k = norm(key)
  if (['TANGGAL', 'TANGGALBULANTAHUN', 'DATE', 'TGL', 'WAKTU', 'HARI TANGGAL'].includes(k)) return 'date'
  if (['RATING', 'RATING GOOGLE MAPS', 'GOOGLE MAPS', 'RATING GMAPS', 'GMAPS'].includes(k)) return 'ratingGoogleMaps'
  if (['FOLLOWERS', 'FOLLOWERS IG', 'FOLLOWERS INSTAGRAM', 'IG FOLLOWERS'].includes(k)) return 'followersInstagram'
  if (['POSTER PRODUKSI', 'PRODUKSI POSTER', 'POSTER PROD'].includes(k)) return 'posterProduksi'
  if (['POSTER POSTING', 'POSTING POSTER', 'POSTER POST'].includes(k)) return 'posterPosting'
  if (['VIDEO PRODUKSI', 'PRODUKSI VIDEO', 'VIDEO PROD'].includes(k)) return 'videoProduksi'
  if (['VIDEO POSTING', 'POSTING VIDEO', 'VIDEO POST'].includes(k)) return 'videoPosting'
  if (['KONTEN PERFORMA TINGGI IG', 'PERFORMA IG', 'IG PERFORMA', 'HIGH IG'].includes(k)) return 'highPerformingIg'
  if (['KONTEN PERFORMA TINGGI TIK TOK', 'KONTEN PERFORMA TINGGI TIKTOK', 'PERFORMA TIKTOK', 'TIKTOK PERFORMA', 'HIGH TIKTOK', 'HIGH TIK TOK'].includes(k)) return 'highPerformingTiktok'
  if (['MESSAGE IG', 'IG MESSAGE', 'DM IG', 'PESAN IG'].includes(k)) return 'messageIg'
  if (['MESSAGE GOOGLE REVIEW', 'GOOGLE REVIEW MESSAGE', 'PESAN GOOGLE REVIEW', 'GOOGLE REVIEW'].includes(k)) return 'messageGoogleReview'
  if (['KENDALA TEKNIS', 'TEKNIS'].includes(k)) return 'kendalaTeknis'
  if (['KENDALA NON TEKNIS', 'NON TEKNIS', 'NON-TEKNIS'].includes(k)) return 'kendalaNonTeknis'
  if (['KETERANGAN', 'KET', 'CATATAN', 'NOTES', 'NOTE', 'DESKRIPSI'].includes(k)) return 'keterangan'
  return ''
}

export async function POST(request: Request) {
  const session = await getSession()
  const accessError = ensureMenuMutation(session, 'laporan')
  if (accessError) return accessError
  const activeSession = requireSession(session)

  try {
    const XLSX = await import('xlsx')
    const form = await request.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    let rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })

    // Fallback: scan header row if not detected
    if (!rows.length || !rows.some((r) => Object.keys(r).some((k) => mapField(k)))) {
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })
      let headerIdx = -1
      for (let i = 0; i < Math.min(aoa.length, 15); i++) {
        const row = aoa[i] || []
        if (row.some((c) => mapField(String(c ?? '')))) {
          headerIdx = i
          break
        }
      }
      if (headerIdx >= 0) {
        const headerRow = (aoa[headerIdx] || []).map((h) => String(h ?? ''))
        const indexMap: Record<number, string> = {}
        headerRow.forEach((h, idx) => {
          const f = mapField(h)
          if (f) indexMap[idx] = f
        })
        const collected: Array<Record<string, unknown>> = []
        for (let r = headerIdx + 1; r < aoa.length; r++) {
          const rowData = aoa[r] || []
          const obj: Record<string, unknown> = {}
          let hasData = false
          Object.entries(indexMap).forEach(([idxStr, field]) => {
            const idx = Number(idxStr)
            const val = rowData[idx]
            obj[field] = val ?? null
            if (val !== null && val !== '' && val !== '-') hasData = true
          })
          if (hasData) collected.push(obj)
        }
        rows = collected
      }
    }

    let ok = 0
    let fail = 0
    let lastError = ''

    for (const row of rows) {
      try {
        const mapped: Record<string, unknown> = {}
        if (row.date || row.keterangan || row.ratingGoogleMaps !== undefined) {
          Object.assign(mapped, row)
        } else {
          for (const [k, v] of Object.entries(row)) {
            const field = mapField(k)
            if (field) mapped[field] = v
          }
        }

        const isEmpty = Object.values(mapped).every(
          (v) => v === null || v === undefined || v === '' || v === '-',
        )
        if (isEmpty) continue
        if (!mapped.date) continue

        await prisma.digitalCreatorReport.create({
          data: {
            date: parseDate(mapped.date),
            ratingGoogleMaps: toNumber(mapped.ratingGoogleMaps),
            followersInstagram: toNumber(mapped.followersInstagram),
            posterProduksi: toNumber(mapped.posterProduksi),
            posterPosting: toNumber(mapped.posterPosting),
            videoProduksi: toNumber(mapped.videoProduksi),
            videoPosting: toNumber(mapped.videoPosting),
            highPerformingIg: toNumber(mapped.highPerformingIg),
            highPerformingTiktok: toNumber(mapped.highPerformingTiktok),
            messageIg: toNumber(mapped.messageIg),
            messageGoogleReview: toNumber(mapped.messageGoogleReview),
            kendalaTeknis: toText(mapped.kendalaTeknis),
            kendalaNonTeknis: toText(mapped.kendalaNonTeknis),
            keterangan: toText(mapped.keterangan),
            createdById: activeSession.user.id,
          },
        })
        ok++
      } catch (e) {
        fail++
        lastError =
          typeof e === 'object' && e && 'message' in e
            ? String((e as { message?: unknown }).message)
            : String(e)
      }
    }

    let message = `Import selesai. Berhasil: ${ok}, Gagal: ${fail}`
    if (fail > 0 && ok === 0 && lastError) message += `. Error terakhir: ${lastError}`
    return NextResponse.json({ message, ok, fail })
  } catch (error) {
    console.error('Import laporan error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
