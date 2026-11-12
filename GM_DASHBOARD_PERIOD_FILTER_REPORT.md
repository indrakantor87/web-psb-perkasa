# Laporan Filter Periode Dashboard GM

## Baseline

- Branch: `main`
- Commit awal: `6309eed`
- Cakupan: dashboard eksekutif GM/Direktur dan endpoint `GET /api/gm-dashboard`

## Perubahan

- Filter bulan dan tahun memuat ulang dashboard otomatis; permintaan lama dibatalkan saat pilihan berubah.
- KPI, tren/snapshot harian, pemasangan PSB, tiket gangguan, isolir, availability jaringan, aktivitas divisi, distribusi paket, dan rata-rata kehadiran dihitung untuk bulan terpilih.
- Delta pelanggan dan PSB membandingkan bulan terpilih dengan bulan yang sama pada tahun sebelumnya.
- Bulan berjalan dibatasi sampai waktu sekarang. Periode masa depan tidak mengembalikan data, dan KPI pelanggan menampilkan keterangan bila belum ada snapshot.
- Risiko yang masih aktif, jumlah karyawan aktif, serta kapasitas ODP/port tetap menunjukkan kondisi saat ini karena sumber datanya tidak menyimpan histori bulanan; label panel menjelaskannya.
- Batas periode memakai zona waktu Jakarta, termasuk penanganan Februari tahun kabisat.

## Verifikasi

- Tes periode, grafik, dan laporan GM: 14/14 lulus.
- `npx tsc --noEmit`: lulus.
- ESLint pada file terdampak: lulus.
- `npm run build`: lulus.
- Belum dilakukan uji endpoint dengan data database runtime; query dan build telah diperiksa secara lokal.

Perubahan menunggu commit dan push yang diminta.
