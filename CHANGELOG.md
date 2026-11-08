# Changelog

Semua perubahan penting pada web-psb-perkasa didokumentasikan di file ini.

Format mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.1.0/),
dan proyek ini mengikuti [Semantic Versioning](https://semver.org/lang/id/).

Kategori perubahan:
- `Added` — fitur/penambahan baru
- `Changed` — perubahan pada fungsionalitas yang sudah ada
- `Deprecated` — fitur yang akan dihapus
- `Removed` — fitur yang dihapus
- `Fixed` — perbaikan bug
- `Security` — perbaikan terkait keamanan

## [1.9.0] - 2026-11-09

### Added
- Menu HR kini memiliki tab **Absensi** dan **Daftar Karyawan** (`src/components/HrTabs.tsx`).
- Halaman **Daftar Karyawan** (`/hr/employees`): kelola nama, divisi (dropdown tetap), jabatan, status kepegawaian, tanggal masuk, ID fingerprint, dan status aktif; lengkap dengan pencarian, filter divisi, tabel desktop, kartu mobile, serta form tambah/ubah.
- API `/api/hr/employees`: GET (daftar), POST (tambah), PUT (ubah/aktifkan-nonaktifkan), DELETE (hapus — ditolak bila sudah ada riwayat absensi, agar audit tetap utuh). Dijaga `ensureMenuAccess('hr')` + `ensureMenuMutation`.
- Filter **Divisi** pada Absensi HR beserta kartu **Rekap per Divisi** (kehadiran, jumlah karyawan, total lembur).

### Changed
- Sumber daftar divisi disentralkan di `src/lib/hr-departments.ts` (Pemasaran dan Pelayanan, Customer Service, NOC & Teknisi, Creator Digital, HR & Kepegawaian).

## [1.8.2] - 2026-11-09

### Fixed
- Absensi HR: jam masuk/keluar tidak lagi bergeser +7 jam. Waktu mesin fingerprint dinormalkan ke WIB secara independen dari timezone server (`src/lib/hr-machine.ts`), sehingga tampilan jam dan pengelompokan tanggal konsisten.

### Changed
- Tabel Absensi HR disesuaikan dengan acuan modul finance: tambah kolom `No`, label status manusiawi (Hadir/Alfa/Terlambat/Invalid) menggantikan enum mentah, header `Jam Masuk`/`Jam Pulang`, format tanggal `dd Mmm yyyy`, jam berwarna hijau beserta pill "Terlambat", dan format lembur `hh.mm Jam`.

## [1.8.1] - 2026-11-08

### Fixed
- Tampilan mobile menu Isolir: kartu ringkas dipindahkan keluar dari tabel (blok `md:hidden`) dan tabel desktop dikunci hanya untuk layar >= 768px, sehingga tidak lagi ada tabel yang bergeser horizontal di perangkat seluler.

## [1.8.0] - 2026-11-08

### Added
- Modul HR absensi: menarik data absensi langsung dari mesin fingerprint (ZKTeco) via TCP socket (`zkteco-js`), meniru alur pada proyek finance.
- Model Prisma baru: `Employee`, `Attendance`, dan `HrMachineSetting` beserta self-healing schema (`src/lib/hr-schema.ts`) dan konfigurasi IP/port mesin.
- API HR: `GET /api/hr/machine` (status/kredensial mesin), `PUT /api/hr/machine` (simpan IP/port), `GET /api/hr/attendance` (daftar + rekap), `POST /api/hr/attendance/sync` (tarik dari mesin), `POST /api/hr/attendance/import` (impor log mentah JSON).
- Perhitungan absensi di sisi server: grouping per tanggal WIB, deduplikasi log (<5 menit/state sama), penentuan jam masuk/keluar, dan perhitungan lembur.
- Menu dan role baru `HR`: halaman `/hr` dengan tabel desktop dan kartu ringkas (chevron) di mobile, pengaturan mesin, serta tombol Tarik dari Mesin.
- Role `HR` didaftarkan pada RBAC (`access.ts`), validasi user (`validations.ts`), enum role database (`db-init.ts`), opsi role pada Manajemen Pengguna, dan navigasi desktop/mobile.

### Changed
- Menu admin kini juga memuat tautan "Absensi HR".

## [1.7.12] - 2026-11-08

### Fixed
- Aktifkan tampilan kartu ringkas pada mobile untuk menu Isolir dengan menghapus pemaksaan tabel desktop 1100px sehingga tidak lagi perlu menggeser tabel ke samping; tombol aksi Edit dan Transfer tetap tersedia di kartu untuk role yang berwenang.

## [1.7.11] - 2026-11-08

### Changed
- Sembunyikan filter Divisi beserta keterangannya dan tombol Import/Export pada tampilan mobile di modul Trouble Ticket, Dismantle, Isolir, Port ODP, dan Aktivitas Marketing agar tampilan lebih ringkas.

## [1.7.10] - 2026-11-08

### Fixed
- Kembalikan tombol aksi (Process, Close, Edit, Reopen, Delete) pada kartu mobile List PSB agar role Developer, Admin, dan CS tetap dapat menindaklanjuti tiket dari perangkat seluler.

## [1.7.9] - 2026-11-08

### Changed
- Pisahkan kartu mobile List PSB dari tabel desktop agar tampilan mobile tidak mewarisi lebar minimum tabel dan dapat dibaca tanpa scroll horizontal.

## [1.7.8] - 2026-11-08

### Changed
- Ringkas kartu mobile List PSB dan sembunyikan filter Divisi serta kontrol Import/Export pada tampilan mobile.

## [1.7.7] - 2026-11-08

### Changed
- Ringkas tampilan mobile List PSB, Trouble Ticket, Dismantle, dan Isolir dengan kartu yang dapat dibuka untuk melihat detail dan aksi.

## [1.7.6] - 2026-11-08

### Changed
- Hitungan Close pada kartu NOC dan tren tahunan Trouble Ticket kini mengacu ke tanggal penutupan (`closedAt`), bukan bulan tiket dibuat.

## [1.7.5] - 2026-11-08

### Changed
- Label Trouble Ticket di bottom navigation mobile disingkat menjadi TT agar muat satu baris; nama lengkap tetap dipakai di menu lainnya.

## [1.7.4] - 2026-11-08

### Changed
- Kartu ringkasan CS kini menampilkan status Open, On Progress, dan Close dari tiket PSB pada periode dashboard, menggantikan ringkasan Port ODP, Isolir, dan Dismantle.

## [1.7.3] - 2026-11-08

### Changed
- Kartu ringkasan NOC menampilkan Trouble Open, Preventive Open, dan Close dengan jumlah berdasarkan data tiket pada periode dashboard.

## [1.7.2] - 2026-11-08

### Changed
- Navigasi desktop ADMIN/DEVELOPER dan dropdown menu ADMIN di layar kecil kini menampilkan menu berdasarkan fitur, bukan dropdown Penjualan, CS, NOC, dan Creator Digital.
- Tautan berulang disatukan; Ticketing, Operasional, dan Digital menampilkan akses fitur tanpa mengubah matriks akses role. Cakupan divisi tetap dapat dipilih pada modul yang mendukung filter.

## [1.7.1] - 2026-11-08

### Added
- Menu **Ticketing** (dropdown) kini juga tampil untuk role **ADMIN** dan **DEVELOPER**, sehingga semua role memiliki satu pintu masuk tiket yang seragam.

### Changed
- Grup divisi ADMIN/DEVELOPER (Penjualan, CS, NOC, Creator Digital) dirapikan: entri tiket (List Data, Dismantle, Trouble Ticket) dipindahkan ke dropdown Ticketing agar tidak duplikat. Setiap grup divisi kini hanya berisi item non-tiket (Ringkasan Divisi, Input PSB, Aktivitas Marketing, Isolir, PORT ODP, dan menu digital).
- Tautan Ticketing untuk ADMIN/DEVELOPER tetap mengikuti perilaku navigasi lain yang sudah ada (Data PSB → divisi Penjualan, Trouble Ticket → NOC, Dismantle → CS).

## [1.7.0] - 2026-11-08

### Added
- Menu **Ticketing** (dropdown) pada navigasi header desktop yang menyatukan Data PSB, Trouble Ticket, dan Dismantle dalam satu tempat.
- Role **TEKNISI** kini memiliki akses menu **Dismantle** (termasuk wewenang mengubah status ticket dismantle).

### Changed
- Isi menu Ticketing mengikuti matriks akses yang sudah ada (`canAccessMenu`), sehingga tidak ada role yang kehilangan akses: MARKETING & CREATOR_DIGITAL (Data PSB, Dismantle), CS/ADMIN_CS & NOC (Data PSB, Trouble Ticket, Dismantle), TEKNISI (Data PSB, Trouble Ticket, Dismantle).
- Navigasi **Creator Digital** disamakan dengan Marketing (navigasi datar dengan dropdown Ticketing); menu digital (Content Calendar, Campaign, Digital Leads, Analytics) tampil sebagai tautan langsung.
- Role ADMIN dan DEVELOPER tetap memakai navigasi bergrup per-divisi (tanpa duplikasi menu).
- Fase ini hanya menyentuh navigasi header desktop; rute, API, komponen view, database, dan bottom-nav mobile tidak diubah.

## [1.6.1] - 2026-11-08

### Changed
- Tampilan Port ODP dengan filter Semua POP kini menampilkan hierarki bertahap POP → ODC → ODP → pelanggan; filter satu POP tetap dimulai dari daftar ODC.
- Nama POP dari master dan data ODP lama tetap muncul di hierarki, dengan pengelompokan otomatis untuk ODP legacy berdasarkan pola nama.

## [1.6.0] - 2026-11-08

### Changed
- Design system kini diterapkan konsisten ke modul List PSB, Trouble Ticket, dan Dismantle: kartu, judul seksi, dan warna mengikuti token yang sama dengan dashboard, tanpa mengubah fitur, logika, maupun alur data.
- Tampilan status kosong (empty state) dan pemuatan (skeleton/loading) diseragamkan di modul List PSB, Trouble Ticket, dan Dismantle, serta pada halaman pemuatan dashboard.
- Interaksi mikro halus (lift + bayangan saat hover) pada kartu ringkasan (`StatCard`), dengan dukungan `prefers-reduced-motion`.

### Added
- Primitif UI bersama: `EmptyState` dan `Skeleton`.

## [1.5.0] - 2026-11-08

### Changed
- Tampilan dashboard dimodernisasi (gaya Modern SaaS bersih) tanpa mengubah fitur, fungsi, maupun perhitungan data: tata letak kartu yang lebih lega, hierarki judul seksi yang konsisten, dan aksen warna yang lebih jelas.
- Font global aplikasi kini menggunakan Inter.
- Design token semantik baru (permukaan, garis, tinta, dan brand) untuk konsistensi tema terang/gelap.

### Added
- Primitif UI bersama: `Card`, `Chip`, `SectionHeading`, `StatCard`, `ChartCard`, serta gaya grafik (tooltip/tick/kursor) yang seragam.

## [1.4.1] - 2026-11-08

### Fixed
- Navigasi desktop kini menampilkan modul sesuai role untuk semua role, termasuk seluruh grup akses DEVELOPER serta menu operasional TROUBLESHOOTS dan DISMANTLE; navigasi mobile tetap menggunakan bottom navigation.

## [1.4.0] - 2026-11-08

### Changed
- Tampilan mobile (beranda ringkas + navigasi bawah) kini berlaku untuk semua role, dengan menu tetap dibatasi sesuai izin akses masing-masing.
- Beranda mobile adaptif: kartu "Ringkasan PSB" hanya tampil bila role memiliki akses data PSB, dan grid "Akses Cepat" hanya menampilkan modul yang boleh diakses role tersebut.
- Navigasi bawah menampilkan maksimal 4 modul utama sesuai akses role, ditambah tombol Menu untuk seluruh modul dan pengaturan yang diizinkan.

### Removed
- Komponen khusus mobile DEVELOPER digantikan oleh komponen mobile generik.

## [1.3.0] - 2026-11-07

### Added
- Prototipe mobile khusus role DEVELOPER: beranda ringkas, ringkasan PSB, shortcut modul, navigasi bawah, dan menu modul/pengaturan.
- Role DEVELOPER mendapat akses operasional setara Admin untuk menguji alur mobile; operasi pembaruan database yang memerlukan `DB_UPDATE_KEY` tetap khusus ADMIN.

## [1.2.2] - 2026-11-07

### Fixed
- Aturan "jam berhenti saat Temporary" kini dipakai konsisten: perhitungan overdue (badge OVERDUE di tampilan Troubleshoots, filter Overdue, ringkasan Overdue di halaman dan API) serta kolom DURASI pada ekspor tidak lagi memakai waktu berjalan sehingga angka tidak terus bertambah setelah tiket di-Temporary.
- KPI Overdue pada dashboard dan pengingat SLA WhatsApp (cron) ikut menghormati status Temporary; tiket yang dijeda tidak lagi dihitung overdue maupun dikirimi pengingat.
- Tampilan Trouble Ticket pada ponsel: daftar kartu kini tampil pada layar < 768px (sebelumnya kartu tersembunyi pada ponsel portrait dan tabel 1000px yang dipaksa tampil), sedangkan tabel tetap untuk layar desktop.

## [1.2.1] - 2026-11-07

### Changed
- Baris Lokasi ODP pada Trouble Ticket sekaligus menjadi tautan ke titik ODP di Maps; baris Maps ODP terpisah dihilangkan.

## [1.2.0] - 2026-11-07

### Added
- Integrasi pemakaian port ODP dengan List PSB: tiket berstatus CLOSE menambah `terpakai` ODP secara otomatis, dan dilepas saat reopen, ganti ODP, atau saat tiket dihapus (termasuk hapus massal).
- Integrasi Dismantle dengan port ODP: kolom `odpId`/`portNumber` pada `DismantleTickets` dan `DismantleHistory`, penentuan ODP otomatis dari tiket PSB dengan opsi override manual, pengurangan `terpakai` saat Close, dan pengembalian saat Reopen.
- Trouble Ticket menampilkan Lokasi ODP dan tautan Maps ODP pada bagian Data Teknis.

## [1.1.7] - 2026-11-07

### Changed
- Tabel List PSB diringkas menjadi No, Nama Pelanggan, Tanggal Request, Tanggal Pasang, Paket, Marketing, Pengawalan, Keterangan, Status, dan No WA Aktif; informasi serta aksi lainnya tersedia di chevron.

## [1.1.4] - 2026-11-06

### Changed
- Status Trouble Ticket dipindahkan dari detail chevron ke kolom utama setelah Gangguan.

## [1.1.5] - 2026-11-06

### Changed
- Detail dalam chevron Trouble Ticket ditata ulang menjadi baris label-nilai tanpa kotak per field.

## [1.1.6] - 2026-11-07

### Changed
- Filter Divisi dan teks penjelas di toolbar Trouble Ticket dihilangkan; parameter divisi dari halaman tetap diterapkan.

## [1.1.3] - 2026-11-06

### Changed
- Tabel Trouble Ticket diringkas menjadi ID Ticket, Nama Pelanggan, User, No WA, Type, Gangguan, dan Durasi; detail lainnya tersedia melalui chevron.

## [1.1.2] - 2026-11-06

### Fixed
- Port ODP mengelompokkan ODP legacy berdasarkan pola nama POP/ODC, misalnya `PTI/39 - 02` menjadi ODC 39 di POP Pati.

## [1.1.1] - 2026-11-06

### Fixed
- Filter POP Port ODP tetap menampilkan hierarki ODC, termasuk ODP lama yang belum dipetakan ke ODC.
- Endpoint ODP `all=1` tidak lagi membuang data ODP yang tidak memiliki koordinat.

## [1.1.0] - 2026-11-06

### Added
- Master Data POP: Tabel `psb_pop` dan manajemen UI untuk menambahkan/mengedit data POP.
- Master Data ODC: Tabel `psb_odc` dan manajemen UI untuk menambahkan/mengedit data ODC.
- Integrasi ODP: Relasi ODP ke POP dan ODC untuk manajemen inventori port yang lebih terstruktur.
- Integrasi Port ODP & PSB: Field `odpId` dan `portNumber` pada tiket PSB untuk pemetaan fisik pelanggan.
- Integrasi Trouble Ticket & ODP: Field `odpId`, `portNumber`, dan `sn` pada tiket gangguan untuk pelacakan aset yang lebih akurat.
- Tampilan Hierarki ODP: Menu Port ODP kini mendukung pengelompokan berdasarkan ODC dan tampilan pelanggan di dalam ODP menggunakan sistem dropdown/chevron.
- Sinkronisasi Otomatis: Logika update counter `terpakai` pada ODP saat tiket PSB ditutup (Close) atau dibuka kembali (Re-open).

### Fixed
- UI OdpManager: Perbaikan layout tombol "POP", "ODC", dan "ODP" agar muncul secara konsisten di desktop dan mobile (Dark/Light mode).
- Trouble Ticket UI: Penambahan input ODP, Port, dan SN pada modal tambah/edit serta tampilan detail.
- Tabel Port ODP: Refaktor tabel untuk mendukung tampilan bertingkat (POP > ODC > ODP > Pelanggan).

## [1.0.0] - 2026-11-06

Baseline rilis. Titik awal penerapan changelog & versioning formal.
Riwayat perubahan sebelum versi ini tidak didokumentasikan secara terpisah
pada file ini (dapat ditelusuri melalui riwayat commit Git).

[1.1.0]: https://github.com/indrakantor87/web-psb-perkasa/compare/v1.0.0...v1.1.0
[1.1.7]: https://github.com/indrakantor87/web-psb-perkasa/compare/v1.1.6...v1.1.7
[1.1.2]: https://github.com/indrakantor87/web-psb-perkasa/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/indrakantor87/web-psb-perkasa/compare/v1.1.0...v1.1.1
[1.0.0]: https://github.com/indrakantor87/web-psb-perkasa/releases/tag/v1.0.0
