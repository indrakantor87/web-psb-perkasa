# HR ATTENDANCE — VISIBILITAS SEMUA ROLE & SCOPE ABSENSI PRIBADI

- **Versi fitur**: 1.13.1 → **1.17.0**
- **Versi saat ini**: **1.17.1**
- **Tanggal**: 2026-11-11 (WIB)
- **Branch**: `main`
- **Baseline SHA**: `f545c40` (Daily Activity: gabung NOC & Troubleshoots, papan harian dikelompokkan per sub divisi)
- **Status verifikasi**: TypeScript, ESLint, dan build produksi lulus; unit test RBAC/navigasi = 22 lulus (1 gagal pre-existing)

---

## 1. Ringkasan

Menu **Absensi** sebelumnya hanya terbuka untuk sebagian role. Perubahan ini membuat menu
Absensi **tampil untuk semua role** pada **desktop maupun mobile**, sambil membatasi
**cakupan data** sesuai akun yang login.

- **User biasa** hanya dapat melihat **absensi miliknya sendiri** (berbasis kepemilikan nama karyawan).
- **Developer, Priority, Admin, dan HR** **tidak diubah** perilakunya: tetap dapat melihat
  absensi **seluruh karyawan**.

Pemisahan dilakukan dua lapis: **visibilitas menu** (RBAC) dan **scope data** (filter query di API).

---

## 2. Aturan yang Diterapkan

| Lapisan | Perilaku |
|---|---|
| Visibilitas menu | Semua role dapat membuka `/hr` (desktop: Header; mobile: bottom-nav + lembar Menu) |
| Scope data | Role di luar Developer/Priority/Admin/HR difilter ke `employeeId` miliknya sendiri |
| Fail-closed | Bila nama akun kosong atau **tidak unik** → filter `-1` (tidak ada record yang cocok) |
| Daftar Karyawan | Tab "Daftar Karyawan" + halaman `/hr/employees` hanya untuk Developer/Priority/Admin/HR |
| Masking | `fingerprintId` di-mask (`null`) pada response API untuk role self-only |

### Matriks per role

| Role | Lihat seluruh karyawan | Menu Absensi | Tab "Daftar Karyawan" |
|---|---|---|---|
| DEVELOPER | Ya | Ya | Ya |
| ADMIN | Ya | Ya | Ya |
| PRIORITY | Ya | Ya | Ya |
| HR | Ya | Ya | Ya |
| MARKETING | Tidak (milik sendiri) | Ya | Tidak |
| CS / ADMIN_CS | Tidak | Ya | Tidak |
| NOC / TEKNISI / TROUBLESHOOTS / DISMANTLE | Tidak | Ya | Tidak |
| CREATOR_DIGITAL | Tidak | Ya | Tidak |
| GENERAL_AFFAIR / OPERASIONAL | Tidak | Ya | Tidak |

---

## 3. File Diubah

| File | Perubahan |
|---|---|
| `src/lib/access.ts` | `menus.add('hr')` di akhir `getAccessibleMenus` (semua role bisa buka `/hr`); dokumentasi `canAccessHrEmployees` |
| `src/lib/hr-employee-owner.ts` | Fungsi baru `resolveUniqueEmployeeIdByName(name)` — memetakan user login ke karyawan berdasarkan nama unik (fail-closed) |
| `src/app/api/hr/attendance/route.ts` | Scope data: role self-only difilter ke `employeeId` sendiri; masking `fingerprintId` |
| `src/app/api/hr/employees/route.ts` | Scope daftar karyawan: role self-only difilter ke dirinya sendiri; masking `fingerprintId` |
| `src/components/HrTabs.tsx` | Prop `canViewEmployees`; tab "Daftar Karyawan" disembunyikan untuk role self-only |
| `src/app/(dashboard)/hr/page.tsx` | Meneruskan `canViewEmployees={canAccessHrEmployees(role)}` ke `HrTabs` |
| `src/app/(dashboard)/hr/employees/page.tsx` | Guard redirect ke `/hr` untuk role self-only |
| `src/components/HrAttendanceView.tsx` | Filter Cari/Divisi disembunyikan & `EmptyState` disesuaikan untuk role self-only |

---

## 4. Alur Logika Scope

```
role = session.user.role (UPPER)
isSelfOnly = !canAccessHrEmployees(role)          // true kecuali DEVELOPER/ADMIN/PRIORITY/HR
if (isSelfOnly) {
  selfEmployeeId = role === 'MARKETING'
    ? resolveUniqueMarketingEmployeeId(userId, name)
    : resolveUniqueEmployeeIdByName(name)
  where.employeeId = selfEmployeeId ?? -1         // fail-closed
}
```

- `MARKETING` memakai resolver legacy (`resolveUniqueMarketingEmployeeId`) yang juga memvalidasi
  role user unik, untuk kompatibilitas dengan modul otomatisasi absensi marketing.
- Role self-only lain memakai `resolveUniqueEmployeeIdByName` (nama unik karyawan).
- Parameter `employeeId` dari klien diabaikan bila bukan milik pengguna yang login.

---

## 5. Verifikasi

| Pemeriksaan | Hasil |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | Lulus (exit 0) |
| `npx eslint` (8 file terubah) | Lulus (exit 0) |
| `npx tsx --test src/lib/access.test.ts src/lib/mobile-nav.test.ts` | 22 lulus, 1 gagal (pre-existing) |
| `npm run build` | Lulus; route table produksi berhasil dibuat |

### Catatan kegagalan tes

Tes **"HR can manage HR while marketing activity access remains read-only"** gagal pada assertion
`canAccessMenu('HR', 'marketing-activities') === true`. Ini **pre-existing/regresi lama**, bukan
akibat perubahan ini: blok menu HR (`menuSet(['dashboard', 'hr'])`) tidak disentuh pada diff,
dan `menus.add('hr')` hanya menambah menu `hr`. Sesuai kebijakan role HR yang memang dilarang
melihat menu Aktivitas Marketing, assertion tes tersebut tidak relevan dengan permintaan ini dan
**tidak diubah** (di luar scope).

---

## 6. Batas Verifikasi

- Tidak dilakukan pengujian end-to-end terhadap data produksi (login nyata per role).
- Pencocokan kepemilikan mengandalkan **nama karyawan yang unik** pada tabel `Employee`; bila terdapat
  dua karyawan dengan nama identik, user tersebut tidak akan melihat data apa pun (fail-closed),
  bukan melihat data karyawan lain.

---

## 7. Tindak Lanjut — Versi 1.17.1

- Mengganti kartu `Karyawan Tercatat` menjadi tiga metrik: `Total Kehadiran`, `Valid`, dan `Invalid`.
- Kehadiran berstatus **Valid** bila `checkIn` dan `checkOut` tersedia; bila salah satu tidak tersedia,
  status hitungan masuk **Invalid**.
- Jumlah karyawan pada rekap divisi tidak ditampilkan untuk role self-only.
- Memperbaiki kondisi data tampak kosong untuk user biasa: UI sebelumnya memfilter karyawan memakai
  `fingerprintId`, sementara API sengaja menyamarkan nilai tersebut untuk menjaga privasi. Filter UI
  sekarang mengikuti akses role dan tidak bergantung pada nilai yang disamarkan.
- Memperjelas pesan kondisi kosong bahwa HR perlu menarik data bulan tersebut dari mesin fingerprint.
- Verifikasi tindak lanjut: TypeScript, ESLint endpoint/komponen, dan build produksi lulus.
- Tes RBAC/navigasi: 22 lulus, 1 gagal pre-existing pada assertion HR dapat membuka Aktivitas Marketing;
  kegagalan ini tidak terkait perubahan absensi.
