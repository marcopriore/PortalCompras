import type { Metadata } from "next"
import { SolicitanteImpersonationShell } from "@/components/solicitante/solicitante-impersonation-shell"

export const metadata: Metadata = {
  title: "Portal do Solicitante — Valore",
}

export default function SolicitanteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <SolicitanteImpersonationShell>{children}</SolicitanteImpersonationShell>
    </div>
  )
}
