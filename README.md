# 🏸 BE GunaSmash — Backend UKM Bulutangkis Gunadarma

**(Express + TypeScript + Prisma + MongoDB)**

Backend API untuk **GunaSmash**, sistem manajemen UKM Bulutangkis Universitas Gunadarma.
Menyediakan fitur **autentikasi (JWT)**, **role-based access (RBAC)**, **pengumuman**, **absensi**, **blog**, **manajemen anggota**, **upload gambar**, dan **statistik aktivitas**.

Dibangun dengan **Express 5**, **TypeScript**, **Prisma (MongoDB)**, **Zod**, **Passport Local**, dan **Cloudinary**.

---

## 🌐 Links

- 🔗 **Production URL**: [https://be-gunasmash.vercel.app](https://be-gunasmash.vercel.app)
- 📘 **API Docs (Postman)**: [Dokumentasi API — GunaSmash](https://documenter.getpostman.com/view/14021625/2sB3WpShAL#dokumentasi-api-gunasmash)
- 💻 **GitHub Repository**: [github.com/zidanindratama/be-gunasmash](https://github.com/zidanindratama/be-gunasmash)

---

## ✨ Fitur Utama

- 🔑 **Autentikasi & Autorisasi**
  - Sign-up / Sign-in dengan Passport Local
  - JWT Access Token & Refresh Token
  - Endpoint `/auth/me` & logout

- 🧑‍🤝‍🧑 **RBAC** — Role `ADMIN` dan `MEMBER`
- 📢 **Pengumuman (Announcements)** — CRUD lengkap + pencarian, filter, sorting, dan paginasi
- 🕓 **Absensi (Attendance)** — Check-in anggota, check-in admin, rekap sesi, dan ekspor CSV
- 📰 **Blog** — CRUD, tag, status publish/unpublish
- 👥 **Anggota (Users)** — List/get user, ubah role, hapus, import/export CSV
- ☁️ **Upload Gambar** — Cloudinary (multipart/form-data)
- 📊 **Statistik (Stats)** — Data global & statistik kehadiran per sesi
- 🧩 **Developer Experience**
  - Validasi Zod
  - Middleware error handler
  - CORS, Helmet, Compression, dan Morgan logging

- 🌱 **Seeder** — Generate data dummy otomatis (user, pengumuman, blog, absensi)

---

## 🧱 Teknologi

| Kategori      | Teknologi                                 |
| ------------- | ----------------------------------------- |
| **Runtime**   | Node.js (TypeScript)                      |
| **Framework** | Express 5                                 |
| **ORM**       | Prisma (MongoDB)                          |
| **Auth**      | Passport Local + JWT (HS256)              |
| **Validasi**  | Zod                                       |
| **Upload**    | Cloudinary SDK                            |
| **CSV**       | fast-csv, json2csv                        |
| **Lainnya**   | Helmet, compression, cors, morgan, multer |

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
   ├─ uploads           # Upload ke Cloudinary
   └─ users             # CRUD & import/export anggota
```

---

## ⚙️ Menjalankan Proyek

### 1️⃣ Prasyarat

- Node.js ≥ 18
- MongoDB (Atlas disarankan)
- Akun Cloudinary

### 2️⃣ Instalasi

```bash
npm install
```

### 3️⃣ Konfigurasi `.env`

```dotenv
NODE_ENV=development
PORT=4000

DATABASE_URL="mongodb+srv://<user>:<pass>@<cluster>/<db>?appName=<app>"

JWT_ACCESS_SECRET=ubah-ini
JWT_REFRESH_SECRET=ubah-ini-juga
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

CLOUDINARY_CLOUD_NAME=nama-cloud
CLOUDINARY_API_KEY=api-key
CLOUDINARY_API_SECRET=api-secret

CORS_WHITELIST=localhost,vercel.app

SEED=123
SEED_USERS=20
SEED_ANNOUNCEMENTS=20
SEED_BLOGS=20
```

> ⚠️ Jangan commit `.env` ke GitHub — hanya simpan `.env.example`.

### 4️⃣ Generate Prisma Client

```bash
npm run db:gen
```

### 5️⃣ Jalankan Seeder (opsional)

```bash
npm run seed
```

Seeder otomatis membuat:

- Admin default (`Muhamad Zidan Indratama`)
- Data user acak
- Pengumuman latihan rutin (Rabu & Minggu)
- Blog dummy
- Sesi absensi & data kehadiran

### 6️⃣ Jalankan Server

```bash
npm run dev         # mode pengembangan
npm run build && npm start   # mode produksi
```

Akses di [http://localhost:4000](http://localhost:4000)

---

## 📦 API Overview

### Base URL

```
http://localhost:4000/api
```

### Format Respons

```json
// sukses
{ "success": true, "data": <payload> }

// gagal
{ "success": false, "error": { "message": "Pesan error" } }
```

---

## 📚 Endpoint Utama

### 🔑 Auth (`/auth`)

| Method   | Endpoint   | Deskripsi                        |
| -------- | ---------- | -------------------------------- |
| `POST`   | `/sign-up` | Registrasi user baru             |
| `POST`   | `/sign-in` | Login & set cookie refresh token |
| `POST`   | `/refresh` | Refresh access token             |
| `DELETE` | `/logout`  | Logout & hapus cookie            |
| `GET`    | `/me`      | Info user login                  |

---

### 👥 Users (`/users`) — hanya `ADMIN`

- `GET /` — List user
- `GET /:id` — Detail user
- `PATCH /:id/role` — Ubah role
- `DELETE /:id` — Hapus user
- `POST /import` — Import CSV (`name,email,password?`)
- `GET /export/csv` — Export CSV

---

### 📢 Announcements (`/announcements`)

- `GET /` — List pengumuman
- `GET /:id` — Detail pengumuman
- `POST /` (ADMIN) — Tambah pengumuman
- `PATCH /:id` (ADMIN) — Edit pengumuman
- `DELETE /:id` (ADMIN) — Hapus pengumuman

---

### 🕓 Attendance (`/attendance`)

- `POST /check-in` — Check-in anggota
- `POST /admin/check-in` — Check-in manual (ADMIN)
- `GET /session/summary` — Rekap kehadiran sesi
- `GET /session/export` — Ekspor CSV kehadiran

---

### 📰 Blogs (`/blogs`)

- `GET /` — List blog
- `GET /:id` — Detail blog
- `POST /` (ADMIN) — Tambah blog
- `PATCH /:id` (ADMIN) — Edit blog
- `DELETE /:id` (ADMIN) — Hapus blog

---

### ☁️ Uploads (`/uploads`)

- `POST /image` (auth) — Upload gambar ke Cloudinary

---

### 📊 Stats (`/stats`)

- `GET /` — Statistik global
- `GET /attendance?announcementId=...&date=YYYY-MM-DD` — Statistik kehadiran per sesi

---

## 🗃️ Skema Database

- `User` → Data anggota (`ADMIN` / `MEMBER`)
- `Announcement` → Jadwal latihan
- `Blog` → Artikel/berita klub
- `AttendanceSession` → Sesi latihan per tanggal
- `Attendance` → Data kehadiran per user

---

## 🧪 Format CSV

| Jenis          | Header                 |
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

📧 [zidanindratama03@gmail.com](mailto:zidanindratama03@gmail.com)
🌐 [zidanindratama.vercel.app](https://zidanindratama.vercel.app)

---

## 📝 Lisensi

**ISC License** — bebas digunakan & dimodifikasi untuk kebutuhan internal kampus/organisasi.

---

> Backend ini dibuat untuk mendukung sistem informasi UKM Bulutangkis **GunaSmash**,
> agar kegiatan latihan, absensi, dan informasi klub bisa dikelola secara modern, cepat, dan efisien.

---
