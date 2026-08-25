/** Timeline horizontal de requisição (fluxo padrão e catálogo). */

export type RequisitionTimelineStepStatus =
  | "completed"
  | "active"
  | "pending"
  | "rejected"
  | "cancelled"

export type RequisitionTimelineStep = {
  key: string
  label: string
  status: RequisitionTimelineStepStatus
  date?: string | null
}

type TimelineRequisition = {
  status: string
  created_at: string
  approved_at?: string | null
  origin?: string | null
}

type TimelineQuotation = {
  status: string
  created_at: string
} | null

type TimelineOrder = {
  status: string
  created_at: string
  estimated_delivery_date?: string | null
}

function buyerStepStatus(reqStatus: string): RequisitionTimelineStepStatus {
  if (reqStatus === "awaiting_buyer") return "active"
  if (reqStatus === "awaiting_supplier" || reqStatus === "completed") {
    return "completed"
  }
  return "pending"
}

function supplierStepStatus(reqStatus: string): RequisitionTimelineStepStatus {
  if (reqStatus === "awaiting_supplier") return "active"
  if (reqStatus === "completed") return "completed"
  return "pending"
}

function completedStepStatus(reqStatus: string): RequisitionTimelineStepStatus {
  return reqStatus === "completed" ? "completed" : "pending"
}

/** Catálogo: Criada → Pendente Comprador → Aceite Fornecedor → Concluída */
export function buildCatalogRequisitionTimeline(
  req: TimelineRequisition,
  orders: TimelineOrder[],
): RequisitionTimelineStep[] {
  const orderDate = orders[0]?.created_at ?? null
  const completedDate =
    orders.find((o) => o.status === "completed")?.estimated_delivery_date ?? null

  return [
    {
      key: "created",
      label: "Criada",
      status: "completed",
      date: req.created_at,
    },
    {
      key: "awaiting_buyer",
      label: "Pendente Comprador",
      status: buyerStepStatus(req.status),
      date: orderDate,
    },
    {
      key: "awaiting_supplier",
      label: "Aceite Fornecedor",
      status: supplierStepStatus(req.status),
      date: orderDate,
    },
    {
      key: "completed",
      label: "Concluída",
      status: completedStepStatus(req.status),
      date: completedDate,
    },
  ]
}

/**
 * Fluxo padrão:
 * Criada → Aprovação → Cotação → Pendente Comprador → Aceite Fornecedor → Concluída
 */
export function buildStandardRequisitionTimeline(
  req: TimelineRequisition,
  quotation: TimelineQuotation,
  orders: TimelineOrder[],
  options?: { includeCancelledBranch?: boolean },
): RequisitionTimelineStep[] {
  const orderDate = orders[0]?.created_at ?? null
  const completedDate =
    orders.find((o) => o.status === "completed")?.estimated_delivery_date ?? null

  const earlyStatuses = ["draft", "pending", "rejected", "cancelled"]

  const baseSteps: RequisitionTimelineStep[] = [
    {
      key: "created",
      label: req.status === "draft" ? "Rascunho" : "Criada",
      status: req.status === "draft" ? "active" : "completed",
      date: req.created_at,
    },
    {
      key: "approval",
      label: "Aprovação",
      status:
        req.status === "draft"
          ? "pending"
          : req.status === "rejected"
            ? "rejected"
            : req.status === "cancelled"
              ? "pending"
              : req.status === "pending"
                ? "active"
                : "completed",
      date: req.approved_at ?? null,
    },
    {
      key: "quotation",
      label: "Cotação",
      status: earlyStatuses.includes(req.status)
        ? "pending"
        : ["awaiting_buyer", "awaiting_supplier", "completed"].includes(
              req.status,
            ) ||
            (quotation != null &&
              ["completed", "cancelled"].includes(quotation.status))
          ? "completed"
          : quotation
            ? "active"
            : req.status === "approved"
              ? "pending"
              : "active",
      date: quotation?.created_at ?? null,
    },
    {
      key: "awaiting_buyer",
      label: "Pendente Comprador",
      status: buyerStepStatus(req.status),
      date: orderDate,
    },
    {
      key: "awaiting_supplier",
      label: "Aceite Fornecedor",
      status: supplierStepStatus(req.status),
      date: orderDate,
    },
    {
      key: "completed",
      label: "Concluída",
      status: completedStepStatus(req.status),
      date: completedDate,
    },
  ]

  if (options?.includeCancelledBranch && req.status === "cancelled") {
    return [
      ...baseSteps.slice(0, 2),
      {
        key: "cancelled",
        label: "Cancelada",
        status: "cancelled",
        date: null,
      },
      ...baseSteps.slice(2),
    ]
  }

  return baseSteps
}
