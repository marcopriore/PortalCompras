import { Suspense } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { loadSessionUser } from "@/lib/auth/session-user"
import { TenantProvider } from "@/contexts/tenant-context"
import { SessionUserProvider } from "@/contexts/session-user-context"
import { ScopedQueryBridge } from "@/components/providers/scoped-query-bridge"
import FornecedorPortalShell from "@/components/layout/fornecedor-portal-shell"
import { PasswordExpiryGuard } from "@/components/auth/password-expiry-guard"
import { listActiveSupplierClients } from "@/lib/supplier-portal/memberships"

export default async function FornecedorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const pathname =
    headersList.get("x-pathname") ?? headersList.get("x-invoke-path") ?? ""
  const isPublicRoute =
    pathname.includes("/fornecedor/login") ||
    pathname.includes("/fornecedor/cadastro") ||
    pathname.includes("/fornecedor/recuperar-senha") ||
    pathname.includes("/fornecedor/alterar-senha")

  if (isPublicRoute) {
    return <>{children}</>
  }

  const supabase = await createClient()
  const sessionUser = await loadSessionUser(supabase)

  if (!sessionUser) {
    redirect("/fornecedor/login")
  }

  const fullName =
    sessionUser.fullName?.trim() ||
    sessionUser.email ||
    "Fornecedor"

  const activeCompanyId = sessionUser.profileCompanyId
  const activeSupplierId = sessionUser.supplierId

  const supplierClients = await listActiveSupplierClients(sessionUser.userId)
  const userEmail = sessionUser.email ?? ""
  const initials =
    fullName
      .split(" ")
      .filter((part) => Boolean(part))
      .slice(0, 2)
      .map((part: string) => part[0]?.toUpperCase() ?? "")
      .join("") || "FO"

  return (
    <TenantProvider initialCompanyId={activeCompanyId}>
      <SessionUserProvider initialUser={sessionUser}>
        <ScopedQueryBridge userId={sessionUser.userId}>
          <Suspense
            fallback={
              <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
                Carregando…
              </div>
            }
          >
            <FornecedorPortalShell
              userName={fullName}
              userEmail={userEmail}
              userInitials={initials}
              supplierClients={supplierClients}
              activeCompanyId={activeCompanyId}
              activeSupplierId={activeSupplierId}
            >
              <PasswordExpiryGuard portal="fornecedor">
                {children}
              </PasswordExpiryGuard>
            </FornecedorPortalShell>
          </Suspense>
        </ScopedQueryBridge>
      </SessionUserProvider>
    </TenantProvider>
  )
}