import { prisma } from '@/lib/prisma'
import { mkdir, readFile, rm, unlink, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

type PhotoRow = { id: number; ticketId: number; mimeType: string; sizeBytes: number; filePath: string }

let ensuredPhotoPromise: Promise<void> | null = null

function uploadDir() {
  const raw = String(process.env.TROUBLE_TICKET_UPLOAD_DIR ?? '').trim()
  if (raw) return path.resolve(raw)
  return path.resolve(process.cwd(), 'storage', 'trouble-ticket-photos')
}

function extFromMime(mime: string) {
  const m = String(mime || '').trim().toLowerCase()
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg'
  if (m === 'image/png') return 'png'
  if (m === 'image/webp') return 'webp'
  return 'bin'
}

function safeRelative(p: string) {
  const normalized = path.posix.normalize(String(p || '').replace(/\\/g, '/'))
  if (!normalized || normalized.startsWith('/') || normalized.startsWith('..') || normalized.includes('/../')) return null
  return normalized
}

async function ensurePhotoTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TroubleTicketPhoto" (
      "id" SERIAL NOT NULL,
      "ticketId" INT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "sizeBytes" INT NOT NULL,
      "filePath" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TroubleTicketPhoto_pkey" PRIMARY KEY ("id")
    );
  `)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TroubleTicketPhoto_ticketId_idx" ON "TroubleTicketPhoto"("ticketId");`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "TroubleTicketPhoto_filePath_key" ON "TroubleTicketPhoto"("filePath");`)
}

export async function ensurePhotoTableOnce() {
  if (!ensuredPhotoPromise) {
    ensuredPhotoPromise = ensurePhotoTable().catch((e) => {
      ensuredPhotoPromise = null
      throw e
    })
  }
  await ensuredPhotoPromise
}

export async function saveTicketPhotos(ticketId: number, files: File[]) {
  await ensurePhotoTableOnce().catch(() => {})
  const baseDir = uploadDir()
  const ticketDir = path.join(baseDir, String(ticketId))
  await mkdir(ticketDir, { recursive: true })

  const ids: number[] = []
  for (const f of files) {
    const mimeType = String(f.type || 'application/octet-stream')
    const ext = extFromMime(mimeType)
    const name = `${Date.now()}-${randomUUID()}.${ext}`
    const rel = safeRelative(`${ticketId}/${name}`)
    if (!rel) throw new Error('Invalid photo path')
    const full = path.join(baseDir, rel)
    const buf = Buffer.from(await f.arrayBuffer())
    await mkdir(path.dirname(full), { recursive: true })
    await writeFile(full, buf)

    const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `INSERT INTO "TroubleTicketPhoto" ("ticketId","mimeType","sizeBytes","filePath")
       VALUES ($1,$2,$3,$4)
       RETURNING "id";`,
      ticketId,
      mimeType,
      buf.length,
      rel
    )
    const id = rows[0]?.id
    if (id) ids.push(id)
  }
  return ids
}

export async function listTicketPhotoIds(ticketId: number) {
  await ensurePhotoTableOnce().catch(() => {})
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT "id" FROM "TroubleTicketPhoto" WHERE "ticketId" = $1 ORDER BY "id" ASC;`,
    ticketId
  )
  return rows.map((r) => r.id)
}

export async function getPhotoRow(photoId: number) {
  await ensurePhotoTableOnce().catch(() => {})
  const rows = await prisma.$queryRawUnsafe<PhotoRow[]>(
    `SELECT "id","ticketId","mimeType","sizeBytes","filePath" FROM "TroubleTicketPhoto" WHERE "id" = $1 LIMIT 1;`,
    photoId
  )
  return rows[0] ?? null
}

export async function readPhotoFile(relPath: string) {
  const baseDir = uploadDir()
  const rel = safeRelative(relPath)
  if (!rel) return null
  const full = path.join(baseDir, rel)
  try {
    return await readFile(full)
  } catch {
    return null
  }
}

export async function deletePhotosForTicket(ticketId: number) {
  await ensurePhotoTableOnce().catch(() => {})
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number; filePath: string }>>(
    `SELECT "id","filePath" FROM "TroubleTicketPhoto" WHERE "ticketId" = $1;`,
    ticketId
  )

  const baseDir = uploadDir()
  for (const r of rows) {
    const rel = safeRelative(r.filePath)
    if (!rel) continue
    const full = path.join(baseDir, rel)
    await unlink(full).catch(() => {})
  }
  await prisma.$executeRawUnsafe(`DELETE FROM "TroubleTicketPhoto" WHERE "ticketId" = $1;`, ticketId)
  await rm(path.join(baseDir, String(ticketId)), { recursive: true, force: true }).catch(() => {})
}
