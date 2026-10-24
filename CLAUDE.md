# CLAUDE.md — FS² Digital Passport

Web app mobile-first untuk acara FS² Student Booth (Rabu, 28 Okt 2026, Global Kampong ITS). Baca dulu, berurutan:
0. docs/DESIGN.md — kontrak visual, wajib dicek di setiap layar.
1. `docs/SPEC.md` — aturan bisnis, peran, arsitektur, skema, layar, visual, ekspor, kriteria selesai. **Sumber kebenaran.**
2. `docs/MOTION.md` — semua animasi & transisi (bagian penting dari kualitas, bukan hiasan opsional).
3. `docs/ASSETS.md` — aset yang ada + node Figma untuk diekspor.
4. `data/seed.json` — data awal (booth, pemateri, fasilitas, feedback, waktu acara).
5. `reference/screenshots/` dan `reference/mockups/` — tampilan yang sudah disetujui. Ikuti gaya & hierarkinya; boleh memperbaiki detail, jangan mengganti arah desain.

## Stack (jangan ganti tanpa alasan kuat)
Vite + React + TypeScript (strict) + Tailwind CSS v4 + React Router + Motion (`motion/react`) + Supabase JS + `qr-scanner` (nimiq) + `qrcode.react` + `browser-image-compression` + SheetJS (`xlsx`). Deploy: Vercel. Backend: Supabase (Postgres, Storage, Edge Functions).

## Aturan kerja
- Bahasa UI: **English** (acara ITS Global Engagement) — singkat & ramah. Kode, nama variabel, komentar: Inggris. Rute URL juga Inggris (/signin, /map, /passport, …).
- Mobile-first 360–430 px; admin desktop-first tapi tetap bisa di HP.
- Lapisan data lewat satu interface (`src/data/api.ts`) dengan dua adapter: **`mock`** (in-memory + localStorage, aktif bila `VITE_DATA_MODE=mock`) dan **`supabase`**. Mode mock wajib lengkap agar aplikasi bisa didemokan ke PIC sebelum backend siap. Di mode mock sediakan panel dev kecil (tersembunyi, buka dengan `?dev=1`) untuk: simulasi petugas mengonfirmasi booth, lompat waktu (sebelum/saat/sesudah sesi), reset data.
- Keamanan: RLS ON di semua tabel tanpa policy anon; akses hanya via RPC `SECURITY DEFINER` + token sesi; PIN di-hash `pgcrypto`; jangan pernah kirim PIN/hash/token ke klien lain atau ke ekspor. Simpan secret di `.env` (jangan di-commit).
- Waktu selalu Asia/Jakarta. Jangan hardcode tanggal di komponen; ambil dari settings/seed.
- Semua teks yang `placeholder: true` di seed harus bisa diubah dari admin, termasuk titik booth/fasilitas di peta (drag di admin).
- Aksesibilitas: target sentuh ≥ 44 px, input ≥ 16 px, kontras ≥ 4.5:1, label pada setiap input, `prefers-reduced-motion` dihormati.
- Jangan menambah fitur di luar SPEC tanpa bertanya. Jangan mengarang data baru pemateri; pakai placeholder yang ada.
- Setelah tiap milestone: jalankan `npm run build` + lint + uji alur utama di viewport 390×844 (Playwright bila tersedia), lalu laporkan singkat apa yang selesai dan apa yang belum.

## Folder (usulan)
```
src/
  app/ (router, layout, providers)
  screens/participant/ staff/ admin/
  components/ (PassportCover, ChristmasLights, DemogorgonFlower, RetroTV, MapPanel, BoothPin, StampMoment, ...)
  map/ (svg walls dari assets/map, viewBox presets: lounge & building)
  data/ (api.ts, mockAdapter.ts, supabaseAdapter.ts, types.ts)
  motion/ (preset kurva, variants)
  styles/ (tokens.css)
supabase/ (migrations/, functions/, seed.sql dibuat dari data/seed.json)
public/assets/ (stamps/, gsm/)
```
