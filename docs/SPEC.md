# FS² Digital Passport — Spesifikasi Build (v2, 24 Okt 2026)

Web app (PWA, mobile-first) untuk acara **FS² Student Booth: Special Edition — "Stranger Stories from the Other Side!"**, Rabu 28 Oktober 2026, 14.00–17.30 WIB, Global Kampong ITS. ±100 peserta, 4 booth, 4 HP petugas, 1 laptop admin.

Aplikasi hanya mengurus: **kehadiran (foto), kunjungan booth (cap), resume per booth, feedback, pengajuan Stamp4It, dan ekspor data.** RSVP tetap di Google Form (terpisah). Absensi acara tetap kertas di Front Office.

---

## 1. Aturan bisnis (wajib persis)

1. Ada 5 booth (update 27 Okt): 3 di **Lounge** (South Korea, Japan, Taiwan NTUST) dan 2 di ruang **Partnership** (Germany, Taiwan TISS). Peserta cukup menyelesaikan **4 booth mana saja** (stempel + resume); jumlah booth bisa ditambah/dihapus admin. Peta: tab Whole building (pertama) · Lounge · Partnership.
2. Login peserta: **NRP + PIN 4 digit**. NRP yang belum terdaftar langsung "buat paspor": nama, departemen, angkatan, PIN (2×). Tidak ada aktivasi, tidak dicek ke RSVP. Walk-in boleh.
3. Sebelum QR aktif, peserta wajib mengambil **1 foto kehadiran** (selfie, kamera depan). Boleh ulang foto sebelum pengajuan dikirim.
4. **Cap** = QR peserta di-scan petugas booth lalu dikonfirmasi petugas. Petugas **scan beruntun** (banyak QR berturut-turut masuk antrean di HP petugas), lalu **"Konfirmasi semua"**. Tidak ada auto-confirm. Satu booth hanya sekali per peserta (duplikat diabaikan dengan tanda kuning).
5. Urutan bebas. Resume booth terbuka setelah booth itu dicap. Peserta boleh keliling 4 booth dulu, menulis resume belakangan.
6. Resume per booth = **3 poin**, masing-masing minimal 5 kata. Autosave (debounce ±1,5 s) + draf lokal saat offline.
7. Feedback: 2 pertanyaan wajib (skala 1–5) + 1 opsional (teks). Teks pertanyaan bisa diedit admin.
8. Tombol **Kirim** aktif bila 4 booth dicap + 4 resume lengkap + feedback wajib terisi. **Batas kirim: Kamis 29 Okt 2026, 23.59 WIB.** Setelah kirim, isi terkunci; admin bisa "Kembalikan untuk revisi" dengan catatan (peserta bisa edit & kirim ulang → versi naik).
9. **Exit gate:** peserta cukup menunjukkan halaman Paspor yang memperlihatkan 4 booth sudah dicap. Pengajuan boleh dikirim nanti.
10. **ACC dilakukan admin setelah acara** di panel admin. Stamp4It dicatat terpisah (centang "diberikan") setelah ACC.
11. Scan hanya terbuka pada sesi booth 15.20–17.20 WIB tanggal 28 Okt, **kecuali** admin menyalakan "Mode simulasi" (untuk uji 27 Okt).
12. Semua waktu ditampilkan dalam WIB (Asia/Jakarta).

## 2. Peran & akses

| Peran | Masuk dengan | Bisa |
| --- | --- | --- |
| Peserta | NRP + PIN | Foto, QR, lihat peta & booth, tulis resume, feedback, kirim, lihat status |
| Petugas booth | Link `/staff/<slug-booth>` + PIN booth | Scan beruntun, konfirmasi semua, hapus entri antrean, input manual 4 digit NRP, riwayat & batalkan kunjungan |
| Admin | `/admin` + kata sandi admin | Ringkasan live, antrean pengajuan, ACC/kembalikan, Stamp4It, reset PIN peserta, edit data booth/pemateri/fasilitas/feedback/titik peta, mode simulasi, ekspor |

## 3. Arsitektur

- **Frontend:** Vite + React + TypeScript + Tailwind CSS v4, React Router, **Motion (Framer Motion)** untuk animasi. PWA (manifest + service worker sederhana untuk aset).
- **Backend:** Supabase (akun Hilman). Postgres + Storage + Edge Functions.
  - **Semua tabel RLS ON tanpa policy untuk anon** → klien tidak bisa baca/tulis tabel langsung.
  - Semua akses lewat **RPC Postgres `SECURITY DEFINER`** (dipanggil dengan anon key + token sesi) atau Edge Function bila butuh service role (signed upload URL foto, ekspor).
  - Sesi = token acak 32 byte; yang disimpan di DB hanya hash-nya; kedaluwarsa 3 hari.
  - PIN di-hash dengan `pgcrypto` (`crypt(pin, gen_salt('bf'))`). Rate limit: 5 gagal → kunci 5 menit per NRP.
- **QR peserta:** berisi token acak (bukan NRP/PIN), bisa di-rotate admin.
- **Scanner:** library **`qr-scanner` (nimiq)** — jalan di Safari iOS (tidak bergantung BarcodeDetector). Kamera belakang, scan kontinu, debounce per token 3 detik.
- **Pembaruan cap di HP peserta:** polling `get_my_state` tiap 4 s saat layar QR/Peta terbuka (cukup untuk 100 orang; Realtime opsional).
- **Foto:** kompres di HP (maks 720 px, JPEG ~0.7, ±150–250 KB) → upload ke bucket **privat** `attendance-photos` via signed upload URL dari Edge Function. Dilihat petugas (thumbnail di antrean) & admin via signed URL berumur pendek.
- **Hosting:** Vercel (akun Hilman). HTTPS wajib untuk kamera.
- **Ekspor:** di admin, tombol **Unduh XLSX** (SheetJS) dan **Unduh CSV**. Format seperti hasil Google Form (lihat §7). Opsional P1: Edge Function `export-csv?key=...` + Apps Script di Google Sheet yang menarik CSV tiap 5 menit (`IMPORTDATA`/`UrlFetchApp`).

## 4. Data (skema minimum)

```
participants(id, nrp unique, nama, departemen, angkatan, photo_path, created_at)
participant_auth(participant_id, pin_hash, failed_count, locked_until, qr_token unique)
sessions(token_hash, role[participant|staff|admin], subject_id, booth_id null, expires_at)
booths(id 'B1'..'B4', slug, nama, region, stamp_url, x, y, placeholder_pos bool, sort)
speakers(id, booth_id, nama, universitas, program, foto_url, cerita, placeholder bool)   -- 1 booth bisa >1 pemateri
facilities(id, jenis, label, x, y null, placeholder bool)
staff_pins(booth_id, pin_hash)
visits(id, participant_id, booth_id, scanned_at, confirmed_at, confirmed_by, cancelled_at null, unique(participant_id, booth_id) where cancelled_at is null)
resumes(participant_id, booth_id, poin1, poin2, poin3, updated_at)
feedback_questions(id, teks, tipe, wajib, sort)
feedback_answers(participant_id, question_id, nilai_int null, nilai_teks null)
submissions(id, participant_id, version, status[submitted|revision|approved], submitted_at, reviewed_at, reviewer_note)
stamp4it(participant_id, given bool, given_at, given_by)
settings(key, value)   -- simulation_mode, scan_window, deadline, admin_password_hash
audit_log(actor, action, target, at)
```

RPC yang dibutuhkan (nama bebas, ini acuan): `participant_login`, `participant_register`, `get_my_state`, `save_resume`, `save_feedback`, `submit`, `staff_login`, `staff_resolve_tokens` (kembalikan nama+NRP tersamar+thumb utk antrean, tandai duplikat), `staff_confirm_batch`, `staff_history`, `staff_cancel_visit`, `admin_login`, `admin_dashboard`, `admin_list_submissions`, `admin_review`, `admin_set_stamp4it`, `admin_reset_pin`, `admin_upsert_booth/speaker/facility/question`, `admin_set_setting`, `admin_export`. Edge Functions: `photo-upload-url`, `photo-view-url`, `export-csv` (P1).

Seed awal dari `data/seed.json`. Semua yang `placeholder:true` harus bisa diedit admin (titik booth bisa digeser di admin dengan klik di peta).

## 5. Layar

Navigasi peserta (setelah login & foto): **Peta · QR (tombol tengah besar) · Paspor**.

| Kode | Layar | Isi | Catatan |
| --- | --- | --- | --- |
| P0 | Sampul | Sampul paspor sinematik (navy, bingkai emas, FS², tagline merah menyala), tanggal/jam/tempat, "Buka Paspor", "Cara pakai" | Mockup `01-Main` |
| P1 | Masuk / Buat paspor | NRP → bila terdaftar: PIN. Bila baru: nama, departemen (dropdown + Lainnya), angkatan, PIN 2× | `02-Masuk` |
| P2 | Foto kehadiran | Kamera depan dalam bingkai polaroid, tombol rana, ganti kamera; setelah cekrek animasi polaroid → paspor | `03-Foto` |
| — | Onboarding denah (sekali) | Animasi gedung → zoom Lounge → pin jatuh (lihat MOTION.md); bisa dilewati; bisa diputar ulang dari Panduan | `15-Storyboard` |
| P3 | Peta (home) | Header (badge, nama, 4 lampu progres), bar "Berikutnya" kuning, toggle **Lounge / Seluruh gedung**, panel peta merah tua bergaris krem + lampu + bunga, pin booth berwarna status (belum = outline, dicap = merah, resume lengkap = hijau), fasilitas (ikon toilet dll.) di mode seluruh gedung | `04-Peta`, `06-PetaGedung` |
| P3c | Pop-up booth | Bottom sheet: region + nama booth, cap negara, foto pemateri dalam bingkai **TV retro**, nama, universitas (label kuning), program, cerita singkat (gelembung krem), status kunjungan, tombol Tulis resume | `05-Booth`. Bila >1 pemateri: carousel/stack |
| P4 | QR | QR besar dalam bingkai kuning, nama + NRP tersamar, tips kecerahan, status "menunggu konfirmasi petugas"; saat dikonfirmasi → P5 otomatis | `07-QR`. Naikkan brightness tidak bisa via web → tampilkan tips |
| P5 | Momen cap | Animasi stempel negara, lampu menyala, "Tulis sekarang" / "Booth lain" sama kuat | `08-Cap` |
| P6 | Paspor | Foto + identitas, 4 halaman visa (cap negara / kosong), status resume, syarat kirim + batas waktu, tombol ke Halaman Keluar. Ini juga yang ditunjukkan di exit gate | `09-Paspor` |
| P7 | Halaman visa + resume | Info booth + cap, kartu krem 3 kolom poin, counter, status simpan | `10-Visa` |
| P8 | Halaman Keluar | Checklist syarat, feedback, Kirim (nonaktif + alasan bila belum lengkap) | `11-Keluar` |
| P9 | Status | Stempel status (Menunggu pemeriksaan / Perlu revisi + catatan / Disetujui), kode pengajuan, Stamp4It | `12-Status` |
| — | Panduan | Aturan Stamp4It (4 booth × 3 poin, feedback, batas H+1), rundown, kontak Alex & Cia (WA), putar ulang onboarding | — |
| S1 | Masuk petugas | PIN booth | — |
| S2 | Scanner beruntun | Kamera selalu aktif + daftar antrean (foto kecil, nama, NRP tersamar, ×), duplikat kuning, "Konfirmasi semua (n)", input manual | `13-Scanner` |
| S3 | Riwayat petugas | Daftar terkonfirmasi, batalkan | — |
| A1–A5 | Admin | Ringkasan live (scan per booth, pengajuan), antrean pengajuan + detail (foto, resume, feedback) + Setujui/Kembalikan + Stamp4It, Peserta (cari, reset PIN), Booth & konten (edit + geser titik di peta), Pengaturan (mode simulasi, batas waktu), Ekspor | `14-Admin`. Desktop-first |

## 6. Visual system (GSM FS² October)

Acuan: Figma FS2 section "FS2 Oct 26" (node 1621:240) — **Coming Soon Feed Slide 1–2** dan **Opreg Feed Slide 5**; sampul memakai konsep paspor sinematik. Lihat `docs/ASSETS.md`.

| Token | Nilai | Pakai |
| --- | --- | --- |
| bg-0 | #0F0709 | latar paling gelap |
| bg-1 | #1A0A0C | latar |
| glow | #4A1215 | sorotan radial tengah |
| panel | #3A0F11 → #6A1A1C | panel peta / sheet |
| red | #D22B26 | tombol utama, cap |
| neon | #E82020 | glow judul (hanya sampul & momen cap) |
| yellow | #F9B018 | label/highlight, tombol sekunder kuat |
| navy | #0D2A4A / #102D44 | pita, sampul paspor, teks di atas kuning |
| gold | #D8AE54 | bingkai & teks sampul paspor |
| cream | #F4E8E2 | teks di latar gelap |
| paper | #F6F1E7 | kartu tulis, kertas visa |
| lampu | #E53935 #F6C343 #43A047 #3B5BDB #3A9AAE #EC6FA5 | lampu natal |

Tipografi: **Poppins** (800/700/600/400) untuk UI; **Libre Baskerville** Bold untuk judul sampul & italic untuk kutipan; **Anton** untuk label kapital & kode; **Courier Prime** untuk teks sampul paspor. Input ≥16 px, target sentuh ≥44 px, kontras teks ≥4.5:1. Glow neon hanya di sampul & momen cap. Variasikan dekor per layar (lampu, bunga Demogorgon, jam kakek, TV retro, asap) — jangan semua di satu layar.

## 7. Ekspor (format "hasil Google Form")

Sheet/tab **Respons** — 1 baris per peserta: `Waktu kirim, NRP, Nama, Departemen, Angkatan, Status, Versi, B1 jam cap, B1 poin 1, B1 poin 2, B1 poin 3, … B4 poin 3, Feedback 1, Feedback 2, Saran, Stamp4It`. Tab tambahan: **Kunjungan** (log scan), **Peserta**. Tidak ada PIN, hash, token, atau link foto.

## 8. Keamanan & privasi

- PIN, hash, token sesi, token QR tidak pernah dikirim ke klien lain / ekspor.
- NRP selalu tersamar (`••••0028`) di layar petugas & QR.
- Foto hanya bisa dilihat petugas (thumbnail saat konfirmasi, booth sendiri) dan admin.
- Tampilkan kalimat persetujuan singkat di layar foto ("Foto dipakai sebagai bukti kehadiran FS² dan hanya dilihat panitia").
- Jangan tampilkan email/kontak pribadi pemateri.

## 9. Kriteria selesai (cek sebelum simulasi 27 Okt)

- [ ] Peserta baru bisa daftar + foto + lihat peta dalam < 1 menit di HP Android & iPhone.
- [ ] Petugas bisa scan 10 QR berturut-turut lalu konfirmasi sekaligus; cap muncul di HP peserta ≤ 5 detik.
- [ ] Duplikat & QR asing ditolak dengan jelas; batalkan kunjungan berfungsi.
- [ ] Resume tidak hilang saat refresh / sinyal putus.
- [ ] Kirim hanya bisa saat syarat lengkap & sebelum batas; revisi berfungsi.
- [ ] Admin bisa ACC, kembalikan, Stamp4It, reset PIN, edit booth/titik, ekspor XLSX sesuai §7.
- [ ] Semua animasi di MOTION.md jalan mulus (60 fps di HP menengah) dan mati saat reduced motion.
- [ ] Lighthouse mobile: Performance ≥ 85, Accessibility ≥ 90.
- [ ] Deploy Vercel + Supabase prod; mode simulasi bisa dinyalakan.
