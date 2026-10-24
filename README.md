# FS² Digital Passport

Web app mobile-first untuk **FS² Student Booth: Special Edition** (Rabu, 28 Okt 2026, Global Kampong ITS). **UI berbahasa Inggris** (acara ITS Global Engagement).
Spesifikasi: `docs/SPEC.md` · animasi: `docs/MOTION.md` · aset: `docs/ASSETS.md`.

## Menjalankan (mode demo / mock)

```bash
npm install
npm run dev
```

Buka `http://localhost:5173/?dev=1` (tambahan `?dev=1` memunculkan tombol **DEV** kecil di kiri atas).
Untuk mencoba di HP dalam satu Wi-Fi: buka alamat `Network:` yang dicetak `npm run dev` (kamera di HP butuh HTTPS → pakai preview Vercel).

Mode mock menyimpan semua data di **browser itu saja** (localStorage). Tidak ada backend.

### Panel DEV (`?dev=1`, hanya mode mock)
- **Waktu**: Sebelum sesi / Saat sesi / Sesudah sesi / Lewat batas kirim / Nyata.
- **Mode simulasi**: scan terbuka kapan saja.
- **Cap B1–B4**: mensimulasikan petugas mengonfirmasi peserta yang sedang login → layar QR/Peta langsung memutar momen cap.
- **Isi resume otomatis**, **+12 peserta dummy** (PIN `1234`), **Reset semua**.
- Daftar akses demo: admin `/admin` (sandi `fs2admin`); staff `/staff` dengan PIN staff bersama mock `555555` lalu pilih booth (bisa ganti booth tanpa login ulang). PIN khusus per booth (`1111`/`2222`/`3333`/`4444`) tetap bisa di link `/staff/<slug>`.

### Alur demo ke PIC (±5 menit)
1. `/?dev=1` → **Buka Paspor** → isi NRP baru → buat paspor → foto → animasi denah → **Mulai**.
2. Peta: ketuk pin booth (pop-up TV retro), toggle **Seluruh gedung** (titik toilet).
3. Tombol **QR** → DEV → **Cap B2** → momen cap → **Tulis sekarang** → isi resume.
4. DEV → Cap B1/B3/B4 + Isi resume otomatis → Paspor → Halaman Keluar → feedback → **Kirim**.
5. Tab lain: `/staff/korea` (PIN 1111) → DEV +12 dummy → tombol *DEV: simulasi scan* beberapa kali → **Konfirmasi semua**.
6. `/admin` (fs2admin) → Pengajuan → Setujui / Kembalikan → Stamp4It → Ekspor XLSX.

## Rute
Peserta: `/` (sampul) → `/signin` → `/photo` (kamera polaroid pop-up) → `/onboarding` → halaman penuh `/map` · `/passport` · `/status` · `/guide`. Pop-up di atas halaman: `/qr`, `/visa/:booth`, `/stamp/:booth`, `/exit`. Bingkai buku hanya untuk sampul, sign-in, dan foto. Perbandingan sebelum/sesudah: `docs/BEFORE-AFTER.md`.
Staff: `/staff` (satu PIN staff bersama → pilih booth; dropdown booth di layar scan) atau langsung `/staff/<slug>`. Admin: `/admin` (peserta: edit NRP/nama/departemen, hapus, reset PIN; Booth & konten: PIN staff bersama) (`/admin/submissions`, `/participants`, `/content`, `/settings`, `/export`).

## Aset GSM (dari Figma FS2 › "FS2 Oct 26")
`public/assets/gsm/`: `logo-october.webp` (badge header), `logo-strip.webp` (logo instansi, sampul & Guide), `flower.svg` (bunga Demogorgon), `clock.svg` (jam kakek, Guide), `pine.webp` + `smoke1/2.svg` (onboarding), `skyline.svg` (Status), `clouds.svg` (momen cap). Lampu natal digambar ulang sebagai SVG agar tiap bohlam bisa dianimasikan.

## Mengganti data (tanpa deploy ulang)
Semua lewat `/admin`:
- **Booth & konten**: nama/region/slug booth, ganti cap (PNG), pemateri (nama, universitas, program, cerita, foto; bisa >1 per booth), fasilitas (toilet/musala), teks pertanyaan feedback, **geser titik booth/fasilitas di peta** (drag atau pilih item lalu klik peta), reset PIN petugas.
- **Peserta**: cari & **reset PIN** (PIN baru tampil sekali).
- **Pengaturan**: mode simulasi, jam sesi booth, batas kirim.
- **Ekspor**: XLSX (tab Respons/Kunjungan/Peserta) & CSV (Respons). Tanpa PIN/token/link foto.

Data awal ada di `data/seed.json` (dibaca saat build / saat reset mock).

## Skrip
| Perintah | Isi |
| --- | --- |
| `npm run dev` | server dev |
| `npm run build` | type-check + build produksi ke `dist/` |
| `npm run lint` | ESLint |
| `npm run assets` | kompres cap PNG (`assets/stamps`) → WebP di `public/assets/stamps` |
| `node scripts/shots.mjs` | jalankan alur utama di Chromium 390×844 & simpan screenshot ke `test-results/shots` (butuh `npm run dev` jalan) |

## Deploy preview (Vercel)
```bash
npm i -g vercel
vercel login
vercel
```
Saat ditanya, framework **Vite**, build `npm run build`, output `dist`. `vercel.json` sudah berisi rewrite SPA.

Environment Variables di Vercel (Project → Settings → Environment Variables):

| Nama | Nilai | Dari mana |
| --- | --- | --- |
| `VITE_DATA_MODE` | `supabase` (atau `mock` untuk demo tanpa backend) | — |
| `VITE_SUPABASE_URL` | `https://hkwylhvxxemminnbzlcd.supabase.co` | Supabase → Project Settings → API / Data API |
| `VITE_SUPABASE_ANON_KEY` | kunci **anon / publishable** | Supabase → Project Settings → API Keys (sama dengan di `.env.supabase.local`) |

Jangan pernah memasukkan service role key / secret key atau sandi database ke Vercel. Setelah mengubah env, lakukan **Redeploy**.

## Backend Supabase (M3)
| Bagian | Lokasi |
| --- | --- |
| Skema + RLS (tanpa policy) + bucket | `supabase/migrations/20261024000001_schema.sql` |
| Helper privat (hash token, sesi, rate limit) | `supabase/migrations/20261024000002_private_helpers.sql` |
| API RPC `SECURITY DEFINER` | `supabase/migrations/20261024000003_rpc.sql` |
| Data awal (dari `data/seed.json`) | `supabase/seed.sql` (`npm run seed:sql`) |
| Signed URL foto | `supabase/functions/photo-upload-url`, `supabase/functions/photo-view-url` (deploy dengan verify JWT **off** — fungsi memeriksa token sesi sendiri) |
| Kata sandi admin + PIN petugas acak | `node scripts/gen-credentials.mjs <file-di-luar-repo.sql>` → cetak sekali, simpan hanya hash |
| Uji SQL lokal (PGlite, 59 cek) | `npm run test:sql` |

**Sudah diterapkan** ke proyek Supabase `FS2` (`hkwylhvxxemminnbzlcd`, region ap-southeast-2): 3 migrasi, seed, kredensial acak, Edge Functions `photo-upload-url` & `photo-view-url`.

Menjalankan aplikasi dengan backend asli (konfigurasi di `.env.supabase.local`, tidak di-commit):
```bash
npm run dev:supabase
```
→ `http://localhost:5174`. Build produksi: `npm run build:supabase`. Di Vercel, set env `VITE_DATA_MODE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (panel DEV otomatis mati di mode ini).

Uji end-to-end ke backend asli (membuat peserta uji NRP `99990…`, menyalakan lalu mematikan mode simulasi):
```bash
FS2_ADMIN_PW=… FS2_PINS='{"B1":"…","B2":"…","B3":"…","B4":"…"}' node scripts/e2e-supabase.mjs
```
Bersihkan data uji sesudahnya (SQL editor Supabase):
```sql
delete from public.sessions where role = 'participant';
delete from public.participants where nrp like '99990%';
delete from public.login_attempts;
```
Ganti kata sandi admin / semua PIN petugas: `node scripts/gen-credentials.mjs <file-di-luar-repo.sql>`, jalankan SQL-nya, hapus filenya. PIN satu booth juga bisa direset dari admin → Booth & konten.

Catatan: `seed.sql` menimpa isi booth/pemateri; jalankan sekali saat awal saja (setelah itu ubah lewat admin).

## Status
- M0–M2 (mode mock): selesai.
- M3: selesai — diterapkan ke Supabase, lolos uji SQL lokal (59 cek) & uji end-to-end ke backend asli.
- Redesign UI & transisi (DESIGN.md, AUDIT.md): selesai — lihat `docs/BEFORE-AFTER.md`.
- M4: uji alur mock & Supabase lolos; tinggal uji coba ke PIC & gladi 27 Okt.
