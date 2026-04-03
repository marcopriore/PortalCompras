"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogOut, Building2, ScrollText } from "lucide-react"
import { useUser } from "@/lib/hooks/useUser"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createClient as createBrowserClient } from "@/lib/supabase/client"
import { ValoreLogo } from "@/components/ui/valore-logo"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { userId } = useUser()
  const [adminName, setAdminName] = useState<string>("")

  useEffect(() => {
    if (!userId) return
    const fetchName = async () => {
      const supabase = createBrowserClient()
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single()
      if (data?.full_name) setAdminName(data.full_name as string)
    }
    fetchName()
  }, [userId])

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      router.push("/login")
    }
  }

  const getTitle = () => {
    if (pathname.startsWith("/admin/tenants")) return "Tenants"
    if (pathname.startsWith("/admin/logs")) return "Logs do Sistema"
    return "Admin"
  }

  const navItems = [
    { href: "/admin/tenants", label: "Tenants", icon: Building2 },
    { href: "/admin/logs", label: "Logs", icon: ScrollText },
  ]

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <aside className="flex h-screen w-60 flex-col overflow-hidden bg-[oklch(0.12_0.02_250)] text-white">
        <div className="flex h-16 flex-shrink-0 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <ValoreLogo size={24} showName={true} nameColor="#ffffff" />
            <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded font-medium ml-1">
              Admin
            </span>
          </div>
        </div>
        <hr className="flex-shrink-0 border-border/20 my-3" />
        <nav className="flex-1 min-h-0 overflow-y-auto space-y-1 px-3 text-sm">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/")
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "text-white bg-white/15 font-medium"
                    : "text-white/60 hover:text-white hover:bg-white/10",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <div className="flex-shrink-0 px-3 pb-4 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-2 text-red-400 hover:text-red-300 hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            <span>Sair</span>
          </Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-card px-6">
          <h1 className="text-sm font-medium text-foreground">{getTitle()}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
              {adminName ? adminName[0].toUpperCase() : "?"}
            </div>
            <span>{adminName || "Admin"}</span>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}

