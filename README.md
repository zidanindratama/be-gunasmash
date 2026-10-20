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

Seeder menghapus data yang sudah ada di database sebelum membuat data contoh. Gunakan hanya pada database development yang datanya boleh dihapus. Akun contoh yang dibuat adalah Andi Pratama (`admin@gmail.com`) dan Siti Aisyah (`member@gmail.com`), keduanya memakai password `password`.

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

## Deploy backend ke Vercel lewat terminal

Langkah ini mengirim folder backend langsung dari komputer ke Vercel lewat CLI. Tidak perlu menghubungkan GitHub atau menjalankan `git push`. Jalankan semua perintah dari folder `be-gunasmash`, tempat `package.json` dan `vercel.json` berada.

### Prasyarat

- Akun Vercel.
- Node.js 20.9 atau lebih baru.
- Database MongoDB Atlas yang bisa diakses dari backend yang dideploy.
- Kredensial Cloudinary.
- URL frontend production yang akan menggunakan API ini.

### 1. Periksa backend sebelum deploy

Pastikan `.env` lokal sudah diisi dan backend dapat dibuat serta dites:

```powershell
npm ci
npm test
npm run build
```

Perintah build tidak mengunggah aplikasi. Ini membantu menemukan error TypeScript atau konfigurasi sebelum deploy.

### 2. Login dan buat tautan project Vercel

Jalankan:

```powershell
npx vercel login
npx vercel link
```

Login akan membuka proses autentikasi Vercel. Saat membuat tautan, pilih scope akun atau tim yang benar. Jika project `be-gunasmash` sudah ada di Vercel, pilih project tersebut. Jika ini benar-benar deploy pertama dan project belum ada, buat project baru bernama `be-gunasmash`. Untuk direktori project, gunakan folder saat ini (`./`). Perintah ini membuat folder lokal `.vercel` yang menyimpan ID project; jangan edit atau commit folder tersebut.

### 3. Tambahkan environment production

Tambahkan variabel yang diwajibkan backend satu per satu:

```powershell
npx vercel env add DATABASE_URL production
npx vercel env add JWT_ACCESS_SECRET production
npx vercel env add JWT_REFRESH_SECRET production
npx vercel env add CLOUDINARY_CLOUD_NAME production
npx vercel env add CLOUDINARY_API_KEY production
npx vercel env add CLOUDINARY_API_SECRET production
npx vercel env add CORS_WHITELIST production
```

CLI akan meminta nilai setiap variabel. Masukkan URI MongoDB Atlas, dua secret JWT yang berbeda, kredensial Cloudinary, dan origin frontend. Untuk `CORS_WHITELIST`, gunakan origin lengkap tanpa path, misalnya `https://fe-gunasmash.vercel.app`. Pisahkan beberapa origin dengan koma, misalnya `https://fe-gunasmash.vercel.app,http://localhost:3000`. Masukkan hanya origin yang memang perlu mengakses API.

`JWT_ACCESS_EXPIRES` dan `JWT_REFRESH_EXPIRES` bersifat opsional; jika tidak diatur, backend memakai `15m` dan `7d`. Jangan menulis secret langsung di perintah terminal atau memasukkannya ke Git. Cek nama variabel yang sudah tersimpan dengan:

```powershell
npx vercel env ls production
```

Perintah ini menampilkan daftar variabel, bukan nilai rahasianya. Environment variable di Vercel harus ditambahkan ke environment yang sesuai. Panduan ini menyiapkan `production`; preview deployment membutuhkan salinan variabel di environment `preview` juga. Lihat [dokumentasi environment Vercel CLI](https://vercel.com/docs/cli/env).

Jika ingin memakai preview setelah production aktif, tambahkan variabel yang sama untuk environment `preview`. Sebaiknya gunakan database Atlas development terpisah agar pengujian tidak mengubah data production:

```powershell
npx vercel env add DATABASE_URL preview
npx vercel env add JWT_ACCESS_SECRET preview
npx vercel env add JWT_REFRESH_SECRET preview
npx vercel env add CLOUDINARY_CLOUD_NAME preview
npx vercel env add CLOUDINARY_API_KEY preview
npx vercel env add CLOUDINARY_API_SECRET preview
npx vercel env add CORS_WHITELIST preview
```

Nilai `CORS_WHITELIST` untuk preview harus mengizinkan origin frontend preview yang akan digunakan.

Pada project Vercel yang benar-benar baru, deploy pertama akan menjadi production walaupun perintahnya hanya `npx vercel`. Setelah deployment production pertama ada, `npx vercel` membuat deployment preview. Karena itu panduan ini memakai `npx vercel --prod` untuk deploy pertama dengan sengaja. Rincian perilaku ini ada di [panduan deploy CLI Vercel](https://vercel.com/docs/projects/deploy-from-cli).

Pastikan MongoDB Atlas mengizinkan koneksi dari backend production. Jika koneksi database gagal setelah deploy, periksa bagian Network Access dan kredensial database di `DATABASE_URL`. Jangan gunakan akun database dengan hak akses lebih besar dari yang dibutuhkan aplikasi.

### 4. Deploy production

Untuk deploy pertama, jalankan perintah ini setelah menambahkan environment production:

```powershell
npx vercel --prod
```

Vercel akan menampilkan URL deployment. Project ini menggunakan Express; Vercel mengenali entry point `src/index.ts` dan menjalankan aplikasi sebagai function. [Panduan Express di Vercel](https://vercel.com/docs/frameworks/backend/express)

### 5. Periksa deployment

Gunakan domain production yang ditampilkan Vercel. Root API mengembalikan status service, sedangkan daftar pengumuman menguji koneksi ke database:

```powershell
Invoke-RestMethod https://<domain-backend>/
Invoke-RestMethod https://<domain-backend>/api/announcements
```

Ganti `<domain-backend>` dengan domain deployment, misalnya `be-gunasmash.vercel.app`. Jika deployment gagal atau mengembalikan error, lihat log:

```powershell
npx vercel logs --environment production --level error --since 5m
```

### 6. Hubungkan frontend ke backend production

Pada environment production frontend, atur:

```dotenv
NEXT_PUBLIC_API_URL=https://<domain-backend>/api
NEXT_PUBLIC_APP_URL=https://<domain-frontend>
```

Pastikan origin frontend production yang sebenarnya juga tercantum di `CORS_WHITELIST` backend. Jika nilai environment diubah, buat deployment baru agar perubahan dipakai:

```powershell
npx vercel --prod
```

### Deploy berikutnya

Setelah project terhubung, jalankan perintah dari folder backend yang sama:

```powershell
npx vercel          # Buat deployment preview untuk diuji
npx vercel --prod   # Deploy versi yang siap ke production
```

Preview memakai environment `preview`; tambahkan variabel yang diperlukan ke environment tersebut sebelum membuat preview. Perintah CLI, project linking, dan proses deploy dijelaskan lebih lanjut di [panduan deploy Vercel dari CLI](https://vercel.com/docs/projects/deploy-from-cli).

Untuk mengganti nilai environment yang sudah dibuat, gunakan `npx vercel env update NAMA production`, lalu deploy ulang dengan `npx vercel --prod` agar rilis baru memakai nilai tersebut.

Vercel adalah salah satu pilihan hosting. Backend juga dapat dijalankan atau dideploy di layanan Node.js lain dengan mengatur variabel environment yang sama.
