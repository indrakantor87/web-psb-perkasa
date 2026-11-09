import { prisma } from '@/lib/prisma'
import { ensureDismantleHistoryTable } from '@/lib/dismantle-history'
import {
  deleteExpiredTicketPhotos,
  ensurePhotoTableOnce,
} from '@/lib/trouble-ticket-photo-store'
import {
  PHOTO_RETENTION_BATCH_SIZE,
  PHOTO_RETENTION_MAX_BATCHES,
} from '@/lib/photo-retention-policy'

export type ExpiredPhotoCounts = {
  psbRecords: number
  troubleTicketFiles: number
  troubleTicketLegacyRecords: number
  dismantleRecords: number
  linkedIsolationPhotos: number
}

export type PhotoRetentionResult = {
  cutoff: string
  expiredBefore: ExpiredPhotoCounts
  deleted: ExpiredPhotoCounts
  remaining: ExpiredPhotoCounts
  failedTroubleTicketFiles: number
}

function emptyCounts(): ExpiredPhotoCounts {
  return {
    psbRecords: 0,
    troubleTicketFiles: 0,
    troubleTicketLegacyRecords: 0,
    dismantleRecords: 0,
    linkedIsolationPhotos: 0,
  }
}

export async function countExpiredOperationalPhotos(cutoff: Date): Promise<ExpiredPhotoCounts> {
  await ensurePhotoTableOnce()
  await ensureDismantleHistoryTable()

  const rows = await prisma.$queryRawUnsafe<Array<ExpiredPhotoCounts>>(
    `SELECT
       (
         SELECT COUNT(*)::int
         FROM "Ticket"
         WHERE "createdAt" < $1 AND "fotoRumah" IS NOT NULL
       ) AS "psbRecords",
       (
         SELECT COUNT(*)::int
         FROM "TroubleTicketPhoto"
         WHERE "createdAt" < $1
       ) AS "troubleTicketFiles",
       (
         SELECT COUNT(*)::int
         FROM "TroubleTicket"
         WHERE COALESCE("closedAt", "openedAt", "createdAt") < $1
           AND COALESCE(array_length("closePhotos", 1), 0) > 0
       ) AS "troubleTicketLegacyRecords",
       (
         SELECT COUNT(*)::int
         FROM "DismantleHistory" dh
         WHERE COALESCE(dh."closedAt", dh."createdAt") < $1
           AND (
             NULLIF(BTRIM(dh."closePhoto"), '') IS NOT NULL
             OR COALESCE(array_length(dh."closePhotos", 1), 0) > 0
             OR EXISTS (
               SELECT 1
               FROM "Isolation" i
               WHERE i."id" = dh."sourceIsolationId"
                 AND NULLIF(BTRIM(i."closePhoto"), '') IS NOT NULL
                 AND COALESCE(i."restorationDate", i."archivedAt", i."updatedAt", i."createdAt") < $1
             )
           )
       ) AS "dismantleRecords",
       (
         SELECT COUNT(DISTINCT i."id")::int
         FROM "Isolation" i
         WHERE NULLIF(BTRIM(i."closePhoto"), '') IS NOT NULL
           AND COALESCE(i."restorationDate", i."archivedAt", i."updatedAt", i."createdAt") < $1
           AND EXISTS (
             SELECT 1
             FROM "DismantleHistory" dh
             WHERE dh."sourceIsolationId" = i."id"
               AND COALESCE(dh."closedAt", dh."createdAt") < $1
           )
       ) AS "linkedIsolationPhotos";`,
    cutoff,
  )

  return rows[0] ?? emptyCounts()
}

async function clearPsbPhotoBatch(cutoff: Date) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `WITH expired AS (
       SELECT "id"
       FROM "Ticket"
       WHERE "createdAt" < $1 AND "fotoRumah" IS NOT NULL
       ORDER BY "createdAt" ASC, "id" ASC
       LIMIT $2
       FOR UPDATE SKIP LOCKED
     )
     UPDATE "Ticket" AS ticket
     SET "fotoRumah" = NULL, "hasPhoto" = FALSE
     FROM expired
     WHERE ticket."id" = expired."id"
     RETURNING ticket."id";`,
    cutoff,
    PHOTO_RETENTION_BATCH_SIZE,
  )
  return rows.length
}

async function clearTroubleTicketLegacyPhotoBatch(cutoff: Date) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `WITH expired AS (
       SELECT "id"
       FROM "TroubleTicket"
       WHERE COALESCE("closedAt", "openedAt", "createdAt") < $1
         AND COALESCE(array_length("closePhotos", 1), 0) > 0
       ORDER BY COALESCE("closedAt", "openedAt", "createdAt") ASC, "id" ASC
       LIMIT $2
       FOR UPDATE SKIP LOCKED
     )
     UPDATE "TroubleTicket" AS ticket
     SET "closePhotos" = NULL
     FROM expired
     WHERE ticket."id" = expired."id"
     RETURNING ticket."id";`,
    cutoff,
    PHOTO_RETENTION_BATCH_SIZE,
  )
  return rows.length
}

async function clearDismantlePhotoBatch(cutoff: Date) {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ historyCount: number; isolationCount: number }>
  >(
    `WITH expired AS (
       SELECT dh."id", dh."sourceIsolationId"
       FROM "DismantleHistory" AS dh
       LEFT JOIN "Isolation" AS isolation
         ON isolation."id" = dh."sourceIsolationId"
       WHERE COALESCE(dh."closedAt", dh."createdAt") < $1
         AND (
           NULLIF(BTRIM(dh."closePhoto"), '') IS NOT NULL
           OR COALESCE(array_length(dh."closePhotos", 1), 0) > 0
           OR (
             NULLIF(BTRIM(isolation."closePhoto"), '') IS NOT NULL
             AND COALESCE(
               isolation."restorationDate",
               isolation."archivedAt",
               isolation."updatedAt",
               isolation."createdAt"
             ) < $1
           )
         )
       ORDER BY COALESCE(dh."closedAt", dh."createdAt") ASC, dh."id" ASC
       LIMIT $2
       FOR UPDATE OF dh SKIP LOCKED
     ),
     cleared_isolations AS (
       UPDATE "Isolation" AS isolation
       SET "closePhoto" = NULL
       FROM expired
       WHERE isolation."id" = expired."sourceIsolationId"
         AND isolation."closePhoto" IS NOT NULL
         AND COALESCE(
           isolation."restorationDate",
           isolation."archivedAt",
           isolation."updatedAt",
           isolation."createdAt"
         ) < $1
       RETURNING isolation."id"
     ),
     cleared_history AS (
       UPDATE "DismantleHistory" AS history
       SET "closePhoto" = NULL, "closePhotos" = NULL
       FROM expired
       WHERE history."id" = expired."id"
       RETURNING history."id"
     )
     SELECT
       (SELECT COUNT(*)::int FROM cleared_history) AS "historyCount",
       (SELECT COUNT(*)::int FROM cleared_isolations) AS "isolationCount";`,
    cutoff,
    PHOTO_RETENTION_BATCH_SIZE,
  )
  return {
    historyCount: Number(rows[0]?.historyCount ?? 0),
    isolationCount: Number(rows[0]?.isolationCount ?? 0),
  }
}

export async function purgeExpiredOperationalPhotos(
  cutoff: Date,
  expiredBefore: ExpiredPhotoCounts,
): Promise<PhotoRetentionResult> {
  const deleted = emptyCounts()
  let failedTroubleTicketFiles = 0

  for (let batch = 0; batch < PHOTO_RETENTION_MAX_BATCHES; batch += 1) {
    const psbRecords = await clearPsbPhotoBatch(cutoff)
    const troubleTicketLegacyRecords = await clearTroubleTicketLegacyPhotoBatch(cutoff)
    const dismantle = await clearDismantlePhotoBatch(cutoff)
    const troubleFiles = await deleteExpiredTicketPhotos(cutoff, PHOTO_RETENTION_BATCH_SIZE)

    deleted.psbRecords += psbRecords
    deleted.troubleTicketLegacyRecords += troubleTicketLegacyRecords
    deleted.dismantleRecords += dismantle.historyCount
    deleted.linkedIsolationPhotos += dismantle.isolationCount
    deleted.troubleTicketFiles += troubleFiles.deleted
    failedTroubleTicketFiles += troubleFiles.failed

    const madeProgress =
      psbRecords > 0 ||
      troubleTicketLegacyRecords > 0 ||
      dismantle.historyCount > 0 ||
      dismantle.isolationCount > 0 ||
      troubleFiles.deleted > 0
    if (!madeProgress) break
  }

  return {
    cutoff: cutoff.toISOString(),
    expiredBefore,
    deleted,
    remaining: await countExpiredOperationalPhotos(cutoff),
    failedTroubleTicketFiles,
  }
}
