"use client"

import { ImpersonationProvider } from "@/contexts/impersonation-context"
import { ImpersonationBanner } from "@/components/impersonation/impersonation-banner"

export function SolicitanteImpersonationShell({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ImpersonationProvider>
      <ImpersonationBanner />
      {children}
    </ImpersonationProvider>
  )
}
