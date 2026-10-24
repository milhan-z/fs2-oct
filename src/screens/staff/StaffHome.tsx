import { Link } from 'react-router'
import { useContent } from '../../app/providers'
import { Loading } from '../../components/ui'

/** Booth picker for officers — each booth phone normally opens /staff/<slug> directly. */
export default function StaffHome() {
  const { content } = useContent()
  if (!content) return <Loading />
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-[#111318] px-5 pt-8 pb-8 text-cream">
      <p className="text-[14px] text-muted">FS² · Booth officers</p>
      <h1 className="text-[28px] font-extrabold text-white">Choose your booth</h1>
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
    </main>
  )
}
