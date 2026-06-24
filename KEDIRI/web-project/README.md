# GMV Tracker — Panduan Setup & Deploy

Dashboard ini awalnya dibangun di Claude (single-file artifact). Project ini adalah versi
"siap deploy"-nya: penyimpanan data sudah diganti dari `window.storage` (khusus Claude)
ke Firebase Firestore, dan ditambah gerbang login dengan satu password bersama untuk tim.

Total biaya: **Rp0** untuk pemakaian tim kecil (Firebase Firestore + Authentication dan
hosting Vercel sama-sama punya free tier yang jauh lebih dari cukup untuk skala ini).

---

## Yang kamu butuhkan sebelum mulai

- Akun Google (untuk Firebase) — gratis, pakai akun Google biasa juga bisa.
- Node.js terinstall di komputer kamu. Cek dulu dengan `node -v` di terminal; kalau belum ada,
  download di https://nodejs.org (pilih versi LTS).
- Akun GitHub (untuk deploy ke Vercel) — gratis. Boleh skip kalau mau pakai Vercel CLI langsung
  (lihat Langkah 4, opsi B).

---

## Langkah 1 — Install dependencies project

Buka terminal, masuk ke folder project ini, jalankan:

```bash
npm install
```

Ini akan men-download React, Firebase SDK, recharts, lucide-react, dan xlsx — semua yang
dipakai dashboard. Prosesnya beberapa menit tergantung koneksi internet.

---

## Langkah 2 — Setup Firebase (backend data + login)

1. Buka https://console.firebase.google.com, klik **Add project**. Kasih nama bebas
   (misalnya `gmv-tracker`). Boleh matikan Google Analytics kalau tidak perlu — tidak
   memengaruhi dashboard ini.

2. Di sidebar kiri project kamu, klik **Build > Firestore Database** → **Create database**.
   - Pilih lokasi server terdekat (misalnya `asia-southeast1` / Singapore).
   - Pilih mode **Start in production mode** (security rules akan kita atur manual di
     langkah berikutnya, bukan pakai mode test yang terbuka untuk siapa saja).

3. Masih di Firestore, klik tab **Rules** di bagian atas. Hapus isi defaultnya, ganti dengan
   isi file `firestore.rules` yang ada di folder project ini (isinya cuma beberapa baris).
   Klik **Publish**.
   - Ini yang membuat data dashboard cuma bisa dibaca/ditulis oleh orang yang sudah login —
     bukan siapa saja yang kebetulan tahu URL Firestore-nya.

4. Di sidebar kiri, klik **Build > Authentication** → **Get started**. Di daftar provider,
   klik **Email/Password** → aktifkan (toggle pertama, "Email/Password") → **Save**.

5. Masih di Authentication, klik tab **Users** → **Add user**.
   - Email: ketik persis `team@internal.local`
   - Password: pilih password yang akan jadi **password bersama seluruh tim** kamu.
   - Klik **Add user**.
   - (Email ini bukan email asli siapa pun — cuma identitas teknis di balik layar. Yang
     dipakai tim untuk login nantinya cuma kotak "Password", bukan email.)

6. Klik ikon gerigi di pojok kiri atas (Project Settings) → scroll ke bagian
   **Your apps** → klik ikon **`</>`** (Web) untuk daftarkan app baru.
   - Kasih nama bebas (misalnya "GMV Tracker Web"), **jangan** centang Firebase Hosting
     (kita pakai Vercel, bukan Firebase Hosting).
   - Klik **Register app**. Akan muncul blok kode berisi object `firebaseConfig` — ini yang
     kamu butuhkan di langkah berikutnya.

7. Buka file `src/firebaseConfig.js` di project ini, ganti semua nilai `"GANTI_..."` dengan
   nilai persis dari object `firebaseConfig` yang muncul di langkah 6. Simpan file-nya.

---

## Langkah 3 — Coba jalankan di komputer kamu dulu

```bash
npm run dev
```

Buka link yang muncul di terminal (biasanya `http://localhost:5173`). Coba login pakai
password yang kamu buat di Langkah 2.5. Kalau dashboard muncul dan kamu bisa input data,
berarti semua tersambung dengan benar.

---

## Langkah 4 — Deploy supaya tim bisa akses dari mana saja

### Opsi A — Lewat web Vercel (lebih mudah kalau belum biasa pakai terminal)

1. Push folder project ini ke repository baru di GitHub.
2. Buka https://vercel.com, daftar/login pakai akun GitHub kamu.
3. Klik **Add New > Project**, pilih repo GitHub yang baru kamu push.
4. Vercel otomatis mendeteksi ini project Vite — biarkan setting default, klik **Deploy**.
5. Tunggu 1–2 menit, kamu akan dapat URL publik seperti `gmv-tracker-xxxx.vercel.app`.

### Opsi B — Lewat terminal (Vercel CLI, tanpa perlu push ke GitHub dulu)

```bash
npm install -g vercel
vercel
```

Ikuti instruksi yang muncul (login, pilih scope, konfirmasi folder). Di akhir proses kamu
akan dapat URL publik yang sama seperti Opsi A.

---

## Langkah 5 — Bagikan ke tim

Kirim ke tim kamu: **URL Vercel** + **password tim** (yang kamu buat di Langkah 2.5).
Cukup dua hal itu yang mereka perlu tahu untuk mulai pakai dashboard-nya.

---

## Catatan penting

- **Ini "satu password untuk semua orang"**, bukan akun per-orang. Cukup untuk tim kecil
  yang saling percaya, tapi siapa pun yang tahu password itu otomatis bisa lihat & ubah
  semua data — termasuk hapus data lewat tab Target & Akun. Riwayat revisi di dashboard
  tetap mencatat *apa* yang berubah, tapi tidak mencatat *siapa orangnya* (karena memang
  satu akun bersama). Kalau nanti butuh akun terpisah per anggota tim (supaya jejak
  revisinya juga mencatat nama orangnya), itu langkah upgrade berikutnya — fondasi
  Firebase Authentication-nya sudah ada, tinggal diperluas.
- **Mengganti password tim**: buka Firebase Console > Authentication > Users > klik user
  `team@internal.local` > reset/ubah password dari sana.
- **Kalau dashboard tidak bisa connect** setelah deploy: cek lagi isi `src/firebaseConfig.js`
  sudah benar, dan pastikan Firestore Rules sudah di-Publish (Langkah 2.3).
- **Soal APK Android**: project ini sudah berbentuk website biasa, jadi sudah otomatis
  bisa diakses dan dipakai normal dari browser HP (Chrome/Safari) tanpa perlu APK terpisah.
  Kalau nanti tetap mau versi APK yang bisa diinstall dari Play Store, langkah berikutnya
  adalah membungkus website ini pakai Capacitor — beda proses lagi, dan butuh Android
  Studio untuk build-nya.

---

## Upgrade ke Multi-Akun (8 Login Terpisah)

Mulai versi ini, dashboard tidak lagi pakai satu password bersama untuk semua orang.
Sekarang ada **8 akun login terpisah**: 7 toko (masing-masing cuma bisa mengubah data
tokonya sendiri, tapi tetap bisa LIHAT semua toko) + 1 akun **Admin** (akses penuh ke
semuanya, termasuk import/export/hapus data dan ubah nama akun/benchmark).

Ini perubahan besar di sisi Firebase — perlu setup ulang sebagian. Ikuti urutan ini:

### 1. Ganti Firestore Rules

Buka Firebase Console → Firestore Database → tab **Rules**. Ganti seluruh isinya dengan
isi file `firestore.rules` yang baru (sudah beda total dari sebelumnya). Klik **Publish**.

### 2. Buat 8 user di Firebase Authentication

Buka **Authentication → Users → Add user**, ulangi 8 kali dengan email & password berikut
(password boleh kamu ganti sendiri, ini cuma contoh — **catat password masing-masing**,
karena itu yang akan dipakai tiap toko untuk login):

| Email (jangan diubah) | Untuk Toko | Username buat login |
|---|---|---|
| pretty@internal.local | Pretty Cosmetic | pretty |
| lovie@internal.local | Lovie Dovey | lovie |
| flowie@internal.local | Flowie Cosmetic | flowie |
| our@internal.local | Our Beauty Space | our |
| celline@internal.local | Celline Cosmetic | celline |
| kiwie@internal.local | Kiwie Cosmetic | kiwie |
| twie@internal.local | Twie Beauty (Shopee) | twie |
| admin@internal.local | — (akses semua) | admin |

Kalau sebelumnya kamu sudah punya user `team@internal.local` dari setup lama, boleh
dihapus (klik titik tiga di sampingnya → Delete user) — sudah tidak dipakai lagi.

### 3. Buat koleksi `userRoles` di Firestore

Ini langkah yang menentukan "akun ini login sebagai toko apa". Untuk **masing-masing**
dari 8 user di atas:

1. Di Authentication → Users, klik usernya, copy nilai **User UID** (deretan huruf-angka
   acak, bukan email).
2. Buka Firestore Database → tab **Data** → klik **Start collection** (kalau koleksi
   `userRoles` belum ada) atau klik koleksi `userRoles` yang sudah ada → **Add document**.
3. Document ID: paste UID yang tadi di-copy (**bukan diketik manual, harus persis sama**).
4. Tambah field: nama field `accountId`, tipe `string`, isi sesuai tabel di bawah.
5. Save.

| User | Isi field `accountId` |
|---|---|
| pretty@internal.local | `tt1` |
| lovie@internal.local | `tt2` |
| flowie@internal.local | `tt3` |
| our@internal.local | `tt4` |
| celline@internal.local | `tt5` |
| kiwie@internal.local | `tt6` |
| twie@internal.local | `shopee` |
| admin@internal.local | `admin` |

### 4. Update file project & migrasi data lama

1. Timpa folder `src` di komputer kamu dengan isi zip baru ini (atau ganti satu-satu:
   `GMVDashboard.jsx`, `App.jsx`, `storageAdapter.js` — ketiganya berubah).
2. Jalankan `npm install` lagi kalau ada dependency baru (aman dijalankan ulang kapan saja).
3. Jalankan dashboard (`2-Jalankan.bat` atau `npm run dev`), **login sebagai admin**.
4. Buka tab **Target & Akun**, paling atas ada card **"Migrasi Data Lama"** — klik
   tombolnya **sekali**. Ini memindahkan semua data yang sudah kamu input sebelumnya
   (GMV Juni, target, breakdown Lovie Dovey, dll) ke struktur baru. Tanpa ini, data lama
   akan kelihatan kosong (bukan hilang — cuma belum dipindah).

### 5. Deploy ulang & bagikan akses baru

Kalau sudah pernah deploy ke Vercel, push perubahan ini juga (`vercel` lagi, atau push ke
GitHub kalau pakai auto-deploy). Setelah itu, kasih tahu tiap toko: **URL dashboard +
username tokonya + password masing-masing** (bukan lagi satu password sama untuk semua).

### Catatan
- Tabel target di tab Target & Akun tetap menampilkan semua toko ke semua orang (read-only
  untuk yang bukan tokonya), sesuai permintaan kamu.
- Import Google Sheets, ubah nama akun/benchmark, export Excel, dan hapus data sekarang
  **cuma muncul untuk Admin** — toko biasa tidak akan melihat tombol-tombol itu sama sekali.
- Riwayat Revisi tetap kelihatan untuk semua orang, tapi tombol "Pulihkan" cuma aktif untuk
  Admin atau pemilik data tersebut.

