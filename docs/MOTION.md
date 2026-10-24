# Gerak & animasi — FS² Digital Passport

Prinsip: **setiap perpindahan terasa menyambung**. Elemen yang sama berpindah tempat (shared element / `layoutId` di Motion), bukan layar yang tiba-tiba berganti. Satu library: **Motion (Framer Motion)**. Semua animasi mati/diganti fade sederhana bila `prefers-reduced-motion: reduce`. Animasi panjang selalu bisa dilewati (tap / tombol "Lewati"). Target 60 fps di HP menengah: animasikan `transform` & `opacity` saja, hindari animasi `filter: blur` besar.

Kurva standar: `ease: [0.22, 1, 0.36, 1]` (keluar halus). Pegas untuk benda fisik (stempel, pin): `type: "spring", stiffness: 500, damping: 28`.

| # | Momen | Urutan | Durasi |
| --- | --- | --- | --- |
| 1 | **Sampul dibuka** | Lampu natal di atas menyala satu per satu dengan kedip tak beraturan (ala Joyce Byers); tagline merah "menyala" (flicker 2× lalu stabil). Tap "Buka Paspor": sampul paspor berputar membuka seperti buku (rotateY dari engsel kiri, perspektif 1200px) lalu masuk ke halaman Masuk. | 1,5 s + 0,6 s |
| 2 | **Onboarding denah** (sekali setelah foto pertama; bisa diputar ulang dari Panduan) | a) layar gelap, lampu menyala; b) siluet gedung Global Kampong naik dari bawah dengan kabut merah tipis; c) denah seluruh gedung tergambar garis demi garis (`stroke-dashoffset`), label ruang muncul (WCU, Mobility, Partnership); d) kamera zoom halus ke Lounge (scale + translate pada grup SVG), area Lounge disorot kuning, sulur merah tumbuh di tepinya; e) 4 pin booth jatuh berurutan (spring, jeda 120 ms) dengan bayangan; f) kartu "Semua booth ada di Lounge · masuk lewat Front Office" + tombol Mulai. | ±6 s, Lewati di pojok |
| 3 | **Foto kehadiran** | Cekrek: kilat putih 80 ms + bunyi rana (opsional). Foto "keluar" sebagai polaroid dari bawah, berayun sedikit (rotate −6°→−2°). Tap "Pakai foto ini": polaroid terbang dan mengecil ke kotak foto di header Paspor/Peta (shared element `layoutId="attendance-photo"`), lalu onboarding #2 dimulai. | ±1,2 s |
| 4 | **Cap booth** (saat konfirmasi petugas terdeteksi) | Layar meredup; kertas visa krem naik ke tengah; stempel negara (PNG cap) turun dari atas dalam skala 1,6 dan sedikit buram → menekan kertas (scale 1, rotate −9°) dengan sedikit membal; efek tinta: opacity 0→1 dengan mask noise; kertas bergetar 2× (x ±3px); lampu natal berikutnya menyala + glow; getar HP 80 ms (`navigator.vibrate`, Android). Lalu tombol muncul. | ±1 s |
| 5 | **Pin → pop-up booth** | Pin membesar 1,15× dan memantul; bottom sheet naik dari bawah (spring); foto pemateri muncul di TV retro dengan efek "TV menyala" (garis putih horizontal melebar → gambar). Tutup: geser ke bawah / tap luar. | 300–450 ms |
| 6 | **Lounge ↔ Seluruh gedung** | Satu SVG yang sama; zoom/pan halus antar dua viewBox (animasikan transform grup), bukan ganti gambar. Ikon fasilitas fade in di mode seluruh gedung. | 400 ms |
| 7 | **Lampu progres** | Saat jumlah cap bertambah, lampu baru menyala dengan flicker 3× lalu stabil. Saat 4/4: semua lampu berkedip serempak sekali + konfeti kecil bunga Demogorgon (opsional, ringan). | 600 ms |
| 8 | **Resume tersimpan** | Ikon awan berubah jadi centang dengan morph kecil; kolom poin yang memenuhi syarat diberi garis hijau. | 200 ms |
| 9 | **Kirim pengajuan** | 4 kartu resume menumpuk jadi satu amplop krem, amplop tertutup, stempel "TERKIRIM" merah menimpa. | ±1,5 s |
| 10 | **Scanner petugas** | Tiap QR terbaca: bingkai kamera berkedip hijau, entri baru meluncur masuk ke atas antrean; duplikat bergetar kuning. Konfirmasi semua: entri tersapu ke kanan satu per satu (stagger 40 ms) + toast jumlah. | 200 ms / entri |
| 11 | **Pindah layar umum** | Geser horizontal 24px + fade; header & nav bawah tetap diam (di luar AnimatePresence). | 250 ms |

Suara (opsional, default mati, tombol speaker di Panduan): rana kamera, "thunk" stempel, dengung lampu.
