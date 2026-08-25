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
  accepted_at?: string | null
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

/** Data só em etapa concluída (ou rejeitada). */
function dateWhenDone(
  status: RequisitionTimelineStepStatus,
  date: string | null | undefined,
): string | null {
  if (status !== "completed" && status !== "rejected") return null
  return date ?? null
}

function step(
  key: string,
  label: string,
  status: RequisitionTimelineStepStatus,
  date: string | null | undefined,
): RequisitionTimelineStep {
  return { key, label, status, date: dateWhenDone(status, date) }
}

/** Catálogo: Criada → Pendente Comprador → Aceite Fornecedor → Concluída */
export function buildCatalogRequisitionTimeline(
  req: TimelineRequisition,
  orders: TimelineOrder[],
): RequisitionTimelineStep[] {
  const buyerStatus = buyerStepStatus(req.status)
  const supplierStatus = supplierStepStatus(req.status)
  const doneStatus = completedStepStatus(req.status)

  const supplierDoneAt =
    orders.find((o) => o.accepted_at)?.accepted_at ?? null
  const completedAt =
    orders.find((o) => o.status === "completed")?.accepted_at ??
    orders.find((o) => o.status === "completed")?.estimated_delivery_date ??
    null

  return [
    step("created", "Criada", "completed", req.created_at),
    // Sem sent_at no PO — data só quando a etapa tiver timestamp próprio
    step("awaiting_buyer", "Pendente Comprador", buyerStatus, null),
    step("awaiting_supplier", "Aceite Fornecedor", supplierStatus, supplierDoneAt),
    step("completed", "Concluída", doneStatus, completedAt),
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
  const earlyStatuses = ["draft", "pending", "rejected", "cancelled"]
  const buyerStatus = buyerStepStatus(req.status)
  const supplierStatus = supplierStepStatus(req.status)
  const doneStatus = completedStepStatus(req.status)

  const approvalStatus: RequisitionTimelineStepStatus =
    req.status === "draft"
      ? "pending"
      : req.status === "rejected"
        ? "rejected"
        : req.status === "cancelled"
          ? "pending"
          : req.status === "pending"
            ? "active"
            : "completed"

  const quotationStatus: RequisitionTimelineStepStatus =
    earlyStatuses.includes(req.status)
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
            : "active"

  const supplierDoneAt =
    orders.find((o) => o.accepted_at)?.accepted_at ?? null
  const completedAt =
    orders.find((o) => o.status === "completed")?.accepted_at ??
    orders.find((o) => o.status === "completed")?.estimated_delivery_date ??
    null

  const createdStatus: RequisitionTimelineStepStatus =
    req.status === "draft" ? "active" : "completed"

  const baseSteps: RequisitionTimelineStep[] = [
    step(
      "created",
      req.status === "draft" ? "Rascunho" : "Criada",
      createdStatus,
      req.created_at,
    ),
    step("approval", "Aprovação", approvalStatus, req.approved_at ?? null),
    step(
      "quotation",
      "Cotação",
      quotationStatus,
      quotation?.created_at ?? null,
    ),
    step("awaiting_buyer", "Pendente Comprador", buyerStatus, null),
    step(
      "awaiting_supplier",
      "Aceite Fornecedor",
      supplierStatus,
      supplierDoneAt,
    ),
    step("completed", "Concluída", doneStatus, completedAt),
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
