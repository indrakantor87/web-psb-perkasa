# Tambah Role General Affair & Operasional + Field Jabatan & Sub Divisi di Manajemen User

## Repository Research

### Sistem role saat ini:
- `User.role` disimpan sebagai **Postgres enum** di DB, tapi `String` di Prisma schema
- Daftar role di-hardcode di `APP_ROLE_VALUES` (`src/lib/access.ts`)
- `ensureUserRoleValues()` di `db-init.ts` otomatis menambah value enum ke DB saat runtime
- `getAccessibleMenus(role)` punya mapping role→menu hardcoded
- `getDefaultUserDivision(role)` di `user-division.ts` mapping role→divisi HR
- Dropdown role di `UsersClient.tsx` hardcoded (`ROLE_OPTIONS`)
- Validasi role di `validations.ts` pakai `z.enum(APP_ROLE_VALUES)`

### Field User saat ini:
`User` model punya: id, name, username, password, role, division, avatar, createdAt
Belum ada `position` (jabatan) dan `subdivision`.

## Files and Modules

- `prisma/schema.prisma` — tambah field `position String?` dan `subdivision String?` ke model `User`
- `src/lib/access.ts` — tambah `GENERAL_AFFAIR` & `OPERASIONAL` ke `APP_ROLE_VALUES`; tambah mapping menu & divisi untuk kedua role
- `src/lib/user-division.ts` — tambah `getDefaultUserDivision` untuk GENERAL_AFFAIR→General Affair, OPERASIONAL→Teknisi
- `src/lib/db-init.ts` — tambah `ensureUserPositionAndSubdivisionColumns()` (ALTER TABLE ADD COLUMN IF NOT EXISTS)
- `src/lib/validations.ts` — tambah `position` & `subdivision` opsional ke `userCreateSchema` & `userUpdateSchema`
- `src/app/api/users/route.ts` — handle `position` & `subdivision` di POST, GET, PUT
- `src/components/UsersClient.tsx` — dropdown Jabatan (HR_POSITIONS) & Sub Divisi (getHrSubdivisions by division) di form create & edit; tampilkan kolom di tabel
- `src/lib/hr-departments.ts` — sudah ada `HR_POSITIONS` & `getHrSubdivisions` (reuse, tidak perlu ubah)

## Implementation Steps

1. **Schema & DDL** — tambah `position` & `subdivision` ke User model + DDL auto-run
2. **Access & Division** — tambah 2 role ke APP_ROLE_VALUES, mapping menu & divisi
3. **Validations** — tambah field position & subdivision (optional) ke schemas
4. **API users route** — POST/PUT/GET handle position & subdivision
5. **UsersClient UI** — dropdown Jabatan + Sub Divisi di form create & edit; kolom di tabel; dropdown role ditambah 2 role baru

## Dependencies and Considerations

- **Menu access default** (pilihan wajar, bisa diubah):
  - `GENERAL_AFFAIR`: `dashboard`, `daily-activity`, `hr` (urusan kantor/legal/inventory + absensi)
  - `OPERASIONAL`: `dashboard`, `list`, `daily-activity`, `trouble-ticket`, `odp`, `dismantle`, `isolir` (operasional lapangan)
- **Divisi default**: GENERAL_AFFAIR→General Affair, OPERASIONAL→Teknisi
- **Sub Divisi**: cascading dari Divisi (pakai `getHrSubdivisions(division)` dari `hr-departments.ts`)
- **Position**: dropdown dari `HR_POSITIONS` (General Manager, Manager, SPV, Leader, PIC, Karyawan)
- Role enum otomatis ditambah DB via `ensureUserRoleValues()` (existing mechanism)
- Position & subdivision nullable, opsional saat buat user (bisa dikosongkan)
- Tidak mengubah logika RBAC existing; hanya menambah role + field baru

## Validation

- `npx tsc --noEmit`
- `npx eslint` pada file yang diubah
- `npm run build`
- Manual: form create user menampilkan dropdown Jabatan & Sub Divisi; role General Affair & Operasional muncul di dropdown; user baru tersimpan dengan position & subdivision.

## Risks

- **Risiko**: menu access default tidak sesuai kebutuhan → **handling**: mudah diubah di `getAccessibleMenus()` tanpa risiko: sub divisi tidak sesuai pilihan → handling: dropdown cascade dari division, jika divisi tidak punya daftar → handling: dropdown kosong/opsi "-"
