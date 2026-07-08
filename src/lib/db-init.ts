import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

type GlobalState = {
  __dbInitPromise?: Promise<void>
  __userDivisionInitPromise?: Promise<void>
  __userRoleInitPromise?: Promise<void>
}

const g = globalThis as unknown as GlobalState

export async function ensureDbOptimizations() {
  if (!g.__dbInitPromise) {
    g.__dbInitPromise = (async () => {
      try {
        await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`)
      } catch {}

      const statements: string[] = [
        `CREATE INDEX IF NOT EXISTS "Ticket_statusOrder_idx" ON "Ticket" ("statusOrder");`,
        `CREATE INDEX IF NOT EXISTS "Ticket_statusOrder_requestDate_idx" ON "Ticket" ("statusOrder", "requestDate");`,
        `CREATE INDEX IF NOT EXISTS "Isolation_status_isolationDate_idx" ON "Isolation" ("status", "isolationDate");`,
      ]

      for (const sql of statements) {
        try {
          await prisma.$executeRawUnsafe(sql)
        } catch {}
      }

      const trigramStatements: string[] = [
        `CREATE INDEX IF NOT EXISTS idx_psb_odp_nama_odp_trgm ON psb_odp USING gin (nama_odp gin_trgm_ops);`,
        `CREATE INDEX IF NOT EXISTS idx_psb_odp_lokasi_trgm ON psb_odp USING gin (lokasi gin_trgm_ops);`,
        `CREATE INDEX IF NOT EXISTS "Ticket_customerName_trgm_idx" ON "Ticket" USING gin ("customerName" gin_trgm_ops);`,
        `CREATE INDEX IF NOT EXISTS "Ticket_pengawalan_trgm_idx" ON "Ticket" USING gin ("pengawalan" gin_trgm_ops);`,
        `CREATE INDEX IF NOT EXISTS "Isolation_customerName_trgm_idx" ON "Isolation" USING gin ("customerName" gin_trgm_ops);`,
        `CREATE INDEX IF NOT EXISTS "Isolation_marketing_trgm_idx" ON "Isolation" USING gin ("marketing" gin_trgm_ops);`,
      ]
      for (const sql of trigramStatements) {
        try {
          await prisma.$executeRawUnsafe(sql)
        } catch {}
      }

      try {
        await prisma.ticket.updateMany({
          where: { status: 'PENDING' },
          data: { status: 'ON_PROGRESS', statusOrder: 1 },
        })
      } catch {}

      if (process.env.NODE_ENV !== 'production' && process.env.SEED_DEV_ADMIN === '1') {
        try {
          const userCount = await prisma.user.count()
          if (userCount === 0) {
            const hashed = await bcrypt.hash('123456', 10)
            await prisma.user.create({
              data: {
                name: 'Admin',
                username: 'admin',
                password: hashed,
                role: 'ADMIN',
              },
            })
          }
        } catch {}
      }
    })()
  }
  await g.__dbInitPromise
}

export async function ensureUserDivisionColumn() {
  if (!g.__userDivisionInitPromise) {
    g.__userDivisionInitPromise = (async () => {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "division" TEXT;`)
      } catch (e) {
        g.__userDivisionInitPromise = undefined
        throw e
      }
    })()
  }
  await g.__userDivisionInitPromise
}

function quoteLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

async function resolveUserTableName() {
  const candidates = [
    { reg: '"User"', name: 'User' },
    { reg: '"user"', name: 'user' },
  ]
  for (const c of candidates) {
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ tableName: string | null }>>(
        `SELECT to_regclass(${quoteLiteral(c.reg)})::text AS "tableName";`
      )
      if (rows?.[0]?.tableName) return c
    } catch {}
  }
  return null
}

export async function ensureUserRoleValues() {
  if (!g.__userRoleInitPromise) {
    g.__userRoleInitPromise = (async () => {
      const table = await resolveUserTableName()
      if (!table) return

      const allowedRoles = [
        'ADMIN',
        'CS',
        'ADMIN_CS',
        'NOC',
        'MARKETING',
        'TEKNISI',
        'TROUBLESHOOTS',
        'CREATOR_DIGITAL',
        'DISMANTLE',
      ]

      try {
        const rows = await prisma.$queryRawUnsafe<Array<{ data_type: string; udt_name: string }>>(
          `SELECT data_type, udt_name
           FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = ${quoteLiteral(table.name)} AND column_name = 'role'
           LIMIT 1;`
        )
        const info = rows?.[0]
        if (info?.data_type === 'USER-DEFINED' && info.udt_name) {
          const typeIdent = quoteIdent(info.udt_name)
          for (const role of allowedRoles) {
            try {
              await prisma.$executeRawUnsafe(`ALTER TYPE ${typeIdent} ADD VALUE ${quoteLiteral(role)};`)
            } catch {}
          }
        }
      } catch {}

      try {
        const constraints = await prisma.$queryRawUnsafe<Array<{ conname: string; def: string }>>(
          `SELECT conname, pg_get_constraintdef(oid) AS def
           FROM pg_constraint
           WHERE conrelid = ${table.reg}::regclass
             AND contype = 'c'
             AND pg_get_constraintdef(oid) ILIKE '%role%';`
        )

        for (const c of constraints) {
          const def = String(c.def ?? '')
          if (!def.toLowerCase().includes('role')) continue
          try {
            await prisma.$executeRawUnsafe(
              `ALTER TABLE ${table.reg} DROP CONSTRAINT IF EXISTS ${quoteIdent(String(c.conname))};`
            )
          } catch {}
        }

        const constraintName = `${table.name}_role_check`
        const roleLiterals = allowedRoles.map(quoteLiteral).join(', ')
        await prisma.$executeRawUnsafe(
          `ALTER TABLE ${table.reg}
           ADD CONSTRAINT ${quoteIdent(constraintName)}
           CHECK ("role" IN (${roleLiterals}));`
        )
      } catch {}
    })()
  }

  await g.__userRoleInitPromise
}
