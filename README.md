# 🏸 BE GunaSmash — Backend UKM Bulutangkis Gunadarma (Express + TypeScript + Prisma + MongoDB)

Backend API untuk **GunaSmash**, sistem manajemen UKM Bulutangkis Universitas Gunadarma.
Menyediakan fitur **autentikasi (JWT)**, **role-based access (RBAC)**, **pengumuman**, **absensi**, **blog**, **manajemen anggota**, **upload gambar**, dan **statistik aktivitas**.
Dibangun dengan **Express 5**, **TypeScript**, **Prisma (MongoDB)**, **Zod**, **Passport Local**, dan **Cloudinary**.

---

## ✨ Fitur Utama

- 🔑 **Autentikasi & Autorisasi**
  - Sign-up / Sign-in dengan Passport Local
  - Token akses & refresh JWT
  - Endpoint `/auth/me` & logout

- 🧑‍🤝‍🧑 **RBAC** — Role `ADMIN` dan `MEMBER` dengan guard route
- 📢 **Pengumuman** — CRUD lengkap + pencarian, filter, sorting, dan paginasi
- 🕓 **Absensi** — Check-in anggota (terbatas waktu), check-in admin, rekap sesi, dan ekspor CSV
- 📰 **Blog** — CRUD, tag, status publish/unpublish
- 👥 **Anggota** — List/get user, ubah role, hapus, import/export CSV
- ☁️ **Upload** — Upload gambar ke Cloudinary (multipart/form-data)
- 📊 **Statistik** — Data global & statistik kehadiran tiap sesi
- 🧩 **Developer Experience**
  - Validasi Zod
  - Middleware error handler
  - CORS, Helmet, compression, dan logging dengan Morgan

- 🌱 **Seeder** — Generate data dummy (user, pengumuman, blog, absensi)

---

## 🧱 Teknologi yang Digunakan

| Kategori        | Teknologi                                 |
| --------------- | ----------------------------------------- |
| **Runtime**     | Node.js (TypeScript)                      |
| **Framework**   | Express 5                                 |
| **ORM**         | Prisma (MongoDB)                          |
| **Autentikasi** | Passport Local + JWT (HS256)              |
| **Validasi**    | Zod                                       |
| **Upload**      | Cloudinary SDK                            |
| **CSV**         | fast-csv, json2csv                        |
| **Lainnya**     | Helmet, compression, cors, morgan, multer |

---

## 📁 Struktur Proyek

```
src
│  app.ts
│  index.ts
│  routes.ts
│
└─ modules
   ├─ announcements     # Pengumuman
   ├─ attendance        # Absensi
   ├─ auth              # Autentikasi
   ├─ blogs             # Blog
   ├─ common            # Utilitas umum (auth, validator, middleware, dll)
   ├─ config            # Konfigurasi env & CORS
   ├─ prisma            # Koneksi Prisma
   ├─ stats             # Statistik
   ├─ types             # Typings untuk Express
   ├─ uploads           # Upload ke Cloudinary
   └─ users             # CRUD dan import/export anggota
```

---

## ⚙️ Cara Menjalankan Proyek

### 1️⃣ Prasyarat

- Node.js versi **≥18**
- Database **MongoDB** (misal: MongoDB Atlas)
- Akun **Cloudinary** untuk upload gambar

### 2️⃣ Instalasi

```bash
npm install
```

### 3️⃣ Konfigurasi Environment

Buat file `.env` berdasarkan contoh di bawah:

```dotenv
NODE_ENV=development
PORT=4000

# --- Database ---
DATABASE_URL="mongodb+srv://<user>:<pass>@<cluster>/<db>?appName=<app>"

# --- JWT ---
JWT_ACCESS_SECRET=ubah-ini
JWT_REFRESH_SECRET=ubah-ini-juga
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# --- Cloudinary ---
CLOUDINARY_CLOUD_NAME=nama-cloud
CLOUDINARY_API_KEY=api-key
CLOUDINARY_API_SECRET=api-secret

# --- CORS ---
CORS_WHITELIST=localhost,vercel.app

# --- Seed (opsional) ---
SEED=123
SEED_USERS=20
SEED_ANNOUNCEMENTS=20
SEED_BLOGS=20
```

> ⚠️ **Jangan commit file `.env` ke GitHub!**
> Simpan hanya `.env.example`.

### 4️⃣ Generate Prisma Client

```bash
npm run db:gen
```

### 5️⃣ Jalankan Seeder (opsional)

```bash
npm run seed
```

Seeder akan membuat:

- Admin default (`Muhamad Zidan Indratama`)
- Data user acak
- Pengumuman latihan (Rabu & Minggu)
- Blog dummy
- Sesi dan data absensi

### 6️⃣ Jalankan Server

```bash
npm run dev   # mode pengembangan
# atau
npm run build && npm start   # mode produksi
```

Aplikasi akan berjalan di **[http://localhost:4000](http://localhost:4000)**

---

## 🔐 Sistem Autentikasi

- **Access Token** → dikirim di header: `Authorization: Bearer <token>`
- **Refresh Token** → disimpan di cookie HTTP-only (`refreshToken`)
- **Role** → `ADMIN` dan `MEMBER`, dikontrol lewat middleware `rolesGuard`

---

## 🌐 CORS

`CORS_WHITELIST` berisi daftar domain yang diizinkan.
Sistem akan mengizinkan domain yang **hostname-nya berakhiran** dari daftar tersebut.
Cookie dan kredensial juga diperbolehkan.

---

## 📦 Ringkasan API

Base URL: `http://localhost:4000/api`

### Format Respons

```json
// sukses
{ "success": true, "data": <payload> }

// gagal
{ "success": false, "error": { "message": "Pesan error" } }
```

---

## 📚 Daftar Endpoint Utama

### 🔑 Auth (`/auth`)

| Method   | Endpoint   | Deskripsi                            |
| -------- | ---------- | ------------------------------------ |
| `POST`   | `/sign-up` | Registrasi user baru                 |
| `POST`   | `/sign-in` | Login user, set cookie refresh token |
| `POST`   | `/refresh` | Refresh access token                 |
| `DELETE` | `/logout`  | Logout & hapus cookie                |
| `GET`    | `/me`      | Info user yang sedang login          |

Contoh login:

```bash
curl -X POST http://localhost:4000/api/auth/sign-in \
 -H "Content-Type: application/json" \
 -d '{"email":"admin@example.com","password":"password123"}'
```

---

### 👥 Users (`/users`) — hanya ADMIN

- `GET /` → list user (support search, sort, filter, pagination)
- `GET /:id` → detail user
- `PATCH /:id/role` → ubah role user
- `DELETE /:id` → hapus user
- `POST /import` → upload CSV (`name,email,password?`)
- `GET /export/csv` → download data anggota

---

### 📢 Announcements (`/announcements`)

- `GET /` — daftar pengumuman
- `GET /:id` — detail pengumuman
- `POST /` (ADMIN) — tambah pengumuman
- `PATCH /:id` (ADMIN) — ubah sebagian
- `DELETE /:id` (ADMIN) — hapus pengumuman

> ⏰ Absensi hanya bisa dilakukan saat waktu `now` berada di rentang waktu pengumuman (`day` + `time`).

---

### 🕓 Attendance (`/attendance`)

- `POST /check-in` (MEMBER/ADMIN)
  → Check-in untuk jadwal aktif

- `POST /admin/check-in` (ADMIN)
  → Tandai kehadiran anggota secara manual (tanggal bisa ditentukan)

- `GET /session/summary` (ADMIN)
  → Rekap kehadiran per sesi

- `GET /session/export` (ADMIN)
  → Download CSV kehadiran (present/absent)

---

### 📰 Blogs (`/blogs`)

- `GET /` — daftar blog
- `GET /:id` — detail blog
- `POST /` (ADMIN) — tambah blog
- `PATCH /:id` (ADMIN) — ubah sebagian
- `DELETE /:id` (ADMIN) — hapus blog

---

### ☁️ Uploads (`/uploads`)

- `POST /image` (auth) — upload file gambar → `{ url, publicId }`

---

### 📊 Stats (`/stats`)

- `GET /` — statistik global (user, blog, pengumuman, sesi)
- `GET /attendance?announcementId=...&date=YYYY-MM-DD` — statistik kehadiran per jadwal

---

## 🧪 Validasi

Semua input divalidasi dengan **Zod** (`modules/common/validators/schemas.ts`).
Jika validasi gagal → server akan merespons `400` dengan detail error yang jelas.

---

## 🧰 Utility

- `authGuard` → verifikasi JWT access token
- `rolesGuard([...])` → pastikan user memiliki role tertentu
- `parseListQuery` → parsing otomatis untuk query `search`, `sort`, `filter`, `page`, `limit`
- `shapeList` → format respons paginasi yang konsisten

---

## 🗓️ Logika Waktu Absensi

Berada di `modules/common/time/announcement-window.ts`:

- `parseTimeRangeToDates(day, range)` → hitung tanggal & jam mulai/selesai
- `isNowWithinAnnouncementWindow(day, range)` → cek apakah saat ini dalam waktu absensi

---

## 🗃️ Skema Database (Prisma)

- `User` → data anggota (`role`: ADMIN/MEMBER)
- `Announcement` → jadwal latihan
- `Blog` → konten informatif
- `AttendanceSession` → sesi latihan per tanggal
- `Attendance` → kehadiran per user di tiap sesi

Generate client:

```bash
npm run db:gen
```

---

## 🧪 Format CSV

| Jenis          | Format Header          |
| -------------- | ---------------------- |
| Import User    | `name,email,password?` |
| Export User    | `id,name,email,role`   |
| Export Absensi | `type,name,email`      |

---

## 📜 NPM Script

```jsonc
{
  "dev": "cross-env NODE_ENV=development tsx watch src/index.ts",
  "build": "rimraf dist && tsc -p tsconfig.json",
  "start": "node dist/index.js",
  "lint": "eslint . --ext .ts",
  "format": "prettier --write .",
  "db:gen": "prisma generate",
  "seed": "tsx prisma/seed.ts",
}
```

---

## 👨‍💻 Pengembang

**Muhamad Zidan Indratama**
Full-Stack Web Developer — Universitas Gunadarma

- 📧 [zidanindratama03@gmail.com](mailto:zidanindratama03@gmail.com)
- 🌐 [zidanindratama.vercel.app](https://zidanindratama.vercel.app)

---

## 📝 Lisensi

**ISC License** — bebas digunakan & dimodifikasi untuk kebutuhan internal kampus/organisasi.

---

> Backend ini dibuat untuk mendukung sistem informasi UKM Bulutangkis **GunaSmash**, agar kegiatan latihan, absensi, dan informasi klub bisa dikelola secara modern, cepat, dan efisien.
