import type { Content, ExportData, SubmissionStatus } from './types'
import { fmtFull, fmtTime } from './time'

/** Raw rows returned by both backends (never contains PIN, hash, token or photo path). */
export interface ExportRaw {
  participants: { id: string; nrp: string; nama: string; departemen: string; angkatan: string; hasPhoto: boolean; createdAt: string }[]
  visits: { participantId: string; boothId: string; confirmedAt: string; cancelledAt: string | null }[]
  resumes: { participantId: string; boothId: string; poin: [string, string, string] }[]
  answers: { participantId: string; questionId: string; nilaiInt: number | null; nilaiTeks: string | null }[]
  submissions: { participantId: string; version: number; status: SubmissionStatus; submittedAt: string }[]
  stamp4it: string[]
}

const STATUS_LABEL: Record<SubmissionStatus, string> = { submitted: 'Menunggu', revision: 'Perlu revisi', approved: 'Disetujui' }

/** SPEC §7 — "Google Form result" layout: Respons, Kunjungan, Peserta. */
export function buildExport(raw: ExportRaw, content: Content): ExportData {
  const booths = [...content.booths].sort((a, b) => a.sort - b.sort)
  const qs = [...content.questions].sort((a, b) => a.sort - b.sort)
  const people = new Map(raw.participants.map((p) => [p.id, p]))
  const active = raw.visits.filter((v) => !v.cancelledAt)
  const given = new Set(raw.stamp4it)

  const header: string[] = ['Waktu kirim', 'NRP', 'Nama', 'Departemen', 'Angkatan', 'Status', 'Versi']
  for (const b of booths) header.push(`${b.id} jam cap`, `${b.id} poin 1`, `${b.id} poin 2`, `${b.id} poin 3`)
  let fb = 0
  for (const q of qs) header.push(q.tipe === 'teks' ? 'Saran' : `Feedback ${++fb}`)
  header.push('Stamp4It')

  const respons: (string | number)[][] = [header]
  for (const s of [...raw.submissions].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))) {
    const p = people.get(s.participantId)
    if (!p) continue
    const row: (string | number)[] = [fmtFull(s.submittedAt), p.nrp, p.nama, p.departemen, p.angkatan, STATUS_LABEL[s.status], s.version]
    for (const b of booths) {
      const v = active.find((x) => x.participantId === p.id && x.boothId === b.id)
      const r = raw.resumes.find((x) => x.participantId === p.id && x.boothId === b.id)
      row.push(v ? fmtTime(v.confirmedAt) : '', r?.poin[0] ?? '', r?.poin[1] ?? '', r?.poin[2] ?? '')
    }
    for (const q of qs) {
      const a = raw.answers.find((x) => x.participantId === p.id && x.questionId === q.id)
      row.push(a?.nilaiInt ?? a?.nilaiTeks ?? '')
    }
    row.push(given.has(p.id) ? 'Diberikan' : 'Belum')
    respons.push(row)
  }

  const kunjungan: (string | number)[][] = [['Waktu konfirmasi', 'NRP', 'Nama', 'Booth', 'Dikonfirmasi oleh', 'Dibatalkan']]
  for (const v of [...raw.visits].sort((a, b) => a.confirmedAt.localeCompare(b.confirmedAt))) {
    const p = people.get(v.participantId)
    const b = content.booths.find((x) => x.id === v.boothId)
    kunjungan.push([fmtFull(v.confirmedAt), p?.nrp ?? '', p?.nama ?? '', b ? `${b.id} ${b.nama}` : v.boothId, `Petugas ${v.boothId}`, fmtFull(v.cancelledAt)])
  }

  const peserta: (string | number)[][] = [['Terdaftar', 'NRP', 'Nama', 'Departemen', 'Angkatan', 'Foto kehadiran', 'Booth dicap', 'Status pengajuan']]
  for (const p of raw.participants) {
    const s = raw.submissions.find((x) => x.participantId === p.id)
    peserta.push([fmtFull(p.createdAt), p.nrp, p.nama, p.departemen, p.angkatan, p.hasPhoto ? 'Ada' : 'Belum', active.filter((v) => v.participantId === p.id).length, s ? STATUS_LABEL[s.status] : 'Belum kirim'])
  }
  return { respons, kunjungan, peserta }
}
