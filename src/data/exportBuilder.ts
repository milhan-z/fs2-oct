import type { Content, ExportData, SubmissionStatus } from './types'
import { fmtFull, fmtTime } from './time'
import { facultyOf, normalizeDepartment } from './faculties'

/** Raw rows returned by both backends (never contains PIN, hash, token or photo path). */
export interface ExportRaw {
  participants: { id: string; nrp: string; nama: string; departemen: string; angkatan: string; hasPhoto: boolean; createdAt: string }[]
  visits: { participantId: string; boothId: string; confirmedAt: string; cancelledAt: string | null }[]
  resumes: { participantId: string; boothId: string; poin: [string, string, string] }[]
  answers: { participantId: string; questionId: string; nilaiInt: number | null; nilaiTeks: string | null }[]
  submissions: { participantId: string; version: number; status: SubmissionStatus; submittedAt: string }[]
  stamp4it: string[]
}

const STATUS_LABEL: Record<SubmissionStatus, string> = { submitted: 'Waiting', revision: 'Needs revision', approved: 'Approved' }

/** The form's batch options are "2021 or earlier", 2022 … 2025. */
const batchOf = (angkatan: string) => (/^\d{4}$/.test(angkatan) && +angkatan <= 2021 ? '2021 or earlier' : angkatan)

/**
 * Export in the layout of the committee's Google Form result sheet (tab "Responses"): Timestamp, Full Name,
 * Student ID Number (NRP), Degree, Batch, Department, Faculty, then one column per feedback question in form order.
 * Degree is not collected by the passport, so that column stays empty. Notes, visits and registrations follow in
 * their own tabs.
 */
export function buildExport(raw: ExportRaw, content: Content): ExportData {
  const booths = [...content.booths].sort((a, b) => a.sort - b.sort)
  const qs = [...content.questions].sort((a, b) => a.sort - b.sort)
  const people = new Map(raw.participants.map((p) => [p.id, p]))
  const active = raw.visits.filter((v) => !v.cancelledAt)
  const given = new Set(raw.stamp4it)
  const submissions = [...raw.submissions].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))

  const respons: (string | number)[][] = [['Timestamp', 'Full Name', 'Student ID Number (NRP)', 'Degree', 'Batch', 'Department', 'Faculty', ...qs.map((q) => q.teks)]]
  const catatan: (string | number)[][] = [['Timestamp', 'NRP', 'Full Name', 'Status', 'Version', ...booths.flatMap((b) => [`${b.nama} stamped`, `${b.nama} note 1`, `${b.nama} note 2`, `${b.nama} note 3`]), 'Stamp4It']]
  for (const s of submissions) {
    const p = people.get(s.participantId)
    if (!p) continue
    const dep = normalizeDepartment(p.departemen)
    respons.push([
      fmtFull(s.submittedAt),
      p.nama,
      p.nrp,
      '',
      batchOf(p.angkatan),
      dep,
      facultyOf(dep),
      ...qs.map((q) => {
        const a = raw.answers.find((x) => x.participantId === p.id && x.questionId === q.id)
        return a?.nilaiInt ?? a?.nilaiTeks ?? ''
      }),
    ])
    const row: (string | number)[] = [fmtFull(s.submittedAt), p.nrp, p.nama, STATUS_LABEL[s.status], s.version]
    for (const b of booths) {
      const v = active.find((x) => x.participantId === p.id && x.boothId === b.id)
      const r = raw.resumes.find((x) => x.participantId === p.id && x.boothId === b.id)
      row.push(v ? fmtTime(v.confirmedAt) : '', r?.poin[0] ?? '', r?.poin[1] ?? '', r?.poin[2] ?? '')
    }
    row.push(given.has(p.id) ? 'Given' : 'Not yet')
    catatan.push(row)
  }

  const kunjungan: (string | number)[][] = [['Confirmed at', 'NRP', 'Full Name', 'Booth', 'Confirmed by', 'Cancelled at']]
  for (const v of [...raw.visits].sort((a, b) => a.confirmedAt.localeCompare(b.confirmedAt))) {
    const p = people.get(v.participantId)
    const b = content.booths.find((x) => x.id === v.boothId)
    kunjungan.push([fmtFull(v.confirmedAt), p?.nrp ?? '', p?.nama ?? '', b ? `${b.id} ${b.nama}` : v.boothId, `Staff ${v.boothId}`, fmtFull(v.cancelledAt)])
  }

  const peserta: (string | number)[][] = [['Registered', 'NRP', 'Full Name', 'Department', 'Faculty', 'Batch', 'Attendance photo', 'Booths stamped', 'Submission']]
  for (const p of raw.participants) {
    const s = raw.submissions.find((x) => x.participantId === p.id)
    const dep = normalizeDepartment(p.departemen)
    peserta.push([fmtFull(p.createdAt), p.nrp, p.nama, dep, facultyOf(dep), batchOf(p.angkatan), p.hasPhoto ? 'Yes' : 'No', active.filter((v) => v.participantId === p.id).length, s ? STATUS_LABEL[s.status] : 'Not submitted'])
  }
  return { respons, catatan, kunjungan, peserta }
}
