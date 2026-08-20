import type { ImpersonationSession } from "@/lib/impersonation/constants"

let activeSession: ImpersonationSession | null = null

export function setClientImpersonationSession(session: ImpersonationSession | null) {
  activeSession = session
}

export function getClientImpersonationSession(): ImpersonationSession | null {
  return activeSession
}
