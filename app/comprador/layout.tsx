import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { TenantProvider } from "@/contexts/tenant-context"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { TenantSelector } from "@/components/layout/tenant-selector"
import { PortalUnauthorizedToast } from "@/components/layout/portal-unauthorized-toast"
import { createClient } from "@/lib/supabase/server"

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

  return (
    <TenantProvider initialCompanyId={selectedCompanyId}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar type="comprador" />
        <div className="flex flex-1 flex-col overflow-hidden">
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
            <PortalUnauthorizedToast message="Você não tem permissão para acessar o Portal do Fornecedor." />
            {children}
          </main>
        </div>
      </div>
    </TenantProvider>
  )
}
