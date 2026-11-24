"use client"

import * as React from "react"
import type { SessionUser } from "@/lib/auth/session-user"

type SessionUserContextValue = {
  initialUser: SessionUser | null
}

const SessionUserContext = React.createContext<SessionUserContextValue>({
  initialUser: null,
})

export function SessionUserProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode
  initialUser: SessionUser | null
}) {
  return (
    <SessionUserContext.Provider value={{ initialUser }}>
      {children}
    </SessionUserContext.Provider>
  )
}

export function useSessionUserInitial(): SessionUser | null {
  return React.useContext(SessionUserContext).initialUser
}
