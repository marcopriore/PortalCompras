import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { cookies, headers } from "next/headers"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { loadSessionUser } from "@/lib/auth/session-user"
import { TenantProvider } from "@/contexts/tenant-context"
import { SessionUserProvider } from "@/contexts/session-user-context"
import { ScopedQueryBridge } from "@/components/providers/scoped-query-bridge"
import { ImpersonationProvider } from "@/contexts/impersonation-context"
import { ImpersonationBanner } from "@/components/impersonation/impersonation-banner"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { NavigationProgress } from "@/components/layout/navigation-progress"
import { PasswordExpiryGuard } from "@/components/auth/password-expiry-guard"

export const metadata: Metadata = {
  title: "Portal do Solicitante — Valore",
}

export default async function SolicitanteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const pathname =
    headersList.get("x-pathname") ?? headersList.get("x-invoke-path") ?? ""
  const isPublicRoute = pathname.includes("/solicitante/login")

  if (isPublicRoute) {
    return <>{children}</>
  }

  const supabase = await createClient()
  const sessionUser = await loadSessionUser(supabase)

  if (!sessionUser) {
    redirect("/login")
  }

  const isMaster = sessionUser.isSuperAdmin
  const isAdmin = sessionUser.roles.includes("admin")

  if (sessionUser.profileType !== "requester" && !isMaster && !isAdmin) {
    redirect("/login")
  }

  const userName = sessionUser.fullName?.trim() || sessionUser.email || "Usuário"
  const userEmail = sessionUser.email || ""
  const initials =
    userName
      .split(" ")
      .filter((part: string) => Boolean(part))
      .slice(0, 2)
      .map((part: string) => part[0]?.toUpperCase() ?? "")
      .join("") || "US"

  const cookieStore = await cookies()
  const selectedCompanyId =
    cookieStore.get("selected_company_id")?.value ||
    sessionUser.profileCompanyId ||
    null

  return (
    <TenantProvider initialCompanyId={selectedCompanyId}>
      <SessionUserProvider initialUser={sessionUser}>
        <ScopedQueryBridge userId={sessionUser.userId}>
          <ImpersonationProvider>
            <div className="flex h-screen overflow-hidden">
              <Sidebar type="solicitante" />
              <div className="flex flex-1 flex-col overflow-hidden">
                <ImpersonationBanner />
                <Header
                  userName={userName}
                  userEmail={userEmail}
                  userInitials={initials}
                />
                <main className="flex-1 overflow-auto p-6 bg-background">
                  <Suspense fallback={null}>
                    <NavigationProgress />
                  </Suspense>
                  <PasswordExpiryGuard portal="comprador">
                    {children}
                  </PasswordExpiryGuard>
                </main>
              </div>
            </div>
          </ImpersonationProvider>
        </ScopedQueryBridge>
      </SessionUserProvider>
    </TenantProvider>
  )
}