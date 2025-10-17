# Gemini WhatsApp Bot — Versi Final (Stable) 🤖✨

> **Deskripsi singkat**
>
> Gemini WhatsApp Bot adalah bot WhatsApp yang ditenagai oleh Google Gemini (Generative AI) dan library *Baileys*. Bot ini dirancang untuk percakapan AI (chat + vision), konversi media ke stiker, membuka pesan *view-once*, manajemen owner, serta fitur on/off dan mode operasi (private/group/all). README ini menjelaskan cara instalasi, konfigurasi, perintah, dan tips troubleshooting secara lengkap dan mudah dipahami. 🛠️📚

---

## 📌 Fitur Utama
- 💬 Chat AI dengan dukungan history per percakapan
- 🖼️ Vision: kirim gambar -> bot bisa memproses lewat Gemini
- 🧾 /sticker `/s`: ubah gambar/video jadi stiker (support animated gif/video, batas 10 detik)
- 🔓 /reveal: membuka pesan **1x lihat** (view-once)
- ⚙️ Manajemen owner: **add/del/list owner** dan owner utama dari `.env`
- 🛑 Fitur **/on** dan **/off**: nonaktifkan bot untuk semua orang kecuali owner
- 🔁 Rotasi API Key (jika ada banyak key Gemini)
- 📊 /stats untuk melihat status, uptime, model, jumlah owner
- 🔗 /link untuk menghasilkan QR pairing sementara

---

## ✅ Persyaratan (Prerequisites)
- Node.js v18+ (direkomendasikan node LTS terbaru)
- npm
- Akses ke Google Generative AI API (Gemini) — satu atau lebih API key
- Nomor WhatsApp yang akan jadi owner (dalam format `62xxxxxxxxxx` tanpa +)

---

## 🗂️ Struktur Project (setelah dijalankan)
```
wa-gemini-bot/
├── index.js
├── .env
├── package.json
├── package-lock.json
├── auth/                # session Baileys akan dibuat secara otomatis
└── .owner               # daftar owner tambahan (opsional)
```

---

## ⚙️ Konfigurasi .env
Buat file `.env` di root project dengan isi minimal berikut:

```
GEMINI_API_KEYS=API_KEY1,API_KEY2           # Pisahkan dengan koma jika lebih dari 1
OWNER_NUMBER=6289xxxxxxxx                   # Nomor utama owner (tanpa +)
GEMINI_MODEL=gemini-1.5-flash               # (opsional) default jika tidak diisi
SYSTEM_INSTRUCTION=Aku adalah asisten AI WhatsApp yang canggih, ramah, dan membantu.
```

> **Catatan penting:**
> - `GEMINI_API_KEYS` harus berisi setidaknya satu API key yang valid. Bot akan mencoba merotasi key jika salah satu gagal.
> - `OWNER_NUMBER` harus menggunakan kode negara (contoh: `62` untuk Indonesia) dan **tanpa** tanda `+`.

---

## 📥 Instalasi
1. Clone repo (atau copy file `index.js` ke folder baru):
```bash
git clone https://github.com/THEOYS123/bot-wa.git
cd bot-wa
```
2. Inisialisasi npm (jika belum):
```bash
npm init -y
```
3. Install dependencies:
```bash
npm install @whiskeysockets/baileys @google/generative-ai dotenv qrcode qrcode-terminal pino
```

---

## ▶️ Menjalankan Bot (Run)
Jalankan perintah berikut di folder project:

```bash
node index.js
```

Pertama kali dijalankan, bot akan menampilkan **QR** di terminal. Scan QR dengan WhatsApp (Perangkat Tertaut → Tautkan Perangkat) untuk menghubungkan akun.

> Jika kamu menggunakan Termux atau environment yang tidak mendukung menampilkan gambar QR, `qrcode-terminal` akan menampilkan teks QR yang bisa dipindai dari layar lain.

---

## 🧭 Perintah (Commands)
Semua perintah dikirim lewat chat WhatsApp. Perintah owner hanya dapat dijalankan oleh nomor owner (di `.env` atau daftar `.owner`).

### Perintah untuk semua pengguna
- `/menu` atau `/help` — Menampilkan menu dan fitur.
- `/reset` — Reset riwayat percakapan untuk chat tersebut.
- `/sticker` atau `/s` — Balas (reply) atau kirim gambar/video dengan caption `/s` untuk membuat stiker. (Maks 10 detik untuk video)
- `/reveal` — Balas pesan *view-once* untuk mengungkapkan media.
- `/tagall` — (Hanya di grup, hanya admin) Mention semua anggota.
- `/groupinfo` — Menampilkan info grup.
- `/myjid` — Tampilkan JID Anda.

### Perintah khusus Owner
- `/on` — Aktifkan bot untuk semua orang.
- `/off` — Matikan bot (hanya owner yang bisa memanggil bot ketika OFF).
- `/stats` — Lihat statistik bot (uptime, model, jumlah owner, dsb).
- `/system <instruksi>` — Ganti system instruction / personality bot.
- `/model <nama_model>` — Ganti model AI (contoh: `gemini-1.5-pro-latest`).
- `/mode <private|group|all>` — Ubah mode kerja bot.
- `/listowner` — Lihat daftar owner.
- `/addowner <nomor atau mention>` — Tambah owner baru.
- `/delowner <nomor atau mention>` — Hapus owner.
- `/link` — Buat QR pairing sementara untuk menautkan perangkat lain.

---

## 📚 Contoh Penggunaan
1. Mengubah model AI (owner):
```
/model gemini-1.5-pro-latest
```
2. Menonaktifkan bot (owner):
```
/off
```
3. Mengubah instruksi sistem (owner):
```
/system Kamu adalah asisten ramah yang menjawab singkat.
```
4. Buat stiker:
- Kirim gambar dengan caption `/s` atau reply ke gambar dengan `/s`.

---

## 🛡️ Keamanan & Privasi
- Token/API key Gemini jangan sekali-kali di-commit ke repository publik. Gunakan `.gitignore` untuk mengecualikan `.env`.
- File session (`auth/`) menyimpan kredensial Baileys — jangan dibagikan.

Contoh `.gitignore` minimal:
```
.env
auth/
.owner
```

---

## 🛠️ Troubleshooting (Masalah Umum)
- **QR tidak muncul**: Hapus folder `auth/` lalu jalankan `node index.js` kembali.
- **Error: EISDIR: illegal operation on a directory, read**: Pastikan file `.owner` adalah file teks, bukan folder. Hapus/memperbaiki jika `.owner` menjadi folder.
- **API Key gagal/terblokir**: Bot otomatis berputar ke API key lain bila tersedia. Pastikan key valid dan tidak oversquota.
- **Gagal membuat stiker**: Pastikan media yang dikirim adalah gambar/video yang didukung, dan durasi video ≤ 10 detik.
- **Bot tidak merespon saat OFF**: Ini sengaja — hanya owner yang bisa memanggil bot saat OFF.

---

## 🚀 Menjalankan Bot sebagai Service (Opsional)
Jika ingin bot berjalan terus-menerus di server, gunakan `pm2` atau systemd.

Contoh dengan PM2:
```bash
npm install -g pm2
pm2 start index.js --name gemini-whatsapp-bot
pm2 save
pm2 startup
```

---

## 🙋 Cara Kontribusi
Mau nambah fitur atau perbaikan? Fork repo, buat branch baru, lalu kirim PR. Jelaskan perubahan pada file `CHANGELOG.md` atau di deskripsi PR.

---

## 📜 Lisensi
Taruh lisensi yang sesuai di repo (misal MIT) — sesuaikan kebutuhan kamu.

---

## 📞 Kontak
Jika butuh bantuan lebih lanjut, kasih tau aja lewat chat. Kalau mau integrasi khusus (auto-reply, DB, atau hosting) gue bantu jelasin step-by-step 🤝

[Contact]{httpz://t.me/flood1233}

[Saluran whatsapp]{https://whatsapp.com/channel/0029VagB9OYJJhzZIjgXGd11}

[My website]{https://ngoprek.xyz}

---

Terima kasih sudah pakai *Gemini WhatsApp Bot*! Semoga membantu dan bikin hidup lo lebih enteng 😎🗿
