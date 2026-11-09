# Laporan Retensi Foto Operasional

## Status

Implementasi tersedia di source lokal. Belum ada data produksi yang dihapus, belum ada deployment, dan Scheduled Task Coolify belum dikonfigurasi.

## Kebijakan

- Masa simpan: enam bulan kalender.
- Foto PSB: umur dihitung dari `Ticket.createdAt`.
- Foto file Trouble Ticket: umur dihitung dari waktu upload `TroubleTicketPhoto.createdAt`.
- Foto inline legacy Trouble Ticket: umur dihitung dari `closedAt`, lalu `openedAt`, lalu `createdAt`.
- Foto Dismantle: umur dihitung dari `DismantleHistory.closedAt`, lalu `createdAt`.
- Salinan foto Isolasi hanya ikut dihapus jika tertaut ke record Dismantle yang melewati masa simpan dan tanggal record Isolasi juga sudah melewati batas.
- Avatar dan foto Isolasi mandiri tidak termasuk cakupan.
- Record bisnis/tiket tidak dihapus; hanya isi foto dan penanda ketersediaannya yang dibersihkan.

## Eksekusi

Endpoint `POST /api/cron/photo-retention` wajib menggunakan header Bearer dari environment `PHOTO_RETENTION_CRON_SECRET` dengan panjang minimal 32 byte. Secret tidak boleh disimpan di repository atau dicetak ke log.

Mode bawaan adalah dry-run. Penghapusan hanya berjalan jika query memuat `mode=delete`. Proses dibatasi hingga 250 item per batch dan maksimal empat batch per kategori pada satu pemanggilan; hasil melaporkan jumlah kandidat, jumlah yang diproses, sisa, serta kegagalan penghapusan file.

Runner `npm run photo-retention:run` memerlukan:

- `PHOTO_RETENTION_APP_URL`: URL aplikasi dengan HTTPS.
- `PHOTO_RETENTION_CRON_SECRET`: secret yang sama dengan konfigurasi aplikasi.
- `PHOTO_RETENTION_MODE`: `dry-run` untuk pemeriksaan atau `delete` untuk penghapusan.

Setelah ruang disk database dipulihkan dan rilis aplikasi tersedia di Coolify, jalankan runner sekali dengan mode `dry-run`, periksa jumlah kandidatnya, lalu buat Scheduled Task Coolify berkala dengan perintah `npm run photo-retention:run` dan `PHOTO_RETENTION_MODE=delete`. Jadwal disarankan per jam agar backlog lama diproses bertahap.

## Dampak Penyimpanan dan Batasan

- File Trouble Ticket dihapus dari direktori upload yang dikonfigurasi setelah path tervalidasi. File yang sudah tidak ada akan membuat metadata kadaluarsanya dibersihkan.
- Foto Base64 PSB, Trouble Ticket legacy, dan Dismantle dikosongkan dari row terkait; row tiketnya tetap dipertahankan.
- Penghapusan isi foto PostgreSQL tidak menjamin file database langsung mengecil pada filesystem. PostgreSQL dapat menggunakan kembali ruang tersebut; `VACUUM FULL` tidak dijalankan otomatis karena dapat mengunci tabel dan membutuhkan ruang tambahan.
- Job ini bukan tindakan pemulihan disk darurat. Pastikan kapasitas database cukup sebelum deploy atau menjalankan mode delete; penghapusan legacy berbasis tanggal record dapat langsung menghapus foto pada record yang sudah lebih tua dari enam bulan.
- Foto tanpa metadata Trouble Ticket yang menunjuk ke file (orphan files) tidak dihapus otomatis.
