import type { Metadata } from "next"
import { Suspense } from "react"
import { SolicitanteImpersonationShell } from "@/components/solicitante/solicitante-impersonation-shell"
import { NavigationProgress } from "@/components/layout/navigation-progress"
import { TenantProvider } from "@/contexts/tenant-context"

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
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <TenantProvider initialCompanyId={null}>
        <SolicitanteImpersonationShell>{children}</SolicitanteImpersonationShell>
      </TenantProvider>
    </div>
  )
}
