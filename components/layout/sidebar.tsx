"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { createClient } from "@/lib/supabase/client"
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Package,
  ClipboardList,
  BarChart3,
  Building2,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ValoreLogo } from "@/components/ui/valore-logo"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const buyerNavItems: NavItem[] = [
  { title: "Dashboard", href: "/comprador", icon: LayoutDashboard },
  { title: "Requisições", href: "/comprador/requisicoes", icon: ClipboardList },
  { title: "Cotações", href: "/comprador/cotacoes", icon: FileText },
  { title: "Pedidos", href: "/comprador/pedidos", icon: ShoppingCart },
  { title: "Aprovações", href: "/comprador/aprovacoes", icon: ShieldCheck },
  { title: "Itens", href: "/comprador/itens", icon: Package },
  { title: "Fornecedores", href: "/comprador/fornecedores", icon: Building2 },
  { title: "Relatórios", href: "/comprador/relatorios", icon: BarChart3 },
  { title: "Configurações", href: "/comprador/configuracoes", icon: Settings },
  { title: "Usuários", href: "/comprador/configuracoes/usuarios", icon: Users },
]

const supplierNavItems: NavItem[] = [
  { title: "Dashboard", href: "/fornecedor", icon: LayoutDashboard },
  { title: "Oportunidades", href: "/fornecedor/oportunidades", icon: Package },
  { title: "Minhas Propostas", href: "/fornecedor/propostas", icon: FileText },
  { title: "Pedidos", href: "/fornecedor/pedidos", icon: ShoppingCart },
  { title: "Minha Empresa", href: "/fornecedor/empresa", icon: Building2 },
  { title: "Configurações", href: "/fornecedor/configuracoes", icon: Settings },
]

interface SidebarProps {
  type: "comprador" | "fornecedor"
}

export function Sidebar({ type }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [pendingApprovals, setPendingApprovals] = useState<number | null>(null)
  const pathname = usePathname()
  const { userId, companyId, hasRole, isSuperAdmin, loading: userLoading } = useUser()
  const { hasPermission, loading: permissionsLoading } = usePermissions()

  const isLoading = userLoading || permissionsLoading

  const canShowAdminLinks = hasRole("admin") || isSuperAdmin === true

  const navItems = React.useMemo(() => {
    const base = type === "comprador" ? buyerNavItems : supplierNavItems
    if (type !== "comprador") return base

    return base.filter((item) => {
      const href = item.href
      if (href === "/comprador") return hasPermission("nav.dashboard") || isSuperAdmin
      if (href === "/comprador/requisicoes") return hasPermission("nav.requisitions") || isSuperAdmin
      if (href === "/comprador/cotacoes") return hasPermission("nav.quotations") || isSuperAdmin
      if (href === "/comprador/pedidos") return hasPermission("nav.orders") || isSuperAdmin
      if (href === "/comprador/aprovacoes")
        return hasPermission("approval.requisition") || hasPermission("approval.order")
      if (href === "/comprador/itens") return hasPermission("nav.items") || isSuperAdmin
      if (href === "/comprador/fornecedores") return hasPermission("nav.suppliers") || isSuperAdmin
      if (href === "/comprador/relatorios") return hasPermission("nav.reports") || isSuperAdmin
      if (href === "/comprador/configuracoes") return canShowAdminLinks
      if (href === "/comprador/configuracoes/usuarios") return canShowAdminLinks
      return true
    })
  }, [type, hasPermission, canShowAdminLinks, isSuperAdmin])

  useEffect(() => {
    if (type !== "comprador" || !companyId || !userId) return
    const supabase = createClient()
    const isAdmin = hasRole("admin")

    const fetchPendingCount = async () => {
      let query = supabase
        .from("approval_requests")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "pending")
      if (!isAdmin) {
        query = query.eq("approver_id", userId)
      }
      const { count } = await query
      setPendingApprovals(count ?? 0)
    }

    fetchPendingCount()
    window.addEventListener("approval-updated", fetchPendingCount)
    return () => window.removeEventListener("approval-updated", fetchPendingCount)
  }, [type, companyId, userId, hasRole])

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-screen flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          {!collapsed && (
            <Link href={type === "comprador" ? "/comprador" : "/fornecedor"} className="flex items-center gap-2">
              <ValoreLogo size={28} showName={true} nameColor="#ffffff" />
            </Link>
          )}
          {collapsed && (
            <div className="mx-auto">
              <ValoreLogo size={28} showName={false} nameColor="#ffffff" />
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
          {isLoading ? (
            <>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-8 bg-white/10 rounded-md animate-pulse mx-3 mb-1"
                />
              ))}
            </>
          ) : (
          navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            const NavIcon = item.icon

            const showApprovalsBadge =
              item.href === "/comprador/aprovacoes" &&
              type === "comprador" &&
              pendingApprovals != null &&
              pendingApprovals > 0

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg mx-auto transition-colors relative",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <NavIcon className="h-5 w-5" />
                      {showApprovalsBadge && (
                        <span className="absolute -top-0.5 -right-0.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                          {pendingApprovals}
                        </span>
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.title}
                  </TooltipContent>
                </Tooltip>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-lg px-3 transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <NavIcon className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{item.title}</span>
                {showApprovalsBadge && (
                  <span className="ml-auto bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                    {pendingApprovals}
                  </span>
                )}
              </Link>
            )
          }))}
        </nav>

        <div className="p-2 border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              collapsed && "justify-center"
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span>Recolher</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
