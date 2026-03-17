"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
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
  { title: "Pedidos", href: "/comprador/pedidos", icon: ShoppingCart },
  { title: "Cotações", href: "/comprador/cotacoes", icon: FileText },
  { title: "Itens", href: "/comprador/itens", icon: Package },
  { title: "Fornecedores", href: "/comprador/fornecedores", icon: Building2 },
  { title: "Relatórios", href: "/comprador/relatorios", icon: BarChart3 },
  { title: "Configurações", href: "/comprador/configuracoes", icon: Settings },
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
  const pathname = usePathname()
  const navItems = type === "comprador" ? buyerNavItems : supplierNavItems

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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
                <Package className="h-4 w-4 text-sidebar-primary-foreground" />
              </div>
              <span className="font-semibold text-sm">ProcureMax</span>
            </Link>
          )}
          {collapsed && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary mx-auto">
              <Package className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            const NavIcon = item.icon

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg mx-auto transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <NavIcon className="h-5 w-5" />
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
              </Link>
            )
          })}
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
