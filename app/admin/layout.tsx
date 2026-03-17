import Link from "next/link"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export default async function AdminLayout({
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

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single()

  if (error || !profile?.is_superadmin) {
    redirect("/comprador")
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-64 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center border-b border-border px-4">
          <span className="text-lg font-semibold">ProcureMax Admin</span>
        </div>
        <nav className="flex-1 space-y-1 px-4 py-3 text-sm">
          <Link href="/admin/tenants" className="block rounded-md px-3 py-2 hover:bg-accent">
            Tenants
          </Link>
        </nav>
        <form
          action="/api/auth/logout"
          method="POST"
          className="border-t border-border px-4 py-3"
        >
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
          >
            Sair
          </button>
        </form>
      </aside>
      <main className="flex-1 overflow-auto bg-background p-6">
        {children}
      </main>
    </div>
  )
}

