import { createContext, useContext, type ReactNode } from 'react'
import { api } from '../data/api'
import type { Content } from '../data/types'
import { useLive } from './useAsync'

const ContentCtx = createContext<{ content: Content | null; reload: () => void }>({ content: null, reload: () => {} })

export function ContentProvider({ children }: { children: ReactNode }) {
  const { data, reload } = useLive(() => api.getContent(), [])
  return <ContentCtx.Provider value={{ content: data, reload }}>{children}</ContentCtx.Provider>
}

export function useContent() {
  return useContext(ContentCtx)
}
