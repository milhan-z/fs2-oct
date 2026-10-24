import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useContent } from '../../app/providers'
import { api } from '../../data/api'
import { ErrorText, Loading, Spinner } from '../../components/ui'

/** Staff entry: one shared staff PIN, then pick the booth to check participants in at. */
export default function StaffHome() {
  const { content } = useContent()
  const nav = useNavigate()
  const [signedIn, setSignedIn] = useState(() => api.staffCanSwitch())
  if (!content) return <Loading />
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-[#111318] px-5 pt-8 pb-8 text-cream">
      <p className="text-[14px] text-muted">FS² · Staff</p>
      {!signedIn ? (
        <StaffPin onDone={() => setSignedIn(true)} />
      ) : (
        <>
          <h1 className="text-[28px] font-extrabold text-white">Which booth are you at?</h1>
          <p className="mt-1 text-[14px] text-muted">You can switch booths any time without signing in again.</p>
          <ul className="mt-5 flex flex-col gap-3">
            {[...content.booths]
              .sort((a, b) => a.sort - b.sort)
              .map((b) => (
                <li key={b.id}>
                  <Link to={`/staff/${b.slug}`} className="flex min-h-14 items-center justify-between rounded-2xl border border-[#2c313c] bg-[#1b1f27] px-4 text-[17px] font-bold">
                    {b.nama}
                    <span className="font-mono text-[13px] text-muted">{b.id}</span>
                  </Link>
                </li>
              ))}
          </ul>
          <button
            type="button"
            className="mt-auto min-h-11 text-[14px] text-muted underline"
            onClick={() => {
              api.staffLogout('')
              setSignedIn(false)
              nav('/staff', { replace: true })
            }}
          >
            Sign out of staff mode
          </button>
        </>
      )}
    </main>
  )
}

function StaffPin({ onDone }: { onDone: () => void }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api.staffLogin('', pin)
      onDone()
    } catch (er) {
      setErr((er as Error).message)
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <h1 className="text-[28px] font-extrabold text-white">Staff sign-in</h1>
      <label htmlFor="staff-all-pin" className="mt-6 text-[15px] font-bold">
        Staff PIN
      </label>
      <input
        id="staff-all-pin"
        className="field mt-2 tracking-[0.5em]"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
      />
      <ErrorText>{err}</ErrorText>
      <p className="mt-2 text-[14px] text-muted">One PIN for all booths — the committee gives it to staff and runners.</p>
      <button type="submit" className="btn mt-auto w-full bg-[#1f7a4a] text-white disabled:bg-[#2a3530] disabled:text-[#7d8a83]" disabled={busy || pin.length < 4}>
        {busy ? <Spinner /> : 'Sign in'}
      </button>
    </form>
  )
}
