import { useCallback, useEffect, useRef, useState } from 'react'

/** Loads data with `fn`, re-runs on mock-db changes and optionally on an interval. */
export function useLive<T>(fn: () => Promise<T>, deps: unknown[], intervalMs = 0, initial: T | null = null) {
  const [data, setData] = useState<T | null>(initial)
  const [error, setError] = useState<Error | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const reload = useCallback(async () => {
    try {
      setData(await fnRef.current())
      setError(null)
    } catch (e) {
      setError(e as Error)
    }
  }, [])

  useEffect(() => {
    reload()
    const on = () => reload()
    window.addEventListener('fs2-mock-change', on)
    window.addEventListener('fs2-time-change', on)
    const t = intervalMs ? window.setInterval(reload, intervalMs) : 0
    return () => {
      window.removeEventListener('fs2-mock-change', on)
      window.removeEventListener('fs2-time-change', on)
      if (t) clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, intervalMs, ...deps])

  return { data, error, reload, setData }
}
