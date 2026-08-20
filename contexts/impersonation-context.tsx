"use client"

import * as React from "react"
import type { ImpersonationSession } from "@/lib/impersonation/constants"
import { setClientImpersonationSession } from "@/lib/impersonation/client-store"

type ImpersonationContextValue = {
  loading: boolean
  canImpersonate: boolean
  isImpersonating: boolean
  session: ImpersonationSession | null
  refresh: () => Promise<void>
  startImpersonation: (targetUserId: string) => Promise<{ redirectTo?: string; error?: string }>
  stopImpersonation: () => Promise<void>
}

const ImpersonationContext = React.createContext<ImpersonationContextValue | null>(null)

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = React.useState(true)
  const [canImpersonate, setCanImpersonate] = React.useState(false)
  const [session, setSession] = React.useState<ImpersonationSession | null>(null)

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/impersonation", { cache: "no-store" })
      const data = await res.json()
      if (res.ok) {
        setCanImpersonate(Boolean(data.canImpersonate))
        const nextSession = (data.session ?? null) as ImpersonationSession | null
        setSession(nextSession)
        setClientImpersonationSession(nextSession)
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const startImpersonation = React.useCallback(async (targetUserId: string) => {
    const res = await fetch("/api/impersonation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId }),
    })
    const data = await res.json()
    if (!res.ok) {
      return { error: data.error ?? "Erro ao iniciar." }
    }
    setSession(data.session ?? null)
    setClientImpersonationSession(data.session ?? null)
    return { redirectTo: data.redirectTo as string | undefined }
  }, [])

  const stopImpersonation = React.useCallback(async () => {
    await fetch("/api/impersonation", { method: "DELETE" })
    setSession(null)
    setClientImpersonationSession(null)
  }, [])

  const value = React.useMemo(
    () => ({
      loading,
      canImpersonate,
      isImpersonating: Boolean(session),
      session,
      refresh,
      startImpersonation,
      stopImpersonation,
    }),
    [loading, canImpersonate, session, refresh, startImpersonation, stopImpersonation],
  )

  return (
    <ImpersonationContext.Provider value={value}>{children}</ImpersonationContext.Provider>
  )
}

export function useImpersonation(): ImpersonationContextValue {
  const ctx = React.useContext(ImpersonationContext)
  if (!ctx) {
    return {
      loading: false,
      canImpersonate: false,
      isImpersonating: false,
      session: null,
      refresh: async () => {},
      startImpersonation: async () => ({ error: "Contexto indisponível." }),
      stopImpersonation: async () => {},
    }
  }
  return ctx
}
