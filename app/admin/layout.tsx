import { redirect } from "next/navigation"
import { SessionUserProvider } from "@/contexts/session-user-context"
import { QueryProvider } from "@/components/providers/query-provider"
import { createClient } from "@/lib/supabase/server"
import { loadSessionUser } from "@/lib/auth/session-user"
import AdminShell from "./admin-shell"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const sessionUser = await loadSessionUser(supabase)

  if (!sessionUser) {
    redirect("/login")
  }

  const scopeKey = `${sessionUser.userId}:admin`

  return (
    <SessionUserProvider initialUser={sessionUser}>
      <QueryProvider scopeKey={scopeKey}>
        <AdminShell>{children}</AdminShell>
      </QueryProvider>
    </SessionUserProvider>
  )
}