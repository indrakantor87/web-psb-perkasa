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

## [1.18.5] - 2026-11-11

### Changed
- Field **No. Order / SPK** pada BA Aktivasi kini memiliki default `mdp.{tahun berjalan}.` (mis. `mdp.2026.`). Bagian nomor di akhir diisi manual oleh user.

## [1.18.4] - 2026-11-11

### Fixed
- Perbaiki dropdown POP di ODC Master yang kosong padahal data POP ada di tabel utama. Ternyata tabel `psb_pop` kosong, sementara "POP" di tabel utama berasal dari `psb_odp.wilayah`. GET `/api/odp/pop` kini auto-populate `psb_pop` dari `DISTINCT wilayah` di `psb_odp` jika `psb_pop` kosong.

## [1.18.3] - 2026-11-11

### Fixed
- Perbaiki dropdown POP di ODC Master yang masih kosong. GET `/api/odp/pop` kini:
  - Memakai filter `is_active IS NOT FALSE` (mencakup `TRUE` dan `NULL`) alih-alih `is_active = TRUE`.
  - Memiliki fallback: jika kolom `is_active` belum ada, query dijalankan tanpa filter.
  - Memiliki fallback: jika `psb_pop` kosong tapi ada ODC yang merujuk `pop_id`, tampilkan placeholder `POP {id}`.

## [1.18.2] - 2026-11-11

### Fixed
- Perbaiki dropdown POP di Port ODC Master yang kosong. `ensureOdpTable` kini menambahkan kolom yang hilang (`is_active`, `latitude`, `longitude`, dll) pada tabel `psb_pop` dan `psb_odc` yang sudah ada dari versi lama, serta mengaktifkan baris dengan `is_active` NULL.
- Tambahkan error logging pada `fetchPops` dan route `/api/odp/pop` untuk memudahkan debugging.

## [1.18.1] - 2026-11-11

### Changed
- Dropdown Paket Layanan pada BA hanya menampilkan nama paket (HOME MINI, HOME LITE, dll) tanpa duplikasi bandwidth dan harga, karena keduanya sudah ada di baris masing-masing.

## [1.18.0] - 2026-11-11

### Added
- Paket Layanan pada Berita Acara (BA) kini berupa dropdown dengan 6 paket (HOME MINI s/d HOME SMART).
- Service ID otomatis dibuat dari 4 karakter awal nama + DDMM tanggal lahir, diakhiri `@perkasa.net.id`.

### Changed
- Memilih Paket Layanan otomatis mengisi Bandwidth, Biaya Bulanan (+PPN), dan Total Pembayaran Pertama.
- Checkbox Status Koneksi, Pemasangan Kabel, dan Metode Pembayaran tetap ditampilkan saat dokumen BA dicetak.

## [1.17.0] - 2026-11-11

### Added
- Menu Absensi kini tampil untuk semua role pada desktop dan mobile.

### Changed
- Cakupan data absensi dibatasi sesuai akun yang login: user biasa hanya dapat melihat absensi miliknya sendiri (berbasis kepemilikan nama karyawan, fail-closed bila nama tidak unik).
- Filter Cari/Divisi dan tombol terkait disembunyikan pada halaman Absensi untuk role yang hanya melihat data sendiri.
- Tab "Daftar Karyawan" dan halaman `/hr/employees` hanya tersedia untuk role DEVELOPER, PRIORITY, ADMIN, dan HR.

### Security
- Endpoint `/api/hr/attendance` dan `/api/hr/employees` memfilter data ke karyawan milik user yang login untuk role non-privileged, dan menyamarkan `fingerprintId` pada respons.

### Notes
- Role DEVELOPER, PRIORITY, ADMIN, dan HR tidak diubah: tetap dapat mengakses absensi seluruh karyawan.

## [1.17.1] - 2026-11-11

### Changed
- Ringkasan absensi kini menampilkan Total Kehadiran, Valid (tap masuk dan pulang lengkap), dan Invalid (salah satu tap tidak ada), menggantikan kartu Karyawan Tercatat.
- Jumlah karyawan pada rekap divisi disembunyikan untuk user yang hanya dapat melihat absensinya sendiri.

### Fixed
- Data absensi user biasa kini tampil meskipun `fingerprintId` disamarkan pada respons API; penyamaran data tidak lagi membuat UI menganggap karyawan tidak terdaftar.
- Pesan kondisi kosong menjelaskan bahwa data bulan berjalan perlu ditarik oleh HR dari mesin fingerprint.

## [1.13.1] - 2026-11-10

### Security
- Endpoint `/api/debug/env` kini hanya dapat diakses role DEVELOPER dan tidak lagi mengembalikan nilai environment maupun memindai jaringan internal.

## [1.13.0] - 2026-11-10

### Added
- Dashboard operasional untuk role CS dan ADMIN_CS sebagai sarana laporan dan pemantauan harian.

### Changed
- Menu Dashboard dibuka untuk role CS dan ADMIN_CS sehingga muncul di Sidebar, Header, dan navigasi mobile.
- Setelah login role CS/ADMIN_CS diarahkan ke Dashboard (sebelumnya ke Input PSB).
- Dashboard otomatis fokus ke divisi CS: kartu Performa Divisi CS (status tiket PSB Open/Proses/Close) dan KPI Divisi (Isolir Baru, Restorasi, Close Rate, Isolir Aktif, Siap Dismantle, Siklus Rata-rata), disertai Tren PSB dan Tren Trouble Ticket.

## [1.12.0] - 2026-11-10

### Added
- Modul Daily Activity di web PSB: karyawan mengisi rencana aktivitas pada pagi hari dan melengkapi status serta catatan hasil pada sore hari, disertai Smart Paste, Performa (harian/mingguan/bulanan), Kalender, Profil Divisi, Export Excel, dan Salin Ringkasan.
- Halaman `/daily-activity` beserta menu di Sidebar, Header, dan navigasi mobile untuk seluruh role operasional.
- Skema tabel `psb_daily_activity_items` dan `psb_daily_activity_profiles` dengan inisialisasi otomatis saat runtime (tanpa migrasi manual).
- API `/api/daily-activity` (list, create/batch) dan `/api/daily-activity/[id]` (close/delete) serta `/api/daily-activity/profile` (simpan profil divisi).

### Changed
- Tahap persetujuan (approval) Daily Activity dinonaktifkan untuk sementara; endpoint `/api/daily-activity/approval` tetap tersedia di server untuk diaktifkan kembali bila diperlukan.

## [1.11.20] - 2026-11-09

### Changed
- Menu dan halaman Input PSB disembunyikan dari role PRIORITY pada desktop dan mobile.

## [1.11.19] - 2026-11-09

### Changed
- Daftar divisi Manajemen User mengikuti sumber HR, termasuk pilihan, validasi, nilai default, filter, dan tampilan profil.
- Kode divisi lama dinormalisasi ke daftar departemen HR tanpa mengubah ringkasan anggota berdasarkan role.

## [1.11.18] - 2026-11-09

### Security
- Audit Role, Log Aktivitas, dan notifikasi log aktivitas kini hanya tersedia bagi role DEVELOPER.
- Akses langsung ke halaman dan API log aktivitas dibatasi untuk DEVELOPER.

## [1.11.17] - 2026-11-09

### Changed
- Divisi user dapat diubah dari form Edit User dan disimpan terpisah dari role; hak akses tetap mengikuti role.

## [1.11.16] - 2026-11-09

### Changed
- Lembar Menu mobile tidak lagi mengulang modul yang sudah tampil di navigasi bawah untuk semua role, bukan hanya teknisi.
- Dropdown Dashboard dan Pengaturan pada header dihapus untuk seluruh role di tampilan mobile agar navigasi hanya lewat bottom-nav dan tombol Menu.
- Pengaturan tema dan ukuran teks di modal Menu kini tersedia untuk semua role.

## [1.11.15] - 2026-11-09

### Fixed
- Beranda teknisi menggunakan halaman khusus yang ringan agar dapat dibuka dengan konsisten tanpa memuat seluruh dashboard.
- Role NOC mendapat Beranda mobile tanpa menambah akses Dashboard desktop atau ringkasan PSB global.

## [1.11.14] - 2026-11-09

### Changed
- Label List PSB pada navigasi mobile disingkat agar tampil satu baris.

## [1.11.13] - 2026-11-09

### Changed
- Navigasi mobile teknisi menampilkan Beranda, menghapus dropdown Dashboard/Pengaturan di header, dan tidak mengulang menu bottom-nav di lembar Menu.
- Pengaturan tema dan ukuran teks teknisi tersedia melalui tombol Menu.
- Ringkasan PSB global tidak ditampilkan pada Beranda teknisi.

## [1.11.11] - 2026-11-09

### Fixed
- Isolir, Dismantle aktif, dan histori Dismantle untuk Creator Digital kini mengikuti nama akun yang login, sama seperti aturan scope PSB.
- Ringkasan Isolir dan Dismantle pada dashboard Creator Digital kini memakai scope nama akun dan gagal-tertutup jika nama akun kosong.

## [1.11.10] - 2026-11-09

### Fixed
- Daftar PSB Creator Digital kini mengikuti aturan yang sama dengan peran Marketing, yaitu dicocokkan berdasarkan nama marketing pada tiket (`marketingName`), sehingga data milik akun yang login tampil konsisten dengan "Kinerja Marketing" pada dashboard.
- Scope PSB berbasis nama ini diterapkan pada halaman List, GET `/api/tickets` (termasuk export), serta metrik PSB pada dashboard Creator Digital. Modul konten digital (Calendar, Campaign, Digital Leads, Analytics) tetap memakai pemilik akun (`creatorId`/`createdById`).

## [1.11.9] - 2026-11-09

### Fixed
- Batasi daftar PSB Creator Digital pada halaman List berdasarkan `createdById` akun yang login, termasuk hitungan dan cache data.

## [1.11.8] - 2026-11-09

### Fixed
- Perbaiki error Beranda pada peran Creator Digital: kolom `Isolation.createdById` kini dipastikan ada sebelum query dashboard dijalankan (sebelumnya query isolir berjalan lebih dulu sehingga memicu error "column does not exist" dan halaman gagal tampil).

## [1.11.7] - 2026-11-09

### Added
- Peran Creator Digital kini dapat mengakses Dashboard (desktop dan mobile) serta memiliki hak Input PSB.
- Data operasional (PSB, Isolir, Dismantle) dan data digital (Calendar, Campaign, Digital Leads, Analytics) dicatat dengan pemilik akun (`createdById`/`creatorId`).

### Changed
- Label menu "Content Calendar" disingkat menjadi "Calendar" di seluruh navigasi dan judul halaman.
- Dashboard dan seluruh daftar API untuk Creator Digital dibatasi hanya pada data milik akun yang login; jika id akun tidak tersedia, query ditutup (fail-closed).
- Trouble Ticket untuk Creator Digital juga dibatasi pada data miliknya sendiri.

## [1.11.6] - 2026-11-09

### Fixed
- Membersihkan seluruh warning ESLint tanpa mengubah perilaku: variabel dan parameter yang tidak terpakai dihapus pada modul ODP, serta fungsi pengambil data pada komponen Campaign, Analytics, Content Calendar, dan Digital Lead dibungkus `useCallback` agar dependensi efektor terpenuhi. `npm run lint` kini bersih (0 error, 0 warning).

## [1.11.5] - 2026-11-09

### Added
- Manajemen user mesin fingerprint untuk Developer: daftar user, ubah nama, dan hapus user individual.

### Security
- PIN user tidak dikirim ke browser; edit nama mempertahankan atribut mesin lain di server. ID fingerprint tetap agar mapping absensi stabil.
- Penghapusan memerlukan konfirmasi ID, ditolak untuk akun mesin dengan hak khusus atau user yang masih terhubung ke karyawan aktif, dan dicatat pada security log.
- Riwayat absensi web tidak dihapus; log mesin lama tetap dapat dipetakan melalui ID fingerprint karyawan.

## [1.11.4] - 2026-11-09

### Fixed
- Teks hasil salin Ringkasan Tiket PSB tidak lagi menyertakan judul.

## [1.11.3] - 2026-11-09

### Added
- Tombol salin pada Ringkasan Tiket PSB menyalin seluruh isi ringkasan ke clipboard dari desktop maupun mobile.

## [1.11.2] - 2026-11-09

### Changed
- Divisi HR diselaraskan menjadi Pemasaran dan Pelayanan, General Affair, Teknisi, Finance & HR, serta General Manager. Data divisi lama dipetakan otomatis ke kategori baru.
- Tautan akun Marketing manual dihapus dari form karyawan. Absensi pribadi dicocokkan dari nama akun dan nama karyawan yang sama serta unik; kecocokan ambigu ditolak.

## [1.11.1] - 2026-11-09

### Changed
- Opsi role pada Manajemen User diringkas: label PRIORITY menjadi "Priority", sedangkan ADMIN_CS, DISMANTLE, dan TROUBLESHOOTS tidak lagi tersedia untuk penetapan role baru; akun legacy tetap dapat diedit dan dipertahankan.

## [1.11.0] - 2026-11-09

### Changed
- Pemetaan ulang RBAC: matriks akses menu, hak mutasi, dan pengaturan disentralkan di `src/lib/access.ts`. DEVELOPER menjadi otoritas tertinggi (semua modul dan pengaturan, satu-satunya role dengan `db-update` ber-`DB_UPDATE_KEY` dan konfigurasi mesin fingerprint); ADMIN dapat melihat dan mengubah semua modul kecuali mesin fingerprint dan `db-update`.
- `PRIORITY` memperoleh akses baca menyeluruh tanpa hak mutasi; kontrol aksi disembunyikan di UI, bukan hanya ditolak API.
- `HR` mengakses Dashboard, Aktivitas Marketing (read-only), dan HR: kelola karyawan serta operasi absensi, tanpa konfigurasi mesin.
- `MARKETING` dibatasi hanya pada data miliknya sendiri (PSB, Aktivitas Marketing, Isolir, Dismantle, ODP, Trouble Ticket, absensi) dengan penegakan owner di sisi server.
- `ADMIN_CS` mengikuti kewenangan CS; `TEKNISI` mengambil alih Trouble Ticket dan Dismantle; role lama `TROUBLESHOOTS` dan `DISMANTLE` dipertahankan sebagai alias tanpa migrasi akun.

### Added
- Relasi kepemilikan Trouble Ticket melalui `createdById` dan relasi `Employee.userId` ke `User`, lengkap dengan self-healing schema.
- Tes RBAC & ownership di `src/lib/access.test.ts`.

### Security
- Scope owner diterapkan pada query list/detail (PSB, Isolir, Dismantle, Trouble Ticket, dan HR) termasuk endpoint foto; record tanpa owner eksplisit tidak terekspos (fail-closed).
- Endpoint foto Trouble Ticket tidak lagi memakai cache publik (`Cache-Control: private, no-store`) dan diverifikasi terhadap kepemilikan.

## [1.10.0] - 2026-11-09

### Added
- Retensi foto operasional enam bulan untuk foto PSB, Trouble Ticket, dan Dismantle; foto lama menggunakan tanggal record bila tidak memiliki waktu upload tersendiri.
- Endpoint `/api/cron/photo-retention` dengan autentikasi `PHOTO_RETENTION_CRON_SECRET`, mode bawaan dry-run, dan penghapusan eksplisit dalam batch terbatas.
- Runner `npm run photo-retention:run` untuk dijalankan melalui Scheduled Task Coolify setelah URL, secret, dan jadwal dikonfigurasi.

### Changed
- Penghapusan foto Dismantle juga membersihkan salinan foto Isolasi yang tertaut dan sudah melewati masa retensi. Avatar pengguna dan foto Isolasi mandiri tidak termasuk cakupan.

## [1.9.1] - 2026-11-09

### Changed
- Tabel Absensi HR kini menampilkan **satu baris per karyawan** (seluruh nama karyawan) dan difilter **per bulan** (bukan rentang tanggal). Detail absensi harian bulan berjalan muncul saat tombol **Detail** (chevron) diklik. Karyawan tanpa absensi pada bulan tersebut tetap tampil dengan keterangan "Tidak ada absensi pada bulan ini".

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
