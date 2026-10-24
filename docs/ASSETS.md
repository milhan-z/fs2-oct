# Aset

## Sudah disertakan di paket ini
| File | Isi | Pakai |
| --- | --- | --- |
| `assets/stamps/stamp-korea.png` | Cap Korea (pagoda) — sementara dari Hilman | Booth B1 |
| `assets/stamps/stamp-taiwan.png` | Cap Taiwan (Taipei 101) | Booth B2 |
| `assets/stamps/stamp-jerman.png` | Cap Jerman (Wismar) | Booth B3 |
| `assets/map/global-kampong-walls.svg` | Garis tembok denah Global Kampong (dari Figma) | Peta; restyle warnanya (krem di panel merah tua) |
| `reference/mockups/*.html` | Mockup statis tiap layar (buka di browser) | Acuan layout & gaya |
| `reference/screenshots/*.png` | Screenshot mockup | Acuan cepat |

Cap PNG berukuran 1254 px, latar transparan. Kompres ke WebP ~400 px untuk web (simpan juga versi besar untuk momen cap). Booth 4 belum punya cap → pakai cap generik "FS² October Edition" (buat SVG sederhana bergaya sama) sampai file asli datang.

## Ambil dari Figma (via Figma MCP)
File: `https://www.figma.com/design/r6zQ0qCcaCVqgp9SZ2daRU/FS2` — section **"FS2 Oct 26"** (node `1621:240`). Ekspor sebagai **SVG** (atau PNG @2x bila berisi gambar raster) ke `public/assets/gsm/`.

| Aset | Node | Pakai |
| --- | --- | --- |
| Logo October Edition (badge FS²) | `1672:616` | Header, onboarding (berisi gambar → PNG @2x) |
| Bunga Demogorgon | `1686:361` | Dekor sudut panel, peta, sampul |
| Jam kakek | `1644:1113` | Panduan / layar menunggu |
| Pohon pinus | `1637:845` | Siluet onboarding |
| Asap (2 varian) | `1648:1704`, `1648:1719` | Transisi onboarding |
| Bekas cakaran | `1648:1718` | Dekor latar |
| Lampu natal (kabel + bohlam) | `1660:244` dan grup bohlam di sekitarnya | Bisa juga digambar ulang sebagai SVG/CSS agar bisa dianimasikan per bohlam |
| Skyline destinasi | `1770:3912` | Dasar layar status |
| Denah lengkap + label (acuan) | `1825:883` | Acuan posisi ruang |
| Komposisi acuan | Coming Soon Feed Slide 1 (`1746:883`), Slide 2 (`1744:883`), Opreg Feed Slide 5 (`1830:883`) | Gaya warna, TV retro, panel bundar merah, lampu |
| Strip logo resmi (ITS + Global Engagement / Kemitraan Global) | ambil dari header slide di atas | Sampul / Panduan |

Bila Figma MCP tidak tersedia: gambar ulang dekor sederhana sebagai SVG inline (lampu, bunga, TV retro) mengikuti screenshot, dan minta Hilman mengekspor logo resmi secara manual.

Foto pemateri: belum ada → placeholder siluet di dalam TV retro. Admin bisa unggah foto nanti.
