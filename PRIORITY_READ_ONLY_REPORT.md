# Priority Read-Only Enforcement Report

## Ringkasan

Role `PRIORITY` (GM dan Direktur) tetap dapat membaca menu dan data yang memang sudah diizinkan. Perubahan, input, impor, edit, dan hapus data bisnis ditolak di lapisan proxy API; kontrol untuk mengubah foto profil juga disembunyikan dan endpoint-nya mengembalikan `403`.

## Cakupan

- `src/lib/access.ts`: menetapkan `PRIORITY` sebagai role read-only dan menguji kebijakan metode API.
- `src/proxy.ts`: menolak `POST`, `PUT`, `PATCH`, dan `DELETE` untuk endpoint bisnis; juga menolak `GET`/`HEAD` ke endpoint setup skema Marketing.
- `src/app/(dashboard)/profile/page.tsx` dan `src/components/ProfileAvatarForm.tsx`: profil Priority hanya menampilkan foto tanpa kontrol unggah/hapus.
- `src/app/api/profile/avatar/route.ts`: validasi ulang role sebelum mengubah avatar.

## Pengecualian Non-Bisnis

Aksi berikut tetap tersedia karena diperlukan untuk keamanan akun atau fungsi teknis, bukan untuk memasukkan data operasional:

- Logout dan perubahan password akun sendiri.
- Resolusi koordinat dari link peta; endpoint ini hanya menghitung hasil dan tidak menyimpan data.
- Registrasi/penghapusan token notifikasi perangkat.

## Verifikasi

- `npx tsc --noEmit`: lulus.
- ESLint pada file terdampak: lulus tanpa error.
- Tes kebijakan Priority: 2/2 lulus.
- Tes navigasi mobile dan akses laporan GM: 12/12 lulus.
- `npm run build`: lulus.
- Gabungan tes akses, navigasi, dan laporan: 29 lulus, 1 gagal. Tes yang gagal mengharapkan HR dapat membuka Aktivitas Marketing, sementara matriks akses saat ini tidak memberikan menu tersebut kepada HR; tidak terkait kebijakan Priority.

Tidak ada migrasi atau perubahan data database. Perubahan lokal ini belum di-commit atau di-push.
