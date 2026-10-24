import seed from '../../data/seed.json'
import { DEPARTMENTS } from './faculties'
import type { Booth, Content, Facility, Question, RoomLabel, Speaker } from './types'

// ITS departments as spelled in the committee's feedback form (see faculties.ts). "Other" lets users type their own.
export const DEPARTEMEN_ITS = [...DEPARTMENTS].sort((a, b) => a.localeCompare(b, 'en'))

function stampUrl(path: string | null): string | null {
  if (!path) return null
  const name = path.split('/').pop()!.replace(/\.png$/, '')
  return `/assets/stamps/${name}.webp`
}

export function seedContent(): Omit<Content, 'departemen'> {
  const booths: Booth[] = seed.booths.map((b, i) => ({
    id: b.id,
    slug: b.slug,
    nama: b.nama,
    region: b.region,
    stamp: stampUrl(b.stamp),
    x: b.titik.x,
    y: b.titik.y,
    placeholderPos: b.placeholder_posisi,
    sort: i + 1,
  }))
  const speakers: Speaker[] = seed.booths.flatMap((b) =>
    b.pemateri.map((p, j) => ({
      id: `${b.id}-s${j + 1}`,
      boothId: b.id,
      nama: p.nama,
      universitas: p.universitas,
      program: p.program,
      foto: p.foto,
      cerita: p.cerita,
      placeholder: p.placeholder,
    })),
  )
  const facilities: Facility[] = seed.fasilitas.map((f, i) => ({
    id: `F${i + 1}`,
    jenis: f.jenis,
    label: f.label,
    x: f.titik?.x ?? null,
    y: f.titik?.y ?? null,
    placeholder: f.placeholder,
    catatan: f.catatan,
  }))
  const questions: Question[] = seed.feedback.map((q, i) => ({
    id: q.id,
    teks: q.teks,
    tipe: q.tipe as Question['tipe'],
    wajib: q.wajib,
    sort: i + 1,
    section: (q as { section?: string }).section ?? null,
    labelLow: (q as { labelLow?: string }).labelLow ?? null,
    labelHigh: (q as { labelHigh?: string }).labelHigh ?? null,
  }))
  return {
    event: {
      nama: seed.event.nama,
      tagline: seed.event.tagline,
      tanggal: seed.event.tanggal,
      jam_acara: seed.event.jam_acara,
      tempat: seed.event.tempat,
      kontak_bantuan: seed.event.kontak_bantuan,
      rundown: seed.event.rundown,
    },
    booths,
    speakers,
    facilities,
    questions,
    rooms: seed.ruang_label as RoomLabel[],
    settings: {
      simulationMode: false,
      sessionStart: seed.event.sesi_booth.mulai,
      sessionEnd: seed.event.sesi_booth.selesai,
      deadline: seed.event.batas_kirim,
    },
    rules: seed.aturan,
  }
}
