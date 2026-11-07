import { prisma } from '@/lib/prisma'

type RawExecutor = {
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<number>
}

/**
 * Menyesuaikan jumlah port terpakai pada satu ODP.
 * delta positif menambah, negatif mengurangi. Nilai tidak pernah turun di bawah 0.
 */
export async function adjustOdpTerpakai(
  odpId: number | null | undefined,
  delta: number,
  client: RawExecutor = prisma,
) {
  const id = Math.trunc(Number(odpId))
  const amount = Math.trunc(Number(delta))
  if (!Number.isFinite(id) || id <= 0) return
  if (!Number.isFinite(amount) || amount === 0) return
  await client.$executeRawUnsafe(
    `UPDATE psb_odp SET terpakai = GREATEST(0, terpakai + ${amount}), updated_at = NOW() WHERE id = ${id}`,
  )
}

/**
 * Mengambil ODP & port yang tertaut ke sebuah tiket PSB.
 * Dipakai untuk mewarisi lokasi port saat proses dismantle.
 */
export async function resolveTicketOdpPort(ticketId: number | null | undefined) {
  const id = Math.trunc(Number(ticketId))
  if (!Number.isFinite(id) || id <= 0) {
    return { odpId: null as number | null, portNumber: null as number | null }
  }
  const rows = await prisma.$queryRawUnsafe<Array<{ odpId: number | null; portNumber: number | null }>>(
    `SELECT "odpId", "portNumber" FROM "Ticket" WHERE "id" = $1 LIMIT 1`,
    id,
  )
  const row = rows[0]
  return {
    odpId: row?.odpId == null ? null : Number(row.odpId),
    portNumber: row?.portNumber == null ? null : Number(row.portNumber),
  }
}
