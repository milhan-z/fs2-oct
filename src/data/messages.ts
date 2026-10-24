// The database returns Indonesian messages (stable error contract); the UI is English.
const EN: Record<string, string> = {
  'Batas kirim sudah lewat.': 'The submission deadline has passed.',
  'Belum semua booth dicap.': 'Not all booths are stamped yet.',
  'Booth ini belum dicap.': 'This booth has not been stamped yet.',
  'Booth tidak ditemukan.': 'Booth not found.',
  'Catatan wajib diisi saat mengembalikan.': 'A note is required when returning a submission.',
  'Feedback wajib belum diisi.': 'Required feedback is missing.',
  'Kata sandi salah.': 'Wrong password.',
  'Kunjungan tidak ditemukan.': 'Visit not found.',
  'NRP belum terdaftar.': 'This NRP is not registered yet.',
  'NRP sudah punya paspor. Masuk dengan PIN.': 'This NRP already has a passport. Sign in with your PIN.',
  'NRP tidak valid.': 'Invalid NRP.',
  'PIN booth salah.': 'Wrong booth PIN.',
  'PIN harus 4 angka.': 'PIN must be 4 digits.',
  'PIN salah.': 'Wrong PIN.',
  'Pengajuan sudah dikirim — isi terkunci.': 'Your submission has been sent — editing is locked.',
  'Pengajuan sudah dikirim.': 'Your submission has already been sent.',
  'Pengajuan tidak ditemukan.': 'Submission not found.',
  'Peserta tidak ditemukan.': 'Participant not found.',
  'Resume belum lengkap.': 'Booth notes are not complete yet.',
  'Sesi admin berakhir.': 'Admin session expired.',
  'Sesi berakhir. Masuk lagi dengan NRP + PIN.': 'Session expired. Sign in again with your NRP + PIN.',
  'Sesi booth belum/tidak dibuka.': 'The booth session is not open.',
  'Sesi petugas berakhir. Masukkan PIN booth lagi.': 'Officer session expired. Enter the booth PIN again.',
  'Isi nama lengkap.': 'Enter your full name.',
  'Pilih departemen.': 'Choose your department.',
  'Path foto tidak valid.': 'Invalid photo path.',
  'Foto tidak bisa diganti setelah pengajuan dikirim.': 'The photo cannot be changed after submitting.',
  'Aksi tidak dikenal.': 'Unknown action.',
}

export function toEnglish(msg: string): string {
  const locked = msg.match(/^Terlalu banyak percobaan\. Coba lagi (\d+) menit lagi\.$/)
  if (locked) return `Too many attempts. Try again in ${locked[1]} minute${locked[1] === '1' ? '' : 's'}.`
  return EN[msg] ?? msg
}
