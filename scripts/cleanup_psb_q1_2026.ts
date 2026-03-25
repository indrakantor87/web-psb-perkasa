import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function ymRange(year: number, monthStart: number, monthEndExclusive: number) {
  const start = new Date(year, monthStart - 1, 1)
  const end = new Date(year, monthEndExclusive - 1, 1)
  return { start, end }
}

async function countInstalledByMonth(year: number) {
  const months = [1, 2, 3]
  const res: Record<number, number> = {}
  for (const m of months) {
    const start = new Date(year, m - 1, 1)
    const end = new Date(year, m, 1)
    res[m] = await prisma.ticket.count({
      where: { installedDate: { gte: start, lt: end } }
    })
  }
  return res
}

async function main() {
  const year = 2026
  const { start, end } = ymRange(year, 1, 4) // Jan 1..Apr 1

  console.log('=== Audit awal Q1 2026 (installed + request basis) ===')
  const beforeAll = await prisma.ticket.count({
    where: {
      OR: [
        { installedDate: { gte: start, lt: end } },
        { requestDate: { gte: start, lt: end } },
      ]
    }
  })
  const beforeInstalled = await countInstalledByMonth(year)
  console.log('Total tiket basis (installed|request):', beforeAll)
  console.log('Hitung installed per bulan (sebelum):', beforeInstalled)

  // 1) Hapus entri non-PSB yang jelas (contoh: marketingName diawali 'ex. ')
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

  // 2) Hapus duplikat PSB Q1 2026, simpan 1 per (lower(name), day(coalesce(installed,request)))
  //    Prioritas simpan: installedDate TIDAK NULL lebih diutamakan,
  //    lalu tanggal terawal, lalu id terkecil.
  type DupRow = { id: number }
  const toDelete = await prisma.$queryRaw<Array<DupRow>>`
    WITH base AS (
      SELECT
        id,
        LOWER("customerName") AS name,
        date_trunc('day', COALESCE("installedDate","requestDate")) AS day_dt,
        "installedDate"
      FROM "Ticket"
      WHERE COALESCE("installedDate","requestDate") >= ${start}
        AND COALESCE("installedDate","requestDate") < ${end}
    ),
    ranked AS (
      SELECT
        id,
        name,
        day_dt,
        "installedDate",
        ROW_NUMBER() OVER (
          PARTITION BY name, day_dt
          ORDER BY ("installedDate" IS NULL), "installedDate", id
        ) AS rn
      FROM base
    )
    SELECT id FROM ranked WHERE rn > 1
  `

  console.log('Kandidat duplikat untuk dihapus:', toDelete.length)

  if (toDelete.length) {
    // Hapus bertahap untuk keamanan
    const chunkSize = 500
    let deleted = 0
    for (let i = 0; i < toDelete.length; i += chunkSize) {
      const chunk = toDelete.slice(i, i + chunkSize).map(r => r.id)
      const res = await prisma.ticket.deleteMany({ where: { id: { in: chunk } } })
      deleted += res.count
    }
    console.log('Dihapus (duplikat):', deleted)
  }

  const afterInstalled = await countInstalledByMonth(year)
  console.log('Hitung installed per bulan (sesudah):', afterInstalled)
  console.log('Selesai cleanup Q1 2026.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})

