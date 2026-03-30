"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { FileText, LayoutDashboard, LogOut } from "lucide-react"
import { ValoreLogo } from "@/components/ui/valore-logo"
import { Button } from "@/components/ui/button"
import { useUser } from "@/lib/hooks/useUser"
import { cn } from "@/lib/utils"

const SIDEBAR_BG = "#1a1a2e"
const ACTIVE_BORDER = "#4F3EF5"

const navItems = [
  { title: "Dashboard", href: "/fornecedor", icon: LayoutDashboard },
  { title: "Cotações", href: "/fornecedor/cotacoes", icon: FileText },
] as const

export function FornecedorPortalShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { companyName, loading } = useUser()

  const supplierLabel = companyName?.trim() || "Fornecedor"

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // ignore
    }
    router.push("/login")
  }

  return (
    <div className="flex min-h-screen w-full">
      <aside
        className="flex w-[240px] shrink-0 flex-col text-white"
        style={{ backgroundColor: SIDEBAR_BG }}
      >
        <div className="border-b border-white/10 px-4 py-5">
          <Link href="/fornecedor" className="inline-flex items-center">
            <ValoreLogo size={28} showName={true} nameColor="#ffffff" />
          </Link>
          <p
            className="mt-3 text-[11px] font-medium uppercase text-white/60 tracking-[0.2em]"
          >
            Portal Fornecedor
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.href === "/fornecedor"
                ? pathname === "/fornecedor"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-white/10 text-white border-l-[3px]"
                    : "border-l-[3px] border-transparent text-white/60 hover:text-white",
                )}
                style={
                  isActive
                    ? { borderLeftColor: ACTIVE_BORDER }
                    : undefined
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.title}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-3 space-y-2">
          <p
            className="truncate px-2 text-xs text-white/70"
            title={supplierLabel}
          >
            {loading ? "…" : supplierLabel}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-white/80 hover:bg-white/10 hover:text-white"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 bg-background p-8">{children}</div>
    </div>
  )
}
