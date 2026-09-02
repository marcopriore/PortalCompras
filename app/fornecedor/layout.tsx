import { Suspense } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
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
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/fornecedor/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, company_id, supplier_id")
    .eq("id", user.id)
    .single()

  const profileRow = profile as {
    full_name?: string | null
    company_id?: string | null
    supplier_id?: string | null
  } | null

  const fullName =
    profileRow?.full_name?.trim() ||
    user.email ||
    "Fornecedor"

  const supplierClients = await listActiveSupplierClients(user.id)
  const userEmail = user.email ?? ""
  const initials =
    fullName
      .split(" ")
      .filter((part) => Boolean(part))
      .slice(0, 2)
      .map((part: string) => part[0]?.toUpperCase() ?? "")
      .join("") || "FO"

  return (
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
        activeCompanyId={profileRow?.company_id ?? null}
        activeSupplierId={profileRow?.supplier_id ?? null}
      >
        <PasswordExpiryGuard portal="fornecedor">{children}</PasswordExpiryGuard>
      </FornecedorPortalShell>
    </Suspense>
  )
}
