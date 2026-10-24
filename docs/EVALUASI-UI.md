# Evaluasi UI — build lokal 24 Okt 2026 (http://localhost:5174)

**Lingkup:** hanya tampilan (visual) dan transisi. Isi, alur, konten pop-up, dan bahasa Inggris sudah disetujui Hilman dan **tidak diubah**. Ide yang menyentuh isi/alur dipisah ke bagian E sebagai saran opsional.

Diuji di viewport 375×812: Sampul → Masuk/Buat paspor → Foto → Onboarding → Peta → Pop-up booth → Paspor → QR.

## A. Bug & masalah alur (perbaiki dulu)

| # | Temuan | Dampak | Perbaikan |
| --- | --- | --- | --- |
| A1 | Kamera tidak tersedia → tidak ada jalan keluar. Tombol "Take photo" tetap aktif, lalu muncul "Could not save the photo". Input file "Choose photo" ada di DOM tapi tidak terlihat/terpakai. | Peserta macet di langkah 1 (HP lama, izin kamera ditolak, in-app browser IG/WA). | Saat kamera gagal: tampilkan tombol jelas "Ambil dengan kamera HP" (`<input type="file" accept="image/*" capture="user">`) + pesan cara mengizinkan kamera. Pastikan unggah dari file benar-benar tersimpan. Di mode mock/dev: tombol "Pakai foto contoh". |
| A2 | Sampul → Masuk: ±1,5–2 s dua halaman bertumpuk di DOM, lalu fade. Tidak ada efek buku terbuka. | Terasa lambat dan "web biasa". | Lihat bagian C (arsitektur Booklet). |
| A3 | Buka rute langsung (/passport, /qr) → layar hitam dengan spinner di tengah ±2 s. | Terasa loading generik. | Jangan spinner layar penuh. Tampilkan kerangka halaman paspor (garis, kotak foto, label) langsung, isi data menyusul; prefetch state saat login; cache state terakhir. |
| A4 | "Use this photo" → spinner di tombol → pindah rute. Tidak ada animasi foto masuk ke paspor. | Momen yang diminta tidak ada. | Lihat C2. |
| A5 | Pop-up booth: cap negara tidak tampil (hanya lingkaran samar di kanan atas). | Elemen paling khas hilang. | Periksa path aset cap (`public/assets/stamps/...`) dan render `<img>` cap dengan ukuran nyata. |
| A6 | Onboarding: pin Jerman biru dan pin 4 oranye, padahal di peta biasa warna = status (belum/dicap/lengkap). | Sistem warna jadi tidak konsisten dan membingungkan. | Pakai satu bahasa visual pin di semua tempat; warna hanya untuk status. |
| A7 | Lampu natal di sampul terlalu besar dan halo cahayanya terpotong lurus (overflow container). | Terlihat seperti clip-art yang terpotong. | Ukuran bohlam ±14–18 px, kabel melengkung melewati tepi layar, glow tidak boleh terpotong (overflow visible atau padding). |

## B. Kenapa terasa "AI design" dan generic

Diagnosis dari layar yang dicek, dicocokkan dengan pola yang umum dikenali sebagai ciri UI buatan AI:

1. **Metafora paspor hilang setelah sampul.** Sampul terlihat seperti paspor, tetapi setelah itu aplikasinya jadi dashboard gelap biasa. Halaman Paspor hanyalah tumpukan kartu yang identik.
2. **"Kartu di mana-mana".** Daftar visa, form, kotak syarat, pop-up: semuanya rounded-rectangle dengan border tipis dan radius yang sama. Hirarki jadi rata.
3. **Semua di tengah dan simetris.** Judul, teks, dan tombol hampir selalu center/full-width dengan jarak seragam, tanpa ritme.
4. **Eyebrow label kapital yang direnggangkan** (STEP 1 · BEFORE THE BOOTHS, PASSPORT QR, FLOOR PLAN) di hampir setiap layar.
5. **Tombol merah bercahaya + glow di banyak tempat.** Gelap + aksen menyala dijadikan default, bukan momen.
6. **Ikon outline generik** (lucide) di nav dan tombol; tombol QR bulat merah melayang adalah pola template.
7. **Dekor ditempel, bukan bagian dari dunia.** Bunga di pinggir, sulur merah berupa garis acak, panel gradasi radial. Terasa seperti stiker di atas template.

## C. Arah perbaikan: paspor sebagai tulang punggung

### C1. Satu "Booklet" yang tidak pernah hilang
- Buat komponen `Booklet` yang tetap ter-mount di atas semua rute peserta. Rute = halaman di dalam buku, bukan layar baru.
- **Sampul → Masuk:** sampul berputar membuka (rotateY dari engsel kiri, perspektif ±1200 px, ±700 ms). Halaman yang terlihat di balik sampul adalah halaman Masuk yang sesungguhnya, sudah interaktif, bukan gambar. Tidak ada fade dan tidak ada halaman bertumpuk.
- **Antar halaman paspor** (Masuk → Foto → halaman identitas → halaman visa): balik halaman (lembar kanan berputar ke kiri dengan bayangan lipatan). Arah mundur membalik ke kanan.
- **Halaman Sign in** tampil di atas kertas paspor: tekstur guilloche, label kecil, nomor halaman, nomor seri "No. FS2-0099". Field dan teks tetap sama (kotak per digit = saran E6).

### C2. Foto langsung masuk ke kotak foto paspor
- Viewfinder kamera berada di **kotak foto halaman identitas paspor** itu sendiri, bukan polaroid terpisah.
- Setelah cekrek: kilat putih singkat, gambar membeku, lalu efek "ditempel" (sedikit miring → lurus, bayangan menipis). Kemudian baris MRZ (`P<FS2<<PESERTA<UJI<<<…`) tercetak per karakter seperti mesin tik. Karena foto sudah di tempatnya, tidak perlu animasi terbang. Elemen yang sama dipakai di header Paspor (`layoutId="attendance-photo"`).

### C3. Halaman Paspor = buku, bukan daftar kartu
- Informasi yang sama seperti sekarang, tetapi ditata sebagai buku: halaman identitas (foto, nama, NRP tersamar, departemen, angkatan, MRZ) + 4 halaman visa yang bisa digeser horizontal seperti membalik halaman.
- Halaman visa kosong: bingkai visa tipis bertuliskan "BELUM DICAP" dengan tinta pudar. Halaman yang sudah dicap: cap PNG asli dengan rotasi acak dan opacity tinta ±0.9.

### C4. Peta & pop-up
- Peta tetap panel seperti sekarang, tetapi dengan garis tinta dan tekstur kertas gelap; hindari gradasi radial polos. (Peta keluar dari kantong belakang = saran E3.)
- Pop-up booth: isi tetap sama, tampilannya seperti **stiker visa** (kertas sudut tajam, cap negara terlihat, foto pemateri dalam TV retro). Pop-up tumbuh dari pin yang ditekan dan kembali ke pin saat ditutup (`layoutId` pin ↔ stiker).
- Pin: satu bentuk (penanda tinta seperti cap kecil), warna hanya untuk status.

### C5. QR & momen cap
- QR: isi sama, tampilan seperti tiket (perforasi, nomor seri, bingkai tinta, tanpa glow kuning). Layar QR tumbuh dari tombol QR dan kembali ke sana.
- Momen cap: stempel benar-benar turun dan menekan kertas visa (lihat MOTION.md #4), lampu progres ikut menyala di header yang sama.
- (QR sebagai lembar izin yang keluar dari paspor, lalu stempel langsung di halaman visa = saran E2.)

### C6. Sistem visual yang lebih sengaja
- **Radius:** 2–4 px untuk kertas/kartu, 6 px untuk input, pill hanya untuk chip. Jangan semua rounded-2xl.
- **Kartu:** kurangi drastis. Kelompokkan dengan tipografi, garis tipis, dan ruang. Tidak ada kartu bersarang.
- **Tipografi:** serif (Libre Baskerville) untuk judul halaman paspor; Poppins hanya untuk UI kecil dan tombol; Courier/mono hanya untuk data paspor (nomor seri, MRZ, NRP). Kurangi eyebrow kapital; pakai paling banyak 1 per layar dan hanya bila bermakna.
- **Warna:** netral diberi rona (krem kertas, hitam kemerahan), bukan hitam pekat. Glow hanya di 2 momen: tagline sampul dan saat cap mendarat.
- **Tombol:** satu tombol utama per layar. Sekunder = teks atau garis. Tidak ada glow di tombol.
- **Tekstur nyata:** noise kertas (SVG feTurbulence ringan), guilloche halus di halaman paspor, jahitan di tengah buku, tepi halaman bertumpuk 2–3 lapis di sisi kanan.
- **Ikon:** gambar sendiri yang konsisten dengan dunia paspor (cap kecil, peta lipat, buku), bukan ikon outline bawaan. Tombol QR minimal tanpa glow merah (tab di tepi buku = saran E4).
- **Gerak:** hanya `transform`/`opacity`; easing deselerasi halus (tanpa bounce, kecuali stempel yang memang membal sekali); satu momen besar per alur.

## E. Saran opsional (menyentuh isi/alur — tanyakan Hilman dulu sebelum dikerjakan)

| # | Saran | Alasan |
| --- | --- | --- |
| E1 | Resume ditulis langsung di halaman visa booth itu (3 baris bergaris di bawah cap), bukan di layar terpisah. | Metafora paspor makin utuh; satu langkah navigasi lebih sedikit. |
| E2 | Layar QR ditampilkan sebagai lembar "entry permit" yang keluar dari paspor; setelah konfirmasi, paspor langsung membuka ke visa booth itu dan stempel turun di sana (menggantikan layar momen cap terpisah). | Transisi paling menyambung untuk momen terpenting. |
| E3 | Peta keluar dari "kantong belakang" paspor (lembar terlipat yang dibuka). | Konsistensi ruang: semua benda berasal dari paspor. |
| E4 | Navigasi bawah diganti tab yang menempel di tepi buku (Map · Permit · Passport), bukan bulatan QR melayang. | Menghilangkan pola template paling kentara. |
| E5 | Nada copy (tetap bahasa Inggris) dibuat sedikit lebih bernuansa "Upside Down immigration": "Stick your photo here.", "Your Korea visa is waiting for its stamp.", "Show this permit to the booth officer." | Karakter tanpa mengubah informasi. |
| E6 | Halaman Sign in dibuat seperti formulir aplikasi paspor (kotak per digit untuk NRP & PIN). | Lebih khas; isi field tetap sama. |

## D. Referensi
- Daftar anti-pattern UI generik (impeccable): https://mintlify.wiki/pbakaus/impeccable/concepts/anti-patterns
- Pola UI AI yang terlalu sering dipakai & perbaikannya: https://noqta.tn/en/blog/ai-design-slop-overused-ui-patterns-fix-2026
- Motion layout/shared element (`layoutId`, `LayoutGroup`, `AnimatePresence`): https://motion.dev/docs/react-layout-animations
- Anthropic, Prompting for frontend aesthetics (tipografi kontras tinggi, komitmen tema, satu momen gerak yang diorkestrasi, latar beratmosfer): https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics
- Rauno Freiberg, Invisible Details of Interaction Design (metafora yang dikenal seperti halaman buku, interruptibility, momentum gestur, konsistensi spasial, jangan animasikan aksi yang sering): https://rauno.me/craft/interaction-design
- Emil Kowalski, Great animations (umumnya <300 ms, ease-out, bisa diinterupsi, transform/opacity, animasikan hanya yang bermakna): https://emilkowal.ski/ui/great-animations
- Superdesign, How to make AI UI look less generic (rencana kreatif dipisah dari implementasi, design system dulu, spesifikasi eksplisit, daftar default yang dilarang): https://www.superdesign.dev/blog/how-to-make-ai-ui-look-less-generic
- Fitur desain paspor asli (guilloche, cetak intaglio, watermark, jahitan aman): https://discover.passportindex.org/security/what-secrets-is-your-passport-hiding/

Aturan lengkap yang diturunkan dari referensi ini ada di `docs/DESIGN.md`.
