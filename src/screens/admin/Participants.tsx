import { useState } from 'react'
import { api } from '../../data/api'
import { useLive } from '../../app/useAsync'

const STATUS: Record<string, string> = { submitted: 'Waiting', revision: 'Needs revision', approved: 'Approved' }

/** A3 — participant search + PIN reset (new PIN shown once). */
export function Participants() {
  const [q, setQ] = useState('')
  const list = useLive(() => api.adminListParticipants(q), [q], 10000)
  const [shown, setShown] = useState<{ nama: string; pin: string } | null>(null)

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

      <div className="mt-4 overflow-x-auto rounded-2xl border border-[#e4ddd0] bg-white">
        <table className="w-full min-w-[680px] text-left text-[14px]">
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
                <td className="px-4 py-2 text-right">
                  <button type="button" className="min-h-10 rounded-lg border border-[#d5cabd] px-3 font-semibold" onClick={() => reset(p.id, p.nama)}>
                    Reset PIN
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
