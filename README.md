# Backend GunaSmash

API untuk sistem manajemen UKM Bulutangkis GunaSmash. Backend menggunakan Express, TypeScript, Prisma, dan MongoDB Atlas.

## Fitur

- Pendaftaran, login, logout, dan pembaruan token dengan JWT.
- Hak akses berdasarkan peran `ADMIN` dan `MEMBER`.
- Pengelolaan pengumuman latihan dan acara.
- Sesi absensi, check-in anggota, pencatatan manual oleh admin, rekap, dan ekspor CSV.
- Pengelolaan artikel, tag, serta status terbit.
- Pengelolaan anggota, termasuk impor dan ekspor CSV.
- Upload gambar ke Cloudinary.
- Statistik umum dan statistik kehadiran.
- Validasi permintaan, pencatatan log, dan penanganan error.

## Menjalankan di komputer lokal

### Prasyarat

- Node.js 20.9 atau lebih baru.
- Akun dan database MongoDB Atlas.
- Akun Cloudinary. Backend memerlukan kredensialnya saat dijalankan; fitur upload menggunakan layanan ini.

### Instalasi

Dari folder `be-gunasmash`, jalankan:

```powershell
npm ci
Copy-Item .env.example .env
```

Buka `.env` dan isi nilai untuk MongoDB Atlas, secret JWT, dan Cloudinary. Contoh formatnya:

```dotenv
NODE_ENV=development
PORT=4000
DATABASE_URL="mongodb+srv://<username>:<password>@<cluster>/<database>?appName=<app>"
JWT_ACCESS_SECRET=ganti-dengan-secret-acak-yang-panjang
JWT_REFRESH_SECRET=ganti-dengan-secret-acak-yang-berbeda
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
CLOUDINARY_CLOUD_NAME=nama-cloud
CLOUDINARY_API_KEY=api-key
CLOUDINARY_API_SECRET=api-secret
CORS_WHITELIST=http://localhost:3000,http://127.0.0.1:3000
```

Pastikan alamat IP komputer diizinkan di pengaturan Network Access MongoDB Atlas. Jangan commit `.env` atau membagikan secret. `.env.example` hanya berisi contoh.

Keterangan variabel:

- `DATABASE_URL`: alamat koneksi database MongoDB Atlas.
- `JWT_ACCESS_SECRET` dan `JWT_REFRESH_SECRET`: secret berbeda untuk token akses dan refresh.
- `JWT_ACCESS_EXPIRES` dan `JWT_REFRESH_EXPIRES`: masa berlaku token.
- `CLOUDINARY_*`: kredensial untuk upload gambar.
- `CORS_WHITELIST`: daftar origin frontend yang boleh mengakses API, dipisahkan koma. Tambahkan origin frontend jika alamat atau port-nya berbeda.
- `PORT`: port backend; jika diubah, sesuaikan `NEXT_PUBLIC_API_URL` di frontend.

### Siapkan dan jalankan backend

```powershell
npm run db:gen
npm run dev
```

API berjalan di [http://localhost:4000](http://localhost:4000). Root API adalah health check. Endpoint fitur menggunakan awalan `/api`, misalnya [http://localhost:4000/api/announcements](http://localhost:4000/api/announcements).

Untuk membuat data contoh, jalankan:

```powershell
npm run seed
```

Seeder menghapus data yang sudah ada di database sebelum membuat data contoh. Gunakan hanya pada database development yang datanya boleh dihapus. Akun contoh yang dibuat adalah `admin@gmail.com` dan `member@gmail.com`, keduanya memakai password `password`.

## Endpoint utama

Semua respons sukses menggunakan bentuk `{ "success": true, "data": ... }`. Akses ke endpoint tertentu memerlukan token login dan peran yang sesuai.

| Fitur | Endpoint utama |
| --- | --- |
| Autentikasi | `POST /api/auth/sign-up`, `POST /api/auth/sign-in`, `POST /api/auth/refresh`, `DELETE /api/auth/logout`, `GET /api/auth/me` |
| Pengumuman | `GET /api/announcements`, `GET /api/announcements/:id`; admin dapat `POST`, `PATCH`, dan `DELETE` |
| Absensi | `GET /api/attendances`, `POST /api/attendances`, `POST /api/attendances/check-in`; admin dapat mengelola sesi dan check-in anggota |
| Anggota | `GET /api/users`, `GET /api/users/:id`; admin dapat mengubah data/peran, menghapus, impor, dan ekspor CSV |
| Blog | `GET /api/blogs`, `GET /api/blogs/:slug`; admin dapat membuat, mengubah, dan menghapus artikel |
| Upload | `POST /api/uploads/image` untuk mengunggah gambar ke Cloudinary |
| Statistik | `GET /api/stats` dan `GET /api/stats/attendance` untuk admin |

## Perintah yang tersedia

```bash
npm run dev           # Jalankan server pengembangan
npm run build         # Buat build produksi
npm start             # Jalankan build produksi
npm run db:gen        # Generate Prisma Client
npm run seed          # Hapus data lama dan isi database dengan data contoh
npm test              # Jalankan unit test
npm run lint          # Periksa kode dengan ESLint
```

## Menjalankan bersama frontend

1. Jalankan backend pada port `4000`.
2. Pada folder frontend, salin `.env.example` menjadi `.env.local`.
3. Pastikan `NEXT_PUBLIC_API_URL=http://localhost:4000/api` dan origin frontend tercantum di `CORS_WHITELIST`.
4. Jalankan frontend dengan `npm run dev` dari folder `fe-gunasmash`.

Untuk deployment, atur variabel environment yang sama di hosting masing-masing aplikasi. Aplikasi tidak membutuhkan Vercel; URL API, URL website, dan origin yang diizinkan dapat disesuaikan lewat environment.
