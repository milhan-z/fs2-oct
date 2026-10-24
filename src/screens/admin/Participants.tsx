import { useState } from 'react'
import { api } from '../../data/api'
import { useLive } from '../../app/useAsync'
import { useContent } from '../../app/providers'
import type { AdminParticipantRow } from '../../data/types'

const STATUS: Record<string, string> = { submitted: 'Waiting', revision: 'Needs revision', approved: 'Approved' }

/** A3 — participant search, PIN reset (new PIN shown once), edit identity data, delete. */
export function Participants() {
  const [q, setQ] = useState('')
  const list = useLive(() => api.adminListParticipants(q), [q], 10000)
  const [shown, setShown] = useState<{ nama: string; pin: string } | null>(null)
  const [editing, setEditing] = useState<AdminParticipantRow | null>(null)

  const remove = async (id: string, nama: string, nrp: string) => {
    const typed = prompt(`Delete ${nama} (${nrp}) with all stamps, notes, feedback and submission? This cannot be undone.

Type the NRP to confirm:`)
    if (typed === null) return
    if (typed.trim() !== nrp) return alert('NRP did not match — nothing was deleted.')
    try {
      await api.adminDeleteParticipant(id)
      list.reload()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const reset = async (id: string, nama: string) => {
    if (!confirm(`Reset the PIN of ${nama}? The old PIN stops working.`)) return
    const pin = await api.adminResetPin(id)
    setShown({ nama, pin })
    list.reload()
  }

  return (
    <section className="p-5 md:p-8">
      <h1 className="text-[28px] font-extrabold">Participants</h1>
      <label htmlFor="p-q" className="sr-only">
        Search participants
      </label>
      <input id="p-q" className="field-paper mt-4 max-w-md" placeholder="Search NRP or name" value={q} onChange={(e) => setQ(e.target.value)} />

      {shown && (
        <div className="mt-4 flex max-w-md items-center justify-between rounded-2xl border-2 border-yellow bg-[#fff7e0] p-4" role="alert">
          <div>
            <p className="text-[14px]">New PIN for {shown.nama} (shown once):</p>
            <p className="font-mono text-[34px] font-bold tracking-[0.3em]">{shown.pin}</p>
          </div>
          <button type="button" className="min-h-11 px-3 underline" onClick={() => setShown(null)}>
            Close
          </button>
        </div>
      )}

      {editing && <EditForm row={editing} onDone={(saved) => (setEditing(null), saved && list.reload())} />}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-[#e4ddd0] bg-white">
        <table className="w-full min-w-[820px] text-left text-[14px]">
          <thead className="bg-[#faf8f4] text-[13px] text-[#6b6058]">
            <tr>
              <th className="px-4 py-3">NRP</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Photo</th>
              <th className="px-4 py-3">Stamps</th>
              <th className="px-4 py-3">Submission</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.data?.map((p) => (
              <tr key={p.id} className="border-t border-[#efe9df]">
                <td className="px-4 py-2 font-mono">{p.nrp}</td>
                <td className="px-4 py-2 font-bold">
                  {p.nama}
                  {p.locked && <span className="ml-2 rounded bg-[#fde2e2] px-1.5 py-0.5 text-[11px] text-[#9b2c2c]">locked</span>}
                </td>
                <td className="px-4 py-2">
                  {p.departemen} · {p.angkatan}
                </td>
                <td className="px-4 py-2">{p.hasPhoto ? 'Yes' : '—'}</td>
                <td className="px-4 py-2">{p.visits}/4</td>
                <td className="px-4 py-2">{p.status ? STATUS[p.status] : '—'}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button type="button" className="min-h-10 rounded-lg border border-[#d5cabd] px-3 font-semibold" onClick={() => setEditing(p)}>
                    Edit
                  </button>
                  <button type="button" className="ml-2 min-h-10 rounded-lg border border-[#d5cabd] px-3 font-semibold" onClick={() => reset(p.id, p.nama)}>
                    Reset PIN
                  </button>
                  <button type="button" className="ml-2 min-h-10 rounded-lg border border-[#e7b7b3] px-3 font-semibold text-[#9b2c2c]" onClick={() => remove(p.id, p.nama, p.nrp)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {list.data && !list.data.length && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[#6b6058]">
                  No participants yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function EditForm({ row, onDone }: { row: AdminParticipantRow; onDone: (saved: boolean) => void }) {
  const { content } = useContent()
  const [f, setF] = useState({ nrp: row.nrp, nama: row.nama, departemen: row.departemen, angkatan: row.angkatan })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const deps = content?.departemen ?? []
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api.adminUpdateParticipant(row.id, f)
      onDone(true)
    } catch (x) {
      setErr((x as Error).message)
      setBusy(false)
    }
  }
  const field = (id: keyof typeof f, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`pe-${id}`} className="text-[13px] font-semibold text-[#6b6058]">
        {label}
      </label>
      <input id={`pe-${id}`} className="field-paper mt-1" value={f[id]} onChange={(e) => setF({ ...f, [id]: e.target.value })} {...extra} />
    </div>
  )
  return (
    <form onSubmit={save} className="mt-4 max-w-xl rounded-2xl border-2 border-yellow bg-[#fff7e0] p-4">
      <p className="font-bold">Edit participant</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {field('nrp', 'NRP', { inputMode: 'numeric', pattern: '[0-9]{4,14}', required: true })}
        {field('nama', 'Full name', { required: true })}
        <div>
          <label htmlFor="pe-dep" className="text-[13px] font-semibold text-[#6b6058]">
            Department
          </label>
          <select id="pe-dep" className="field-paper mt-1" value={f.departemen} onChange={(e) => setF({ ...f, departemen: e.target.value })}>
            {!deps.includes(f.departemen) && <option value={f.departemen}>{f.departemen}</option>}
            {deps.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        {field('angkatan', 'Class of', { inputMode: 'numeric' })}
      </div>
      {err && (
        <p className="mt-2 text-[14px] text-[#9b2c2c]" role="alert">
          {err}
        </p>
      )}
      <div className="mt-4 flex gap-3">
        <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-[#b3261e] px-5 font-semibold text-white disabled:opacity-60">
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => onDone(false)} className="min-h-11 px-3 underline">
          Cancel
        </button>
      </div>
    </form>
  )
}
