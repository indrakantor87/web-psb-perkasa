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
