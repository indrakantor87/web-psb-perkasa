# WEB PSB PERKASA

Sistem Manajemen Pemasangan Baru (PSB) untuk PERKASA NETWORKS.

## Fitur
- **Dashboard**: Statistik PSB per paket dan pencapaian marketing.
- **Input PSB**: Form input data pelanggan baru.
- **List Data**: Daftar tiket PSB dengan filter bulan/tahun.
- **Role Management**:
  - **Marketing**: Input data, View dashboard/list.
  - **CS, NOC, Admin**: Input data, View dashboard/list, Close ticket.

## Teknologi
- Next.js (App Router)
- Tailwind CSS
- Prisma (SQLite)
- Recharts

## Cara Menjalankan

1. Install dependencies:
   ```bash
   npm install
   ```

2. Setup Database:
   ```bash
   npx prisma migrate dev --name init
   npx tsx prisma/seed.ts
   ```

3. Jalankan server development:
   ```bash
   npm run dev
   ```

4. Buka [http://localhost:3000](http://localhost:3000)

## Akun Demo (Password: 123456)

- **Admin**: `admin`
- **CS**: `cs`
- **NOC**: `noc`
- **Marketing**: `marketing`
