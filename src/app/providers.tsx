import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { api } from '../data/api'
import type { Content } from '../data/types'
import { useLive } from './useAsync'

const ContentCtx = createContext<{ content: Content | null; reload: () => void }>({ content: null, reload: () => {} })

const CONTENT_CACHE = 'fs2.cache.content'

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function ContentProvider({ children }: { children: ReactNode }) {
  // last known content renders instantly (no spinner); the fresh copy replaces it
  const { data, reload } = useLive(() => api.getContent(), [], 0, readCache<Content>(CONTENT_CACHE))
  useEffect(() => {
    if (data) localStorage.setItem(CONTENT_CACHE, JSON.stringify(data))
  }, [data])
  return <ContentCtx.Provider value={{ content: data, reload }}>{children}</ContentCtx.Provider>
}

export function useContent() {
  return useContext(ContentCtx)
}
