import { prisma } from '@/lib/prisma'

type GlobalState = {
  __odpInitPromise?: Promise<void>
}

const g = globalThis as unknown as GlobalState

export async function ensureOdpTable() {
  if (!g.__odpInitPromise) {
    g.__odpInitPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS psb_odp (
          id SERIAL PRIMARY KEY,
          nama_odp VARCHAR(100) NOT NULL,
          wilayah VARCHAR(50) NOT NULL DEFAULT 'Pati',
          lokasi TEXT NOT NULL,
          kapasitas INT NOT NULL DEFAULT 8,
          terpakai INT NOT NULL DEFAULT 0,
          status_tiang VARCHAR(50) NOT NULL DEFAULT 'Tegak',
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `)

      await prisma.$executeRawUnsafe(`
        ALTER TABLE psb_odp
        ADD COLUMN IF NOT EXISTS wilayah VARCHAR(50) NOT NULL DEFAULT 'Pati';
      `)

      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE psb_odp ENABLE ROW LEVEL SECURITY;`)
        await prisma.$executeRawUnsafe(`ALTER TABLE psb_odp FORCE ROW LEVEL SECURITY;`)
        await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS psb_odp_service_role_all ON psb_odp;`)
        await prisma.$executeRawUnsafe(
          `CREATE POLICY psb_odp_service_role_all ON psb_odp FOR ALL TO service_role USING (true) WITH CHECK (true);`
        )
      } catch {}

      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_psb_odp_active ON psb_odp (is_active);`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_psb_odp_wilayah ON psb_odp (wilayah);`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_psb_odp_nama_odp ON psb_odp (nama_odp);`)

      try {
        await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_psb_odp_nama_odp_trgm ON psb_odp USING gin (nama_odp gin_trgm_ops);`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_psb_odp_lokasi_trgm ON psb_odp USING gin (lokasi gin_trgm_ops);`)
      } catch {}

      const idx = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE schemaname = current_schema()
            AND tablename = 'psb_odp'
            AND indexname = 'uq_psb_odp_key_active'
        ) AS "exists"
      `
      if (!idx[0]?.exists) {
        await prisma.$executeRawUnsafe(`
          WITH ranked AS (
            SELECT id,
                   row_number() OVER (PARTITION BY lower(nama_odp), lower(wilayah) ORDER BY id DESC) AS rn
            FROM psb_odp
            WHERE is_active = TRUE
          )
          UPDATE psb_odp
          SET is_active = FALSE, updated_at = NOW()
          WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
        `)
        await prisma.$executeRawUnsafe(
          `CREATE UNIQUE INDEX IF NOT EXISTS uq_psb_odp_key_active ON psb_odp ((lower(nama_odp)), (lower(wilayah))) WHERE is_active = TRUE;`
        )
      }
    })()
  }
  await g.__odpInitPromise
}
