import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const year = 2026
  const months = [1, 2, 3] // Jan, Feb, Mar

  const start = new Date(year, 0, 1)
  const end = new Date(year, 3, 1) // Apr 1

  // 0) Hapus entri non‑PSB yang jelas (contoh: marketingName diawali 'ex. ')
  const removedNonPsb = await prisma.ticket.deleteMany({
    where: {
      OR: [
        { installedDate: { gte: start, lt: end } },
        { requestDate: { gte: start, lt: end } },
      ],
      marketingName: { startsWith: 'ex. ', mode: 'insensitive' }
    }
  })
  console.log('Dihapus non-PSB (marketingName "ex. ..."):', removedNonPsb.count)

  // 1) Bangun "truth set": id yang muncul di List PSB (diasumsikan: installedDate ada & status CLOSE)
  //    Pilih satu id per (lower(customerName), day(installedDate)) dengan aturan: tanggal terawal, lalu id terkecil.
  type TruthRow = { id: number }
  const truthRows = await prisma.$queryRaw<TruthRow[]>`
    WITH cand AS (
      SELECT
        id,
        LOWER("customerName") AS name,
        date_trunc('day', "installedDate") AS day_dt
      FROM "Ticket"
      WHERE "installedDate" IS NOT NULL
        AND "installedDate" >= ${start}
        AND "installedDate" < ${end}
        AND UPPER("status") = 'CLOSE'
    ),
    ranked AS (
      SELECT
        id,
        name,
        day_dt,
        ROW_NUMBER() OVER (
          PARTITION BY name, day_dt
          ORDER BY day_dt, id
        ) AS rn
      FROM cand
    )
    SELECT id FROM ranked WHERE rn = 1
  `
  const truth = new Set(truthRows.map(r => r.id))
  console.log('Truth set size (Q1 2026):', truth.size)

  // 2) Cari semua kandidat pada Q1 (termasuk requestDate) lalu hapus yang bukan truth jika merupakan duplikat
  //    Kunci dedup: lower(customerName) + day(coalesce(installedDate, requestDate))
  type CandRow = { id: number, name: string, day: string }
  const cands = await prisma.$queryRaw<CandRow[]>`
    SELECT
      id,
      LOWER("customerName") AS name,
      to_char(date_trunc('day', COALESCE("installedDate","requestDate")), 'YYYY-MM-DD') AS day
    FROM "Ticket"
    WHERE COALESCE("installedDate","requestDate") >= ${start}
      AND COALESCE("installedDate","requestDate") < ${end}
  `

  // Kelompokkan per key
  const byKey = new Map<string, CandRow[]>()
  for (const r of cands) {
    const key = `${r.name}__${r.day}`
    const arr = byKey.get(key) || []
    arr.push(r)
    byKey.set(key, arr)
  }

  const toDeleteIds: number[] = []
  for (const arr of byKey.values()) {
    if (arr.length <= 1) continue
    // Jika ada id yang termasuk truth, pertahankan hanya id truth; selain itu hapus
    const keep = arr.find(r => truth.has(r.id))
    if (keep) {
      for (const r of arr) {
        if (r.id !== keep.id) toDeleteIds.push(r.id)
      }
    } else {
      // Tidak ada yang masuk truth: tetap simpan satu paling kecil id, hapus sisanya
      const sorted = arr.slice().sort((a, b) => a.id - b.id)
      for (let i = 1; i < sorted.length; i++) toDeleteIds.push(sorted[i].id)
    }
  }

  console.log('Kandidat hapus (bukan truth / duplikat):', toDeleteIds.length)
  if (toDeleteIds.length) {
    const chunk = 500
    let deleted = 0
    for (let i = 0; i < toDeleteIds.length; i += chunk) {
      const part = toDeleteIds.slice(i, i + chunk)
      const res = await prisma.ticket.deleteMany({ where: { id: { in: part } } })
      deleted += res.count
    }
    console.log('Dihapus total:', deleted)
  }

  // 3) Laporkan hitung installed per bulan (CLOSE)
  for (const m of months) {
    const ms = new Date(year, m - 1, 1)
    const me = new Date(year, m, 1)
    const cnt = await prisma.ticket.count({
      where: {
        installedDate: { gte: ms, lt: me },
        status: { equals: 'CLOSE', mode: 'insensitive' }
      }
    })
    console.log(`Installed CLOSE ${year}-${String(m).padStart(2,'0')}:`, cnt)
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})

