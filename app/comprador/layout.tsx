import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { createClient } from "@/lib/supabase/server"

export default async function CompradorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/login")
  }

  const user = session.user
  const userName = (user.user_metadata as { full_name?: string } | null)?.full_name || user.email || "Usuário"
  const userEmail = user.email || ""
  const initials =
    userName
      .split(" ")
      .filter((part) => Boolean(part))
      .slice(0, 2)
      .map((part: string) => part[0]?.toUpperCase())
      .join("") || "US"

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar type="comprador" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userName={userName}
          userEmail={userEmail}
          userInitials={initials}
        />
        <main className="flex-1 overflow-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
