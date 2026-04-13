"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/lib/hooks/useUser"
import {
  Bell,
  Check,
  FileText,
  ShoppingCart,
  Calendar,
  Workflow,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useNotifications } from "@/lib/hooks/use-notifications"
import { formatDateTimeBR } from "@/lib/utils/date-helpers"

function resolveNotificationRoute(
  type: string,
  entity: string | null,
  entityId: string | null,
  profileType?: string | null,
): string | null {
  if (!entityId) return null

  const buyerRoutes: Record<string, string> = {
    quotation: `/comprador/cotacoes/${entityId}`,
    quotation_rounds: `/comprador/cotacoes/${entityId}`,
    purchase_order: `/comprador/pedidos/${entityId}`,
    requisition: `/comprador/requisicoes/${entityId}`,
  }

  const supplierRoutes: Record<string, string> = {
    quotation: `/fornecedor/cotacoes/${entityId}`,
    quotation_rounds: `/fornecedor/cotacoes/${entityId}`,
    purchase_order: `/fornecedor/pedidos/${entityId}`,
  }

  const requesterRoutes: Record<string, string> = {
    requisition: `/solicitante/${entityId}`,
  }

  if (type.startsWith("quotation") || type.startsWith("proposal")) {
    if (profileType === "supplier") return supplierRoutes[entity ?? ""] ?? null
    return buyerRoutes[entity ?? ""] ?? null
  }

  if (type.startsWith("order")) {
    if (profileType === "supplier") return supplierRoutes[entity ?? ""] ?? null
    return buyerRoutes[entity ?? ""] ?? null
  }

  if (type.startsWith("approval") || type.startsWith("requisition")) {
    if (profileType === "requester") return requesterRoutes[entity ?? ""] ?? null
    return buyerRoutes[entity ?? ""] ?? null
  }

  if (profileType === "supplier") return supplierRoutes[entity ?? ""] ?? null
  if (profileType === "requester") return requesterRoutes[entity ?? ""] ?? null
  return buyerRoutes[entity ?? ""] ?? null
}

function getNotificationIcon(type: string) {
  const map: Record<string, { icon: React.ElementType; color: string }> = {
    "proposal.submitted": { icon: FileText, color: "text-blue-500" },
    "order.accepted": { icon: CheckCircle, color: "text-green-500" },
    "order.refused": { icon: XCircle, color: "text-red-500" },
    "order.delivery_updated": { icon: Calendar, color: "text-amber-500" },
    "approval.requisition": { icon: Workflow, color: "text-purple-500" },
    "approval.order": { icon: Workflow, color: "text-purple-500" },
    "quotation.invited": { icon: FileText, color: "text-blue-500" },
    "quotation.new_round": { icon: FileText, color: "text-indigo-500" },
    "order.received": { icon: ShoppingCart, color: "text-blue-500" },
  }
  return map[type] ?? { icon: Bell, color: "text-muted-foreground" }
}

export function NotificationBell() {
  const router = useRouter()
  const { profileType } = useUser()
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotifications()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0">Notificações</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllAsRead()}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Check className="h-3 w-3" /> Marcar todas como lidas
            </button>
          )}
        </div>
        <DropdownMenuSeparator />

        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma notificação
            </p>
          ) : (
            notifications.map((n) => {
              const { icon: Icon, color } = getNotificationIcon(n.type)
              const route = resolveNotificationRoute(
                n.type,
                n.entity,
                n.entity_id,
                profileType,
              )
              return (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!n.read) void markAsRead(n.id)
                    if (route) router.push(route)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      if (!n.read) void markAsRead(n.id)
                      if (route) router.push(route)
                    }
                  }}
                  className={`flex items-start gap-3 border-b border-border px-3 py-3 transition-colors last:border-0 hover:bg-muted/50 ${
                    !n.read ? "bg-primary/5" : ""
                  } ${route ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div className={`mt-0.5 flex-shrink-0 ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm ${!n.read ? "font-semibold" : "font-medium"}`}
                    >
                      {n.title}
                    </p>
                    {n.body ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {n.body}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTimeBR(n.created_at, true)}
                    </p>
                  </div>
                  {!n.read ? (
                    <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                  ) : null}
                </div>
              )
            })
          )}
        </div>

        <DropdownMenuSeparator />
        <div className="px-3 py-2 text-center">
          <span className="text-xs text-muted-foreground">
            Mostrando últimas 20 notificações
          </span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
