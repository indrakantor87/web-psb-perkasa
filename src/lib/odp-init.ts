import { prisma } from '@/lib/prisma'

type GlobalState = {
  __odpInitPromise?: Promise<void>
}

const g = globalThis as unknown as GlobalState

export async function ensureOdpTable() {
  if (!g.__odpInitPromise) {
    g.__odpInitPromise = (async () => {
      try {
        const checks = await prisma.$queryRaw<
          Array<{
            table_exists: boolean
            has_wilayah: boolean
            has_idx_active: boolean
            has_idx_wilayah: boolean
            has_idx_nama: boolean
            has_uq_active: boolean
            has_policy: boolean
            rls_enabled: boolean
            rls_forced: boolean
          }>
        >`
          WITH tbl AS (
            SELECT EXISTS (
              SELECT 1
              FROM information_schema.tables
              WHERE table_schema = current_schema()
                AND table_name = 'psb_odp'
            ) AS table_exists
          ),
          cols AS (
            SELECT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_schema = current_schema()
                AND table_name = 'psb_odp'
                AND column_name = 'wilayah'
            ) AS has_wilayah
          ),
          idx AS (
            SELECT
              EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'psb_odp' AND indexname = 'idx_psb_odp_active') AS has_idx_active,
              EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'psb_odp' AND indexname = 'idx_psb_odp_wilayah') AS has_idx_wilayah,
              EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'psb_odp' AND indexname = 'idx_psb_odp_nama_odp') AS has_idx_nama,
              EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'psb_odp' AND indexname = 'uq_psb_odp_key_active') AS has_uq_active
          ),
          pol AS (
            SELECT EXISTS (
              SELECT 1
              FROM pg_policies
              WHERE schemaname = current_schema()
                AND tablename = 'psb_odp'
                AND policyname = 'psb_odp_service_role_all'
            ) AS has_policy
          ),
          rls AS (
            SELECT
              COALESCE(c.relrowsecurity, false) AS rls_enabled,
              COALESCE(c.relforcerowsecurity, false) AS rls_forced
            FROM pg_class c
            WHERE c.oid = 'psb_odp'::regclass
          )
          SELECT
            tbl.table_exists,
            cols.has_wilayah,
            idx.has_idx_active,
            idx.has_idx_wilayah,
            idx.has_idx_nama,
            idx.has_uq_active,
            pol.has_policy,
            COALESCE(rls.rls_enabled, false) AS rls_enabled,
            COALESCE(rls.rls_forced, false) AS rls_forced
          FROM tbl, cols, idx, pol
          LEFT JOIN rls ON TRUE;
        `

        const c = checks[0]
        if (
          c?.table_exists &&
          c?.has_wilayah &&
          c?.has_idx_active &&
          c?.has_idx_wilayah &&
          c?.has_idx_nama &&
          c?.has_uq_active &&
          c?.has_policy &&
          c?.rls_enabled &&
          c?.rls_forced
        ) {
          return
        }
      } catch {}

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
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_psb_odp_active_wilayah_id_desc ON psb_odp (wilayah, id DESC) WHERE is_active = TRUE;`)

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
