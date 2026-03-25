import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const year = 2026
  const month = 3 // March
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)

  console.log('=== Audit awal (PSB March 2026) ===')
  const before = await prisma.ticket.count({
    where: {
      OR: [
        { installedDate: { gte: start, lt: end } },
        { requestDate: { gte: start, lt: end } },
      ]
    }
  })
  console.log('Total tiket (sebelum):', before)

  // Hapus tiket yang jelas bukan PSB (contoh: marketingName diawali 'ex. ')
  const removedNonPsb = await prisma.ticket.deleteMany({
    where: {
      OR: [
        { installedDate: { gte: start, lt: end } },
        { requestDate: { gte: start, lt: end } },
      ],
      marketingName: { startsWith: 'ex. ', mode: 'insensitive' }
    }
  })
  console.log('Dihapus (bukan PSB, marketingName "ex. "):', removedNonPsb.count)

  // Hapus duplikat: simpan id terkecil per (lower(name), day(basis))
  const dupGroups = await prisma.$queryRaw<Array<{ name: string; day: string; min_id: number; ids: number[] }>>`
    WITH base AS (
      SELECT
        LOWER("customerName") AS name,
        date_trunc('day', COALESCE("installedDate","requestDate")) AS day_dt,
        id
      FROM "Ticket"
      WHERE COALESCE("installedDate","requestDate") >= ${start}
        AND COALESCE("installedDate","requestDate") < ${end}
    ),
    grp AS (
      SELECT
        name,
        to_char(day_dt, 'YYYY-MM-DD') AS day,
        MIN(id) AS min_id,
        ARRAY_AGG(id) AS ids,
        COUNT(*) AS cnt
      FROM base
      GROUP BY 1,2
      HAVING COUNT(*) > 1
    )
    SELECT name, day, min_id, ids FROM grp
    ORDER BY day, name
  `

  let deleted = 0
  for (const g of dupGroups) {
    const toDelete = (g.ids || []).filter((x) => x !== g.min_id)
    if (toDelete.length) {
      const res = await prisma.ticket.deleteMany({ where: { id: { in: toDelete } } })
      deleted += res.count
    }
  }
  console.log('Dihapus (duplikat):', deleted, 'grup:', dupGroups.length)

  const after = await prisma.ticket.count({
    where: {
      OR: [
        { installedDate: { gte: start, lt: end } },
        { requestDate: { gte: start, lt: end } },
      ]
    }
  })
  console.log('Total tiket (sesudah):', after)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})

