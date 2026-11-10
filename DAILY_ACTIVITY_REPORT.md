# DAILY ACTIVITY PSB — IMPLEMENTATION REPORT

- **Versi fitur**: 1.11.20 → **1.12.0** (CS Dashboard 1.13.0; remediasi keamanan 1.13.1)
- **Versi saat ini**: **1.13.1**
- **Tanggal**: 2026-11-10 (WIB)
- **Branch**: `main`
- **Baseline SHA**: `059fa6a` (chore(debug): add env debug endpoint and deploy marker)
- **Sumber pola**: modul Daily Activity web ERP (paritas) + modul `marketing-activities` web PSB
- **Status verifikasi**: `tsc --noEmit` = 0 error; `next build` = sukses (artefak terverifikasi)

---

## 1. Ringkasan

Modul **Daily Activity** diterapkan di web PSB mengikuti pola ERP, disesuaikan dengan stack PSB
(PostgreSQL + Prisma, tanpa konsep `branch`). Fitur aktif mencakup Rencana, Smart Paste, Update/Close,
Performa, Kalender, panel Profil Divisi, Export Excel, dan Salin Ringkasan.

Approval mengikuti pola ERP: hanya level **LEADER/SPV/MANAGER** yang dapat menyetujui, dibatasi pada
**divisi yang sama** dan **bawahan** (rank level lebih rendah), serta **bukan item milik sendiri**.
Divisi mengikuti **departemen HR PSB** (`HR_DIVISIONS`).

> **Pembaruan (revisi user)**: tahap **approval dinonaktifkan sementara**. Alur aktif saat ini:
> karyawan mengisi **rencana** pada pagi hari → melengkapi **status & catatan hasil** pada sore hari
> (tombol Update). Seluruh UI approval (tab Antrian Approval, filter Status Approval, kolom Approval,
> tombol Setujui/Tolak, modal approval, checkbox "Ajukan approval") **dihapus dari tampilan**.
> Model data, service, dan endpoint `/api/daily-activity/approval` **tetap utuh di server** agar
> dapat diaktifkan kembali tanpa migrasi.

---

## 2. Keputusan yang Diambil (via konfirmasi user)

| Topik | Keputusan |
|---|---|
| Cakupan fitur | Rencana pagi + hasil sore, Smart Paste, Performa, Kalender, Profil Divisi, Export; approval dinonaktifkan sementara |
| Input & Approve | Ikuti pola ERP (atasan divisi: level + kesamaan divisi) |
| Struktur divisi | Pakai departemen HR PSB (`HR_DIVISIONS`) |
| Preventif disk penuh | Cron host pembersih Docker; skrip setup disiapkan, instalasi server belum diverifikasi |

---

## 3. File Baru

| File | Peran |
|---|---|
| `prisma/schema.prisma` (2 model ditambahkan) | Model `DailyActivityItem` + `DailyActivityProfile` |
| `src/lib/daily-activity-org.ts` | Konstanta organisasi (level, status, prioritas, subdivisi per divisi HR) — client-safe |
| `src/lib/daily-activity-schema.ts` | `ensureDailyActivityTables()` inisialisasi tabel + index via raw SQL (runtime, promise cache) |
| `src/lib/daily-activity-service.ts` | Kontrak server: scope, DTO, query, create, close, review approval, profil, export |
| `src/app/api/daily-activity/route.ts` | `GET` daftar + page data (filter) · `POST` create/batch (Smart Paste) |
| `src/app/api/daily-activity/[id]/route.ts` | `PATCH` close/update · `DELETE` |
| `src/app/api/daily-activity/approval/route.ts` | `POST` bulk approval (`APPROVE`/`REJECT`) |
| `src/app/api/daily-activity/profile/route.ts` | `PATCH` simpan profil divisi · `GET` health |
| `src/app/(dashboard)/daily-activity/page.tsx` | Server component; guard session + `canAccessMenu` |
| `src/components/DailyActivityView.tsx` | Komponen klien (toolbar, filter, 4 tab aktif tanpa approval, update, export, salin ringkasan) |

## 4. File Diubah

| File | Perubahan |
|---|---|
| `src/lib/access.ts` | Tambah menu `daily-activity` (`AppMenuKey`, `getMenuHref`, akses role, `canMutateMenu`) |
| `src/components/Sidebar.tsx` | Link "Daily Activity" |
| `src/components/Header.tsx` | Link menu flat "Daily Activity" |
| `src/lib/mobile-nav.ts` | Entry mobile + urutan primary |
| `src/app/(dashboard)/settings/role-audit/page.tsx` | Tambah `daily-activity` ke matriks Role Audit |
| `src/lib/access.test.ts` | Tambah `daily-activity` ke daftar menu yang diuji |
| `package.json` / `package-lock.json` | Versi final 1.13.1 |
| `CHANGELOG.md` | Entri Daily Activity 1.12.0, CS Dashboard 1.13.0, security fix 1.13.1 |

---

## 5. RBAC & Navigasi

Menu `daily-activity` diberikan ke: **ADMIN, DEVELOPER, PRIORITY, HR, MARKETING, CS, ADMIN_CS, NOC,
TEKNISI, TROUBLESHOOTS, DISMANTLE, CREATOR_DIGITAL**. `canMutateMenu('daily-activity') = true` untuk
semua role yang memiliki menu; pembatasan operasional dijaga di lapisan service (scope kepemilikan/divisi).

**Aturan scope data:**
- `admin` (`isAdmin`) → akses semua data.
- `isApprover` / scope `team` → data milik sendiri **atau** divisi yang sama.
- selain itu (scope `mine`) → hanya data milik sendiri (`ownerUserId`).

**Aturan approval** (server, `canApproveDailyActivityItem`) — **sedang tidak dipakai di UI**:
status `PENDING` **dan** (admin **atau** (isApprover **dan** owner ≠ self **dan** divisi sama **dan**
rank(owner) < rank(approver))). Dipertahankan di server untuk aktivasi kembali.

**Tab UI aktif saat ini**: Workspace, Performa, Kalender, Profil Divisi (tanpa Antrian Approval).

---

## 6. Skema Data & Migrasi

- Tabel: `psb_daily_activity_items`, `psb_daily_activity_profiles` (prefix `psb_`).
- Ditambahkan ke `prisma/schema.prisma` sebagai model `DailyActivityItem` & `DailyActivityProfile`.
- Pembuatan tabel **tidak** memerlukan migrasi manual: `ensureDailyActivityTables()` membuat tabel +
  5 index saat runtime (pola sama dengan `ensureOdpTable`).
- `prisma generate` berjalan otomatis pada tahap build Docker (`"build": "prisma generate && next build --webpack"`).
- Kode aktivitas: format `DA-YYYYMM-####` (generate server-side dengan retry).

---

## 7. Verifikasi (Executed)

| Verifikasi | Perintah | Hasil |
|---|---|---|
| Prisma Client + TypeScript | `npm run build` | Lulus; termasuk `prisma generate` dan pemeriksaan TypeScript |
| ESLint | `npm run lint -- --ignore-pattern forge-jwt.js --ignore-pattern forge-jwt2.js` | Lulus; dua skrip scratch dikecualikan dan tidak dikomit |
| Tes RBAC + navigasi mobile | `npx tsx --test src/lib/access.test.ts src/lib/mobile-nav.test.ts` | 23 passed, 0 failed |
| Build produksi final | `npm run build` | Lulus; 52/52 halaman statis dan seluruh route Daily Activity terdaftar |

---

## 8. Pencegahan Insiden Disk Penuh (Preventif)

**Akar masalah insiden lalu**: Docker *build cache* menumpuk (~47.79 GB) sehingga disk server 100% →
container PostgreSQL crash-loop → aplikasi HTTP 500.

**Artefak yang disiapkan**: `SETUP-SERVER-DISK-GUARD.ps1` di root workspace, di luar repository ini.
Skrip tersebut dirancang memasang cron **host** di server `103.162.17.178`, tetapi belum dijalankan;
status pemasangan dan kapasitas disk saat ini **belum terverifikasi**:

- Script: `/usr/local/bin/coolify-disk-guard.sh` → `docker builder prune -af` + `docker image prune -f`;
  bila pemakaian disk ≥ 80% dilanjutkan `docker network prune -f` + `docker volume prune -f`.
- Jadwal: **harian 03:30** via `/etc/cron.d/coolify-disk-guard`.
- Log: `/var/log/coolify-disk-guard.log` (auto-trim pada > 5 MB).
- Aman: tidak menghapus container berjalan, tidak menyentuh volume database, tidak menghapus image aktif.

> Catatan teknis: **Coolify "Scheduled Task" berjalan di dalam container aplikasi** dan tidak memiliki
> akses ke Docker daemon host, sehingga tidak dapat membersihkan build cache host. Karena itu
> pembersihan dipasang sebagai **cron host** (di server yang sama tempat Coolify membangun image).

---

## 9. Langkah Deploy (setelah push)

1. Push ke `main` dapat memicu Coolify auto-rebuild image `web-psb-*` (build menjalankan `prisma generate`).
2. Tidak perlu migrasi database manual (tabel dibuat runtime oleh `ensureDailyActivityTables`).
3. Setelah deploy, verifikasi `/daily-activity`: buat satu rencana pagi, lengkapi hasil sore, lalu cek Performa/Kalender.
4. Pemasangan `SETUP-SERVER-DISK-GUARD.ps1` tetap pending dan memerlukan akses host; jangan dianggap aktif sebelum diverifikasi.

---

## 10. Catatan Keamanan / File yang TIDAK boleh di-commit

File untracked berikut **bukan** bagian fitur ini dan **tidak boleh** ikut di-commit:

- `forge-jwt.js`, `forge-jwt2.js` (skrip debug forging JWT)
- `scripts/update_ticket_schema.ts` (utility lama, tidak terkait)

---

## 11. Status

| Item | Status |
|---|---|
| Implementasi kode (data, service, API, UI, RBAC, navigasi) | Selesai |
| Penonaktifan alur approval (UI) | Selesai |
| Dashboard CS | Selesai (1.13.0) |
| Remediasi endpoint debug | Selesai (1.13.1) |
| Verifikasi statis (TypeScript, lint, tes, build) | Lulus |
| Versioning & changelog | Selesai (1.13.1) |
| Uji fungsional di staging/produksi | **Belum** (menunggu deploy) |
| Instalasi cron disk-guard pada host | **Belum diverifikasi** |
