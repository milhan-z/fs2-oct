import type { ExportData } from '../../data/types'

function stamp(): string {
  const d = new Date(Date.now() + 7 * 3600_000).toISOString()
  return `${d.slice(0, 10)}_${d.slice(11, 16).replace(':', '')}`
}

export async function exportXlsx(data: ExportData) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of [
    ['Responses', data.respons],
    ['Booth notes', data.catatan],
    ['Visits', data.kunjungan],
    ['Participants', data.peserta],
  ] as const) {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = rows[0].map((_, c) => ({ wch: Math.min(48, Math.max(10, ...rows.slice(0, 50).map((r) => String(r[c] ?? '').length))) }))
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  XLSX.writeFile(wb, `FS2_responses_${stamp()}.xlsx`)
}

export async function exportCsv(data: ExportData) {
  const XLSX = await import('xlsx')
  const csv = XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(data.respons))
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `FS2_responses_${stamp()}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
