# Persiapan sebelum menjalankan Claude Code

1. **Ekstrak paket ini** ke `D:\SAFAHIL\HILMAN\data edit hilman\Organisasi Event\IGE\FS2 - Oct\Web` sehingga isinya langsung: `CLAUDE.md`, `PROMPT.md`, `docs/`, `data/`, `assets/`, `reference/`.
2. **Node.js 20+** dan **Git** terpasang. (Opsional) `npm i -g vercel` lalu `vercel login`.
3. **Supabase** (boleh setelah demo ke PIC): buat project baru di akunmu, region Singapore. Siapkan Project URL, anon key, service role key, dan password database untuk `.env`. Jangan pernah membagikan service role key ke siapa pun / jangan di-commit.
4. **Opsional tapi membantu:** hubungkan Figma MCP (untuk mengekspor aset GSM dari file FS2) dan Supabase MCP di Claude Code.
5. Buka terminal di folder `Web`, jalankan `claude`, lalu tempel isi blok prompt di `PROMPT.md`.
6. Yang masih placeholder dan bisa diubah dari panel admin setelah jadi: posisi 4 titik booth, booth ke-4, foto & cerita pemateri, titik toilet/musala, teks pertanyaan feedback, cap booth ke-4.
