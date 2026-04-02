import type { LucideIcon } from "lucide-react"
import {
  CheckCircle,
  Mail,
  Package,
  ShoppingCart,
  Send,
  XCircle,
  Trophy,
} from "lucide-react"
import { getPOStatusForSupplier } from "@/lib/po-status"

export type ProposalActivityRow = {
  status: string
  updated_at: string
  quotation_id: string
  quotations: { code: string } | { code: string }[] | null
}

export type OrderActivityRow = {
  id: string
  code: string
  status: string
  updated_at: string
  accepted_at?: string | null
  estimated_delivery_date?: string | null
  cancellation_reason?: string | null
}

export type ActivityItem = {
  id: string
  type: "proposal" | "order"
  status: string
  updated_at: string
  label: string
  code: string
  icon: LucideIcon
  iconClass: string
}

export const proposalStatusLabel: Record<string, string> = {
  invited: "Convite recebido",
  submitted: "Proposta enviada",
  selected: "Proposta selecionada",
  rejected: "Proposta não selecionada",
}

export function pickQuotationCode(embed: ProposalActivityRow["quotations"]): string {
  if (!embed) return "—"
  if (Array.isArray(embed)) return embed[0]?.code ?? "—"
  return embed.code ?? "—"
}

export function mapProposalRowsToActivityItems(rows: ProposalActivityRow[]): ActivityItem[] {
  return rows.map((row, idx) => {
    let icon: LucideIcon = Send
    let iconClass = "text-green-600"
    if (row.status === "invited") {
      icon = Mail
      iconClass = "text-blue-600"
    } else if (row.status === "selected") {
      icon = Trophy
      iconClass = "text-amber-500"
    } else if (row.status === "rejected") {
      icon = XCircle
      iconClass = "text-red-600"
    }

    return {
      id: `${row.quotation_id}-${row.updated_at}-${idx}`,
      type: "proposal",
      status: row.status,
      updated_at: row.updated_at,
      label: proposalStatusLabel[row.status] ?? `Status: ${row.status}`,
      code: pickQuotationCode(row.quotations),
      icon,
      iconClass,
    }
  })
}

export function mapOrderRowsToActivityItems(rows: OrderActivityRow[]): ActivityItem[] {
  return rows.map((row) => {
    const baseLabel = getPOStatusForSupplier(row.status).label
    if (row.status === "sent") {
      return {
        id: row.id,
        type: "order",
        status: row.status,
        updated_at: row.updated_at,
        label: `Pedido recebido — ${row.code}`,
        code: row.code,
        icon: ShoppingCart,
        iconClass: "text-blue-600",
      }
    }
    if (row.status === "processing") {
      return {
        id: row.id,
        type: "order",
        status: row.status,
        updated_at: row.updated_at,
        label: `Pedido aceito — ${row.code}`,
        code: row.code,
        icon: CheckCircle,
        iconClass: "text-green-600",
      }
    }
    if (row.status === "refused") {
      return {
        id: row.id,
        type: "order",
        status: row.status,
        updated_at: row.updated_at,
        label: `Pedido recusado — ${row.code}`,
        code: row.code,
        icon: XCircle,
        iconClass: "text-red-600",
      }
    }
    if (row.status === "completed") {
      return {
        id: row.id,
        type: "order",
        status: row.status,
        updated_at: row.updated_at,
        label: `Pedido finalizado — ${row.code}`,
        code: row.code,
        icon: Package,
        iconClass: "text-green-600",
      }
    }
    if (row.status === "cancelled") {
      return {
        id: row.id,
        type: "order",
        status: row.status,
        updated_at: row.updated_at,
        label: `Pedido cancelado — ${row.code}`,
        code: row.code,
        icon: XCircle,
        iconClass: "text-slate-600",
      }
    }
    return {
      id: row.id,
      type: "order",
      status: row.status,
      updated_at: row.updated_at,
      label: `${baseLabel} — ${row.code}`,
      code: row.code,
      icon: ShoppingCart,
      iconClass: "text-slate-600",
    }
  })
}

export function mergeActivityByUpdatedAt(a: ActivityItem[], b: ActivityItem[]): ActivityItem[] {
  return [...a, ...b].sort(
    (x, y) => new Date(y.updated_at).getTime() - new Date(x.updated_at).getTime(),
  )
}
