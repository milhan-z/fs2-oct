# Prompt pertama untuk Claude Code

Salin seluruh blok di bawah ke Claude Code (jalankan dari folder `Web`). Disarankan pakai Plan Mode dulu untuk milestone M0, lalu lanjut biasa.

---

Kamu akan membangun **FS² Digital Passport**, web app mobile-first untuk acara FS² Student Booth (Rabu, 28 Oktober 2026, Global Kampong ITS, ±100 peserta). Semua konteks ada di folder ini:

- `CLAUDE.md` — aturan kerja & stack (baca dulu)
- `docs/SPEC.md` — spesifikasi lengkap (sumber kebenaran)
- `docs/MOTION.md` — animasi & transisi wajib
- `docs/ASSETS.md` — aset + node Figma
- `data/seed.json` — data awal (booth, pemateri, fasilitas, feedback, waktu)
- `assets/` — cap negara (PNG) dan denah Global Kampong (SVG)
- `reference/screenshots/` + `reference/mockups/` — desain yang sudah disetujui

Target paling dekat: **hari ini aku harus bisa mendemokan aplikasi yang terlihat jadi ke PIC** (posisi booth, cerita pemateri, titik toilet masih placeholder dan akan direvisi setelah demo). Simulasi bersama panitia Selasa 27 Okt, acara Rabu 28 Okt. Jadi kerjakan berurutan:

**M0 — Fondasi (cepat).** Scaffold Vite + React + TS + Tailwind v4 + Router + Motion di folder ini (folder `docs/ data/ assets/ reference/` tetap). Buat design tokens dari SPEC §6, font (Poppins, Libre Baskerville, Anton, Courier Prime), komponen dekor dasar (lampu natal yang bohlamnya bisa dianimasikan, bunga Demogorgon, TV retro, sampul paspor), lapisan data `src/data/api.ts` dengan adapter **mock** dulu (seed dari `data/seed.json`). Salin aset ke `public/assets/`. Bila Figma MCP tersedia, ekspor aset GSM sesuai `docs/ASSETS.md`.

**M1 — Alur peserta lengkap di mode mock.** P0–P9 + Panduan + onboarding denah, persis mengikuti screenshot dan `docs/MOTION.md` (sampul membuka seperti buku, onboarding gedung → zoom Lounge → pin jatuh, foto polaroid terbang ke paspor, momen cap dengan stempel negara, pop-up booth dengan TV retro, toggle Lounge/Seluruh gedung yang zoom halus). Peta dibuat dari `assets/map/global-kampong-walls.svg` (restyle: garis krem di panel merah tua), pin & fasilitas dari seed. Sediakan panel dev `?dev=1` untuk simulasi konfirmasi petugas & lompat waktu supaya demo ke PIC lancar.

**M2 — Petugas & admin di mode mock.** Scanner beruntun (`qr-scanner`, antrean, duplikat, Konfirmasi semua, input manual, riwayat/batal). Admin: ringkasan, pengajuan (ACC/kembalikan/Stamp4It), peserta (reset PIN), edit booth/pemateri/fasilitas/feedback + geser titik di peta, mode simulasi, ekspor XLSX/CSV format SPEC §7.

👉 **Berhenti setelah M2 dan beri tahu aku cara menjalankan demo** (`npm run dev`, dan deploy preview ke Vercel bila aku sudah login Vercel CLI), supaya aku bisa tunjukkan ke PIC.

**M3 — Backend Supabase.** Migrasi skema (SPEC §4), RLS ON tanpa policy anon, RPC `SECURITY DEFINER`, pgcrypto untuk PIN, rate limit, bucket privat foto + Edge Function signed URL, seed dari `data/seed.json`, adapter `supabase`. Aku sediakan `.env` berisi `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, dan (hanya untuk server/CLI) `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`. Bila Supabase MCP tersedia, pakai itu. Kata sandi admin & PIN petugas tiap booth: buat acak, simpan hash di DB, tampilkan sekali ke aku.

**M4 — Uji & rilis.** Jalankan kriteria selesai SPEC §9 (uji Playwright 390×844 untuk alur utama, uji 10 scan beruntun, uji offline resume), Lighthouse, deploy produksi Vercel, matikan panel dev di produksi, dokumentasikan di `README.md` (cara ganti data booth, reset, ekspor, mode simulasi).

Aturan: jangan ganti arah desain dari screenshot; jangan mengarang data pemateri baru; tanya aku bila ada keputusan yang tidak tercakup SPEC. Mulai dari M0 sekarang — tampilkan rencana singkat lalu eksekusi.
