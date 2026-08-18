import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { TenantProvider } from "@/contexts/tenant-context"
import { ValoreLogo } from "@/components/ui/valore-logo"
import { getIntegrationsPageAccess } from "@/lib/api/check-integrations-page-access"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Monitor de Integração — Valore",
  description: "Logs inbound e outbound de integrações com o ERP.",
}

export default async function CompradorIntegracoesMonitorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const access = await getIntegrationsPageAccess()

  if (!access.allowed) {
    if (access.reason === "unauthenticated") {
      redirect("/login?redirectTo=/comprador/integracoes/monitor")
    }

    const message =
      access.reason === "feature_disabled"
        ? "O módulo de integrações não está habilitado para este tenant."
        : "Acesso restrito a administradores do tenant com permissão de integrações."

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm font-medium text-foreground">Acesso negado</p>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, is_superadmin")
    .eq("id", user!.id)
    .single()

  const cookieStore = await cookies()
  const selectedCompanyId =
    cookieStore.get("selected_company_id")?.value ||
    (profile as { company_id?: string } | null)?.company_id ||
    access.companyId

  return (
    <TenantProvider initialCompanyId={selectedCompanyId}>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="h-7 [&_svg]:h-7 [&_svg]:w-auto">
                <ValoreLogo size={28} showName={false} instance="monitor" />
              </div>
              <div className="hidden h-5 w-px bg-border sm:block" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  Monitor de Integração
                </p>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  Acompanhe chamadas da API e webhooks em tempo real
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Mantenha esta janela aberta enquanto opera no portal
            </p>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">{children}</main>
      </div>
    </TenantProvider>
  )
}
