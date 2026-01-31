# Panduan Build Aplikasi Mobile (Android)

Project ini telah dikonfigurasi menggunakan **Capacitor** untuk membuat aplikasi Android.

## Prasyarat
1. Install **Android Studio** di komputer Anda.
2. Pastikan SDK Android terinstall.

## Cara Build APK

### 1. Konfigurasi Server
Karena aplikasi ini menggunakan database server (Prisma), aplikasi Android tidak bisa berjalan 100% offline. Aplikasi Android akan bertindak sebagai "wrapper" yang memuat website yang sudah di-hosting atau dijalankan di local network.

Buka file `capacitor.config.ts` dan ubah bagian `server.url`:

```typescript
server: {
    androidScheme: 'https',
    cleartext: true,
    // Jika testing local (pastikan HP dan Laptop di wifi yang sama):
    url: 'http://192.168.1.XX:3000' 
    // Jika sudah di-hosting online:
    // url: 'https://web-psb-perkasa.vercel.app'
}
```

### 2. Jalankan Perintah Sync
Setiap kali Anda mengubah `capacitor.config.ts`, jalankan:
```bash
npx cap sync
```

### 3. Buka di Android Studio
Jalankan perintah ini untuk membuka project di Android Studio:
```bash
npx cap open android
```

### 4. Build APK
Di dalam Android Studio:
1. Tunggu proses Gradle sync selesai.
2. Klik menu **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
3. Setelah selesai, file APK siap diinstall di HP.

## Troubleshooting
- Jika aplikasi menampilkan layar "Sedang menghubungkan ke server...", berarti aplikasi tidak bisa menghubungi URL yang diset di `capacitor.config.ts`. Cek koneksi internet atau IP address.
