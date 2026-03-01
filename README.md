# Emes CBT – Fullstack Edition
### Next.js + Firebase Firestore + Vercel

Konversi lengkap dari Google Apps Script (GAS) ke fullstack web app.  
Semua fitur dan fungsi dipertahankan 100%.

---

## 📁 Struktur Project

```
emescbt/
├── lib/
│   ├── firebase.js        # Firebase Admin SDK init (singleton)
│   ├── firestore.js       # Helper: fsGet, fsSet, fsList, fsQuery, dll
│   ├── auth.js            # JWT auth, RBAC permissions, login handlers
│   └── utils.js           # generateId, logActivity, cache, loadPengaturan, dll
│
├── pages/
│   ├── index.js           # Halaman Login (port HTML_LOGIN dari GAS)
│   ├── admin.js           # Redirect → load admin.html via /api/page
│   ├── siswa.js           # Redirect → load siswa.html via /api/page
│   └── api/
│       ├── app.js         # Main router (≡ doPost GAS) – semua action di sini
│       ├── page.js        # HTML page server (≡ doGet GAS)
│       ├── setup.js       # Setup Firestore (buat data default)
│       └── handlers/
│           ├── auth.js       # login, loginAdmin, logout
│           ├── admin.js      # getDashboard, getInitData, adminUsers, backup
│           ├── siswa.js      # CRUD siswa, importSiswa
│           ├── soal.js       # CRUD soal, importSoal
│           ├── paket.js      # CRUD paket, duplikasi, token ujian
│           ├── ujian.js      # Engine ujian: getSoal, autosave, submit, nilai
│           ├── nilai.js      # getNilaiList, getHasilDetail, exportNilai
│           ├── monitoring.js # getMonitoring, resetUjian, paksakanSubmit
│           ├── log.js        # getLogActivity, clearLog
│           ├── pengaturan.js # getPengaturan, savePengaturan, publik
│           ├── chat.js       # Chat siswa-admin + FAQ + chatbot
│           ├── report.js     # getAnalisaButir, koreksi uraian
│           ├── cetak.js      # Daftar hadir, berita acara
│           ├── lisensi.js    # Validasi NPSN
│           └── media.js      # Upload gambar (Cloudinary/Firebase Storage)
│
├── scripts/
│   └── extract-html.js    # Ekstrak HTML_ADMIN & HTML_SISWA dari file .gs
│
├── public/
│   └── html/              # admin.html & siswa.html (hasil ekstraksi)
│
├── .env.example           # Template environment variables
├── vercel.json            # Konfigurasi Vercel deployment
└── next.config.js
```

---

## 🚀 Cara Setup (Step-by-Step)

### 1. Clone & Install

```bash
git clone https://github.com/username/emescbt.git
cd emescbt
npm install
```

### 2. Konfigurasi Firebase

1. Buka [Firebase Console](https://console.firebase.google.com)
2. Buat project baru atau gunakan yang sudah ada
3. Aktifkan **Firestore Database** (mode Production)
4. Buka **Project Settings → Service Accounts**
5. Klik **Generate New Private Key** → download JSON
6. Dari JSON tersebut, ambil:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`

### 3. Buat File .env.local

```bash
cp .env.example .env.local
# Edit .env.local dengan nilai yang benar
```

Isi:
```env
FIREBASE_PROJECT_ID=nama-project-firebase-anda
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@nama-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMII...\n-----END RSA PRIVATE KEY-----\n"

JWT_SECRET=random_string_64_karakter_atau_lebih

SETUP_SECRET=password_rahasia_untuk_endpoint_setup
```

> **Penting:** `FIREBASE_PRIVATE_KEY` harus diapit tanda kutip dan newline diganti `\n`

### 4. Ekstrak HTML dari File .gs

File HTML admin & siswa ada di file `.gs` sebagai string panjang.  
Script berikut mengekstraknya menjadi file HTML terpisah:

```bash
node scripts/extract-html.js /path/to/EmesCBTApp_v5c_Sync.gs
```

Ini akan membuat:
- `public/html/admin.html`
- `public/html/siswa.html`

### 5. Setup Data Awal di Firestore

Jalankan dev server dulu:
```bash
npm run dev
```

Lalu jalankan setup endpoint:
```bash
curl -X POST http://localhost:3000/api/setup \
  -H "Content-Type: application/json" \
  -d '{"secret": "password_rahasia_setup_anda"}'
```

Ini akan membuat:
- Akun admin default (username: `admin`, password: `admin123`)
- Pengaturan default
- FAQ contoh

**⚠️ Segera ganti password admin setelah pertama kali login!**

### 6. Jalankan Development Server

```bash
npm run dev
# Buka: http://localhost:3000
```

---

## 🌐 Deploy ke Vercel

### Via Vercel CLI

```bash
npm i -g vercel
vercel

# Saat prompted, set environment variables:
# FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, JWT_SECRET, SETUP_SECRET
```

### Via GitHub + Vercel Dashboard

1. Push ke GitHub
2. Import project di [vercel.com](https://vercel.com)
3. Set **Environment Variables** di Settings → Environment Variables:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` (paste value termasuk `-----BEGIN...-----`)
   - `JWT_SECRET`
   - `SETUP_SECRET`
4. Deploy

Setelah deploy, jalankan setup:
```bash
curl -X POST https://nama-project.vercel.app/api/setup \
  -H "Content-Type: application/json" \
  -d '{"secret": "SETUP_SECRET_anda"}'
```

---

## 🔄 Pemetaan GAS → Next.js

| GAS | Next.js |
|-----|---------|
| `doGet(e)` | `pages/api/page.js` (serve HTML) |
| `doPost(e)` | `pages/api/app.js` (route actions) |
| `HtmlService.createHtmlOutput()` | Static HTML di `public/html/` |
| `ScriptApp.getService().getUrl()` | `/api/app` (env-based) |
| `ContentService.createTextOutput(JSON)` | `res.json()` |
| `PropertiesService.getScriptProperties()` | `process.env.*` |
| `CacheService.getScriptCache()` | In-memory Map / Upstash Redis |
| `LockService.getScriptLock()` | Firestore transaction (coming soon) |
| `UrlFetchApp.fetch()` | Native `fetch()` |
| `Utilities.base64Decode()` | `Buffer.from(base64, 'base64')` |
| `DriveApp.createFile()` | Cloudinary / Firebase Storage |
| `EmesCBTLicense.validate()` | API Kemendikbud / custom |
| `SpreadsheetApp.getUi()` | (tidak digunakan di web) |
| Firebase Admin SDK (di GAS via UrlFetchApp) | `firebase-admin` package langsung |

---

## 🔐 Autentikasi

- **GAS**: CacheService + token random 32 karakter, TTL 12 jam
- **Next.js**: JWT (jsonwebtoken) dengan secret env, expires 12h
- Token dikirim di request body (`{ action, token, ... }`) — identik dengan GAS

---

## 📤 Upload Gambar

File `pages/api/handlers/media.js` mendukung 3 opsi:

1. **Cloudinary** (direkomendasikan): Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
2. **Firebase Storage**: Set `FIREBASE_STORAGE_BUCKET`
3. **Fallback**: Kembalikan base64 data URL (development saja)

---

## 🏫 Lisensi NPSN

File `pages/api/handlers/lisensi.js` menggunakan API publik untuk validasi NPSN.  
Ganti implementasi `validateNPSN()` sesuai kebutuhan:

```javascript
// Contoh: validasi via API Kemendikbud
async function validateNPSN(npsn) {
  const res = await fetch(`https://api-sekolah-indonesia.vercel.app/sekolah?npsn=${npsn}`)
  const json = await res.json()
  // ...
}
```

---

## 🔧 Troubleshooting

**Error: `public/html/admin.html` tidak ditemukan**
→ Jalankan: `node scripts/extract-html.js path/to/EmesCBTApp_v5c_Sync.gs`

**Error: Firebase private key invalid**
→ Di `.env.local`, pastikan newline diganti `\n` dan value diapit `"..."`:
```
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMII...\n-----END RSA PRIVATE KEY-----\n"
```

**JWT expired / sesi habis**
→ Normal, siswa/admin perlu login ulang (12 jam)

**Fitur upload gambar tidak bekerja**
→ Set env Cloudinary atau Firebase Storage (lihat bagian Upload Gambar)

---

## 📋 Daftar Fitur (Semua Dipertahankan)

✅ Login siswa & admin dengan CAPTCHA canvas  
✅ Manajemen siswa (CRUD, import bulk)  
✅ Bank soal (CRUD, import, semua tipe soal)  
✅ Manajemen paket ujian (CRUD, duplikasi, token)  
✅ Engine ujian (pengacakan per-siswa, autosave, timer, submit)  
✅ Hitung nilai otomatis (PG, Isian, Uraian)  
✅ Monitoring real-time ujian  
✅ Rekap nilai & export CSV/Excel  
✅ Analisa butir soal (tingkat kesulitan, daya beda)  
✅ Koreksi manual soal uraian  
✅ Chat siswa-admin (real-time polling)  
✅ Chatbot berbasis FAQ  
✅ Cetak daftar hadir & berita acara  
✅ Log aktivitas sistem  
✅ Manajemen admin users (multi-role: admin, proktor, guru)  
✅ Pengaturan sekolah (identitas, logo, NPSN, ujian)  
✅ Backup & reset database  
✅ Lisensi NPSN  
✅ Upload gambar untuk soal  
✅ RBAC (Role Based Access Control) identik dengan GAS  

---

© Emes EduTech – Fullstack Edition
