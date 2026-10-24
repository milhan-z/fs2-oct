# DESIGN.md — FS² Digital Passport

Dokumen ini adalah kontrak visual. Setiap layar dibuat dan dicek terhadap file ini. Kalau ada yang tidak tercakup, pilih yang paling sesuai "art direction" di bawah, lalu tambahkan aturannya ke sini.

## 1. Art direction (satu kalimat)
**"Paspor resmi yang diterbitkan oleh Upside Down."** Sebuah benda cetak tahun 80-an yang dipegang di tangan: sampul kain navy dengan emboss emas, halaman kertas krem bercetak guilloche, cap tinta merah, tiket izin berperforasi. Malam Hawkins di sekelilingnya: lampu natal, cahaya merah dari celah. Semua UI harus terasa seperti **bagian dari benda itu**, bukan aplikasi yang ditempeli dekor.

Pertanyaan uji untuk setiap elemen: *"Kalau paspor ini benda nyata, elemen ini dicetak, ditempel, dicap, diselipkan, atau dilipat?"* Kalau jawabannya "tidak satupun" (misalnya kartu ber-border bulat dengan glow), elemen itu salah.

## 2. Dua material, bukan satu tema gelap
| Material | Dipakai untuk | Ciri |
| --- | --- | --- |
| **Malam** (latar dunia) | Di luar buku: latar belakang, overlay saat momen besar | #120A0B → #1C0D0F, noise halus, satu sumber cahaya merah dari bawah/celah. Bukan hitam pekat. |
| **Kertas paspor** | Semua halaman tempat peserta membaca/menulis: Masuk, identitas, visa, resume, feedback, status | Krem #F3EBDD dengan pola guilloche tipis (opacity 6–8%), noise kertas, tepi halaman bertumpuk 2–3 lapis di sisi kanan, jahitan di tengah saat spread. Teks tinta #2A1E1A (bukan hitam). |
| **Sampul** | Sampul, punggung buku, tab/strap navigasi | Navy kain #12304A dengan tekstur linen, emboss emas #C9A45C (inner shadow 1px, bukan glow) |
| **Tinta cap** | Cap negara, status, nomor | Merah #B3261E dengan opacity 0.85–0.92, rotasi acak −12°…+8°, tepi sedikit kasar (mask noise) |
| **Tiket izin** | QR | Kertas putih-kekuningan #FBF7EE, perforasi bulat di satu sisi, nomor seri mono |

Dekor (lampu natal, bunga Demogorgon, sulur, asap, jam kakek) hanya hidup di material **Malam**, tidak pernah di atas kertas. Maksimal 2 jenis dekor per layar.

## 3. Tipografi
- **Judul halaman paspor:** Libre Baskerville Bold 26–32 px, rata kiri. Kontras ukuran tegas: judul ≥ 2,2× teks isi.
- **Label field paspor:** gaya dokumen resmi, Poppins 10–11 px, uppercase hanya di sini (teks label tetap seperti sekarang).
- **Data paspor** (NRP tersamar, nomor seri, MRZ, tanggal cap): Courier Prime. Mono **hanya** untuk data dokumen.
- **Teks UI & tombol:** Poppins 15–16 px (400/600). Jangan pakai Poppins 800 untuk semua judul.
- **Anton:** hanya untuk teks di dalam cap/tiket (mis. "ADMITTED", kode booth). Tidak untuk eyebrow.
- Eyebrow kapital renggang: maksimal 1 per layar, dan hanya bila itu memang "cetakan" di dokumen (mis. "REPUBLIK UPSIDE DOWN · PASPOR").
- Teks isi rata kiri. Rata tengah hanya untuk elemen yang memang simetris di dokumen asli (judul sampul, cap).

## 4. Bentuk, ruang, kedalaman
- **Radius:** kertas & halaman 3 px; input 4 px; tombol 6 px; pill hanya untuk chip status kecil. Dilarang `rounded-2xl` / `rounded-3xl` di mana pun.
- **Kartu:** default tidak ada. Kelompokkan isi dengan garis cetak tipis (1 px, tinta 15%), ruang, dan judul kecil, seperti formulir kertas. Tidak ada kartu bersarang.
- **Ritme ruang:** skala 4/8/12/20/32/48. Jarak antar-kelompok harus terasa beda dari jarak di dalam kelompok (minimal 2×).
- **Bayangan:** hanya untuk benda fisik yang terangkat (buku, tiket, stiker visa): bayangan lembut berarah dari satu sumber cahaya (kiri atas), plus contact shadow tipis. Tidak ada drop shadow generik pada kotak UI.
- **Glow:** hanya 2 tempat, yaitu tagline sampul dan kilat saat cap mendarat. Tombol tidak bercahaya.

## 5. Komponen kunci
- **Formulir paspor (Sign in/Create passport)** — tampilan saja; kotak per digit hanya bila saran E6 disetujui: kotak per digit untuk NRP (10 kotak) dan PIN (4 kotak) seperti formulir cetak; garis isian bertitik untuk nama; dropdown departemen bergaya baris formulir. Nomor halaman "02" di pojok bawah, nomor seri di pojok atas.
- **Halaman identitas:** kotak foto (rasio paspor 3:4) dengan sudut berlubang/klip, ghost image kecil foto di sisi kanan (opacity 20%), data dua kolom, MRZ 2 baris di bawah (`P<FS2<<NAMA<<…` dan nomor), garis guilloche melintasi foto.
- **Halaman visa:** header kecil "VISA · SOUTH KOREA · No. 01", bingkai visa tipis, cap PNG di posisi agak acak. (Menulis resume langsung di halaman ini = saran E1, opsional.)
- **Stiker visa (pop-up booth):** persegi panjang kertas dengan sudut tajam dan pola latar negara, ditempel miring sedikit; foto pemateri di TV retro kecil; tombol aksi di bawah stiker, di material Malam.
- **QR (tampilan):** kertas tiket dengan perforasi; (lembar yang keluar dari paspor = saran E2, opsional): perforasi, QR di kotak bertepi tinta, nama & NRP tersamar mono, status satu baris.
- **Navigasi peserta:** minimal hilangkan glow & bayangan generik pada tombol QR, samakan dengan material sampul. Mengganti dengan tab di tepi buku = saran E4, opsional.
- **Pin peta:** satu bentuk, yaitu cap tinta bulat kecil bernomor/berinisial negara. Belum = garis tinta; dicap = tinta merah penuh; resume lengkap = tinta merah + centang. Tanpa hijau/biru/oranye acak.
- **Loading:** tidak ada spinner layar penuh. Pakai kerangka halaman (garis formulir & kotak foto tampil, teks muncul belakangan) atau tinta yang "meresap" pelan.

## 6. Gerak (aturan)
- Satu **ruang spasial** yang konsisten: buku di tengah; layar yang dibuka dari suatu elemen tumbuh dari elemen itu dan kembali ke sana saat ditutup (pop-up booth dari pin-nya, QR dari tombolnya, foto ke kotak foto). Peta dari kantong belakang / tiket QR dari atas paspor = saran E2/E3.
- Transisi antar-halaman paspor = **balik halaman** (rotateY pada lembar, dengan bayangan lipatan), arah sesuai navigasi, **bisa diinterupsi** dan bisa digeser jari (velocity diteruskan).
- Durasi: interaksi UI 150–250 ms (ease-out `cubic-bezier(0.22,1,0.36,1)`); balik halaman 450–600 ms; momen besar (sampul membuka, cap, onboarding) boleh lebih panjang tapi bisa dilewati.
- Spring hanya untuk benda fisik (stempel turun, tiket meluncur); tidak ada bounce di tombol/teks.
- Jangan animasikan hal yang sering dilakukan (ketik, toggle, tab yang sama). Animasi untuk momen yang jarang & bermakna.
- Hanya `transform` dan `opacity`; 60 fps di HP menengah; `prefers-reduced-motion` → ganti dengan crossfade 120 ms.
- Umpan balik langsung: saat jari menekan tombol/tab, ada respon dalam <100 ms (scale 0.98 atau tinta menggelap).

## 7. Bahasa
UI berbahasa **Inggris** (acara ITS GE) — sudah final. Isi teks tidak diubah di putaran ini. Penyesuaian nada copy hanya bila Hilman menyetujui saran E5 di EVALUASI-UI.md.
