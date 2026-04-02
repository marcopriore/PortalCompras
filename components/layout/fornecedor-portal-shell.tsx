"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ChevronDown,
  ChevronLeft,
  FileText,
  LayoutDashboard,
  LogOut,
  ShoppingCart,
} from "lucide-react"
import { toast } from "sonner"
import { ValoreLogo } from "@/components/ui/valore-logo"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const SIDEBAR_BG = "#1a1a2e"
const ACTIVE_BORDER = "#4F3EF5"

/** Rotas como /fornecedor/atividades não entram no menu; permanecem válidas sob este shell. */
const navItems = [
  { href: "/fornecedor", label: "Dashboard", icon: LayoutDashboard },
  { href: "/fornecedor/cotacoes", label: "Cotações", icon: FileText },
  { href: "/fornecedor/pedidos", label: "Pedidos", icon: ShoppingCart },
] as const

export interface FornecedorPortalShellProps {
  userName: string
  userEmail: string
  userInitials: string
  children: React.ReactNode
}

export default function FornecedorPortalShell({
  userName,
  userEmail,
  userInitials,
  children,
}: FornecedorPortalShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [collapsed, setCollapsed] = React.useState(false)
  const unauthorizedToastShown = React.useRef(false)

  const isActive = (href: string) =>
    href === "/fornecedor"
      ? pathname === "/fornecedor"
      : pathname === href || pathname.startsWith(`${href}/`)

  React.useEffect(() => {
    if (searchParams.get("error") !== "unauthorized_portal" || unauthorizedToastShown.current) {
      return
    }
    unauthorizedToastShown.current = true
    toast.error("Você não tem permissão para acessar o Portal do Comprador.")
    const params = new URLSearchParams(searchParams.toString())
    params.delete("error")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [pathname, router, searchParams])

  const handleLogout = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {
      // ignore
    }
    router.push("/fornecedor/login")
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen w-full overflow-hidden">
        <aside
          className={cn(
            "flex h-screen flex-col text-white transition-all duration-300",
            collapsed ? "w-16" : "w-[240px]",
          )}
          style={{ backgroundColor: SIDEBAR_BG }}
        >
          <div className="flex h-16 flex-shrink-0 items-center border-b border-white/10 px-4">
            <Link href="/fornecedor" className="inline-flex items-center">
              <ValoreLogo size={28} showName={!collapsed} nameColor="#ffffff" />
            </Link>
          </div>

          {!collapsed ? (
            <div className="px-4 py-2 flex-shrink-0">
              <p className="text-xs font-medium uppercase tracking-widest text-white/60">
                Portal Fornecedor
              </p>
            </div>
          ) : null}

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              const linkClass = cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "mx-auto w-10 justify-center px-0",
                active
                  ? "border-l-[3px] bg-white/10 text-white"
                  : "border-l-[3px] border-transparent text-white/60 hover:bg-white/5 hover:text-white",
              )
              const linkStyle = active ? { borderLeftColor: ACTIVE_BORDER } : undefined

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={linkClass}
                        style={linkStyle}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={linkClass}
                  style={linkStyle}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="flex-shrink-0 border-t border-white/10 p-3">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white",
                collapsed && "justify-center",
              )}
            >
              <ChevronLeft
                className={cn(
                  "h-4 w-4 flex-shrink-0 transition-transform",
                  collapsed && "rotate-180",
                )}
              />
              {!collapsed ? <span>Recolher</span> : null}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-16 flex-shrink-0 items-center justify-end border-b border-border bg-card px-6">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden flex-col items-start md:flex">
                    <span className="text-sm font-medium text-foreground">{userName}</span>
                    <span className="text-xs text-muted-foreground">{userEmail}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={() => void handleLogout()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="flex-1 overflow-auto bg-background p-8">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  )
}
