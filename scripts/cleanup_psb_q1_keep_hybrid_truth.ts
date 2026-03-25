import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const year = 2026
  const start = new Date(year, 0, 1)   // Jan 1
  const end = new Date(year, 3, 1)     // Apr 1

  // 0) Bersihkan entri non-PSB yang jelas (marketingName diawali 'ex. ')
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

  // 1) Bangun hybrid truth set berdasarkan logika List Data:
  //    basis = COALESCE(installedDate, requestDate)
  //    Simpan 1 id per (lower(customerName), day(basis)) dengan prioritas:
  //    - installedDate tidak null lebih diutamakan
  //    - tanggal basis lebih awal
  //    - id terkecil
  type TruthRow = { id: number }
  const truthRows = await prisma.$queryRaw<TruthRow[]>`
    WITH base AS (
      SELECT
        id,
        LOWER("customerName") AS name,
        COALESCE("installedDate","requestDate") AS basis_dt,
        "installedDate"
      FROM "Ticket"
      WHERE COALESCE("installedDate","requestDate") >= ${start}
        AND COALESCE("installedDate","requestDate") < ${end}
    ),
    ranked AS (
      SELECT
        id,
        name,
        date_trunc('day', basis_dt) AS day_dt,
        ROW_NUMBER() OVER (
          PARTITION BY name, date_trunc('day', basis_dt)
          ORDER BY ("installedDate" IS NULL), basis_dt, id
        ) AS rn
      FROM base
    )
    SELECT id FROM ranked WHERE rn = 1
  `
  const truth = new Set(truthRows.map(r => r.id))
  console.log('Truth set (hybrid) size Q1:', truth.size)

  // 2) Hapus selain truth bila terjadi duplikasi pada key (name, day(basis))
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
  const byKey = new Map<string, CandRow[]>()
  for (const r of cands) {
    const key = `${r.name}__${r.day}`
    const arr = byKey.get(key) || []
    arr.push(r)
    byKey.set(key, arr)
  }
  const toDelete: number[] = []
  for (const arr of byKey.values()) {
    if (arr.length <= 1) continue
    const keep = arr.find(r => truth.has(r.id))
    if (keep) {
      for (const r of arr) if (r.id !== keep.id) toDelete.push(r.id)
    } else {
      const sorted = arr.slice().sort((a, b) => a.id - b.id)
      for (let i = 1; i < sorted.length; i++) toDelete.push(sorted[i].id)
    }
  }
  console.log('Kandidat hapus (non-truth duplikat):', toDelete.length)
  if (toDelete.length) {
    const chunk = 500
    let deleted = 0
    for (let i = 0; i < toDelete.length; i += chunk) {
      const part = toDelete.slice(i, i + chunk)
      const res = await prisma.ticket.deleteMany({ where: { id: { in: part } } })
      deleted += res.count
    }
    console.log('Dihapus total:', deleted)
  }

  // 3) Laporkan ulang hitungan (hybrid) per bulan (basis = installedDate jika ada else requestDate)
  for (const m of [1, 2, 3]) {
    const ms = new Date(year, m - 1, 1)
    const me = new Date(year, m, 1)
    const cnt = await prisma.$queryRaw<Array<{ c: number }>>`
      SELECT COUNT(*)::int AS c
      FROM "Ticket"
      WHERE COALESCE("installedDate","requestDate") >= ${ms}
        AND COALESCE("installedDate","requestDate") < ${me}
    `
    console.log(`Hybrid basis ${year}-${String(m).padStart(2,'0')}:`, cnt[0]?.c ?? 0)
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})

