# CS DASHBOARD — LAPORAN IMPLEMENTASI

Versi fitur: **1.13.0**
Versi final setelah remediasi keamanan: **1.13.1**
Tanggal: 2026-11-10
Scope: web-psb-perkasa

## 1. Latar Belakang

Role `CS` dan `ADMIN_CS` belum memiliki Dashboard. Padahal dashboard dibutuhkan untuk
laporan dan pemantauan operasional harian. Kerangka dashboard sebenarnya sudah menangani
role CS (`isCsRole` di `DashboardView`), dan KPI divisi `CS_ADMIN` sudah dihitung di server,
namun menu `dashboard` belum diberikan ke role CS sehingga `proxy.ts` memblokir akses ke `/`.

## 2. Keputusan Desain (disetujui user)

1. **Bentuk**: mengaktifkan dashboard utama (bukan halaman baru) — fokus otomatis ke divisi CS.
2. **Konten utama**: Status & progres tiket PSB, Isolir & Restorasi, Dismantle, Trouble Ticket.
3. **Scope data**: global perusahaan.

## 3. Perubahan

### 3.1 RBAC — `src/lib/access.ts`
- Menu untuk role `CS` dan `ADMIN_CS` ditambahkan `'dashboard'`:
  `['dashboard', 'input', 'list', 'daily-activity', 'isolir', 'dismantle', 'odp', 'trouble-ticket']`.
- Efek lanjutan (otomatis, tanpa perubahan lain):
  - `getDefaultPathForRole` mengarahkan CS/ADMIN_CS ke `/` setelah login (sebelumnya Input PSB).
  - `proxy.ts` mengizinkan akses ke `/` (sebelumnya redirect ke default path).
  - Menu Dashboard muncul di `Sidebar`, `Header`, dan tombol Beranda mobile (`MobileNavigation`).
  - `canMutateMenu(role, 'dashboard')` tetap `false` (dashboard murni baca-saja).

### 3.2 Server — `src/app/(dashboard)/page.tsx`
Tidak diubah. Untuk role non-admin, `selectedDivision` mengikuti `getDivisionFromRole('CS') = 'CS_ADMIN'`,
sehingga seluruh data dashboard (status PSB, tren, KPI divisi CS) sudah terhitung dengan benar.
Kartu `Performa Divisi` dan blok `KPI Divisi` untuk `CS_ADMIN` dihitung persis pada blok `selectedDivision === 'CS_ADMIN'`.

### 3.3 Komponen — `src/components/DashboardView.tsx`
Tidak diubah. Blok yang tampil untuk role CS (melalui `isCsRole` / `focusedDivision = 'CS_ADMIN'`):
- `Performa Divisi` → kartu CS: Open / On Progress / Close (status tiket PSB).
- `KPI Divisi` → Isolir Baru, Restorasi, Close Rate, Isolir Aktif, Siap Dismantle, Siklus Rata-rata.
- `Tren PSB` dan `Tren Trouble Ticket`.
- Tabel Kinerja Marketing (sesuai scope global yang dipilih).

### 3.4 Test RBAC — `src/lib/access.test.ts`
- Test baru: `CS and ADMIN_CS gain the operational dashboard without mutation rights`.

### 3.5 Dokumentasi & Versi
- `CHANGELOG.md`: entri `[1.13.0]`.
- `package.json` & `package-lock.json`: rilis fitur `1.13.0`, versi final `1.13.1`.

## 4. Verifikasi

| Item | Perintah | Hasil |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | exit 0 |
| Lint repo | `npm run lint -- --ignore-pattern forge-jwt.js --ignore-pattern forge-jwt2.js` | exit 0 |
| Unit test RBAC + navigasi | `npx tsx --test src/lib/access.test.ts src/lib/mobile-nav.test.ts` | 23 passed, 0 failed |
| Build final | `npm run build` | exit 0; compile sukses dan 52/52 halaman statis |

## 5. Catatan

- Perubahan bersifat additif pada RBAC; role lain tidak terpengaruh.
- Dashboard tetap read-only untuk CS (tanpa hak mutasi).
- `ADMIN_CS` tetap identik dengan `CS` (dijaga oleh test `ADMIN_CS preserves the same menu and mutation matrix as CS`).
