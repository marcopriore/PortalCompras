"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { NotificationBell } from "@/components/ui/notification-bell"
import { LogOut, User, Bell, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

type SolicitanteHeaderProps = {
  userName?: string
}

const NAV = [
  { tab: "perfil", label: "Perfil", icon: User, href: "/solicitante/configuracoes?tab=perfil" },
  {
    tab: "notificacoes",
    label: "Notificações",
    icon: Bell,
    href: "/solicitante/configuracoes?tab=notificacoes",
  },
  {
    tab: "seguranca",
    label: "Segurança",
    icon: Shield,
    href: "/solicitante/configuracoes?tab=seguranca",
  },
] as const

function SolicitanteHeaderNav({ userName }: SolicitanteHeaderProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get("tab")
  const onConfig = pathname?.startsWith("/solicitante/configuracoes")

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-6 py-3 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/solicitante" className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                Portal do Solicitante
              </p>
              {userName ? (
                <p className="text-xs text-muted-foreground truncate">{userName}</p>
              ) : null}
            </div>
          </Link>
        </div>

        <nav className="flex items-center gap-1 flex-wrap">
          {NAV.map(({ tab, label, icon: Icon, href }) => {
            const active = onConfig && activeTab === tab
            return (
              <Link
                key={tab}
                href={href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            )
          })}
          <NotificationBell />
          <Button variant="ghost" size="sm" onClick={() => void handleLogout()}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </nav>
      </div>
    </header>
  )
}

export function SolicitanteHeader({ userName }: SolicitanteHeaderProps) {
  return (
    <React.Suspense
      fallback={
        <header className="sticky top-0 z-20 border-b border-border bg-card px-6 py-3">
          <div className="max-w-7xl mx-auto h-10" />
        </header>
      }
    >
      <SolicitanteHeaderNav userName={userName} />
    </React.Suspense>
  )
}
