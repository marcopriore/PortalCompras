import { redirect } from "next/navigation"
import { cookies, headers } from "next/headers"
import { TenantProvider } from "@/contexts/tenant-context"
import { ImpersonationProvider } from "@/contexts/impersonation-context"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { ImpersonationBanner } from "@/components/impersonation/impersonation-banner"
import { TenantSelector } from "@/components/layout/tenant-selector"
import { PortalUnauthorizedToast } from "@/components/layout/portal-unauthorized-toast"
import { CompradorRouteGuard } from "@/components/comprador/comprador-route-guard"
import { CompradorPermissionToast } from "@/components/comprador/comprador-permission-toast"
import { PasswordExpiryGuard } from "@/components/auth/password-expiry-guard"
import { createClient } from "@/lib/supabase/server"
import { Suspense } from "react"

type LayoutCompany = {
  id: string
  name: string
}

export default async function CompradorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, full_name, is_superadmin, profile_type")
    .eq("id", user.id)
    .single()

  const profileType = (profile as { profile_type?: string } | null)?.profile_type ?? "buyer"
  if (profileType === "supplier") {
    redirect("/fornecedor?error=unauthorized_portal")
  }

  const isSuperAdmin = Boolean((profile as any)?.is_superadmin)

  const userName =
    (profile as { full_name?: string } | null)?.full_name ||
    user.email ||
    "Usuário"
  const userEmail = user.email || ""
  const initials =
    userName
      .split(" ")
      .filter((part) => Boolean(part))
      .slice(0, 2)
      .map((part: string) => part[0]?.toUpperCase())
      .join("") || "US"

  let companies: LayoutCompany[] | undefined

  if (isSuperAdmin) {
    const { data: companiesData } = await supabase
      .from("companies")
      .select("id, name")
      .order("name", { ascending: true })

    companies = (companiesData as LayoutCompany[]) ?? []
  }

  const cookieStore = await cookies()
  const selectedCompanyId =
    cookieStore.get("selected_company_id")?.value ||
    (profile as any)?.company_id ||
    null

  const headersList = await headers()
  const pathname = headersList.get("x-pathname") ?? ""
  const isStandaloneIntegrationsMonitor = pathname.startsWith(
    "/comprador/integracoes/monitor",
  )

  if (isStandaloneIntegrationsMonitor) {
    return (
      <TenantProvider initialCompanyId={selectedCompanyId}>{children}</TenantProvider>
    )
  }

  return (
    <TenantProvider initialCompanyId={selectedCompanyId}>
      <ImpersonationProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar type="comprador" />
          <div className="flex flex-1 flex-col overflow-hidden">
            <ImpersonationBanner />
            <Header
            userName={userName}
            userEmail={userEmail}
            userInitials={initials}
            tenantSelector={
              isSuperAdmin && companies && companies.length > 0 ? (
                <TenantSelector
                  companies={companies}
                  selectedCompanyId={selectedCompanyId}
                />
              ) : null
            }
          />
          <main className="flex-1 overflow-auto p-6 bg-background">
            <Suspense fallback={null}>
              <PortalUnauthorizedToast message="Você não tem permissão para acessar o Portal do Fornecedor." />
              <CompradorPermissionToast />
            </Suspense>
            <CompradorRouteGuard>
              <PasswordExpiryGuard portal="comprador">{children}</PasswordExpiryGuard>
            </CompradorRouteGuard>
          </main>
        </div>
      </div>
      </ImpersonationProvider>
    </TenantProvider>
  )
}
