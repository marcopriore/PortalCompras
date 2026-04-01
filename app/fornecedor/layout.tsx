import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import FornecedorPortalShell from "@/components/layout/fornecedor-portal-shell"

export default async function FornecedorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <>{children}</>
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, company_id, supplier_id")
    .eq("id", user.id)
    .single()

  const fullName =
    (profile as { full_name?: string | null } | null)?.full_name?.trim() ||
    user.email ||
    "Fornecedor"
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
      >
        {children}
      </FornecedorPortalShell>
    </Suspense>
  )
}
