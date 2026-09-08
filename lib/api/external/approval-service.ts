import type { SupabaseClient } from "@supabase/supabase-js"
import { createNotification } from "@/lib/notify"
import { sendEmail } from "@/lib/email/send-email"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import { triggerRequisitionOutbound } from "@/lib/integrations/trigger-requisition-outbound"

export type ApprovalFlow = "requisition" | "order" | "catalog_order"

export type ApprovalRequestRow = {
  id: string
  company_id: string
  flow: ApprovalFlow
  entity_id: string
  approver_id: string | null
  approver_name: string | null
  status: string
  rejection_reason: string | null
  decided_at: string | null
  created_at: string
}

export function mapApprovalToApi(
  row: ApprovalRequestRow,
  entity?: {
    code?: string | null
    external_code?: string | null
    title?: string | null
    status?: string | null
  } | null,
) {
  return {
    id: row.id,
    flow: row.flow,
    status: row.status,
    entity_id: row.entity_id,
    entity_code: entity?.code ?? null,
    entity_external_code: entity?.external_code ?? null,
    entity_title: entity?.title ?? null,
    entity_status: entity?.status ?? null,
    approver_id: row.approver_id,
    approver_name: row.approver_name,
    rejection_reason: row.rejection_reason,
    decided_at: row.decided_at,
    created_at: row.created_at,
  }
}

async function loadEntitySummary(
  service: SupabaseClient,
  companyId: string,
  flow: ApprovalFlow,
  entityId: string,
) {
  if (flow === "requisition") {
    const { data } = await service
      .from("requisitions")
      .select("code, external_code, title, status")
      .eq("company_id", companyId)
      .eq("id", entityId)
      .maybeSingle()
    return data
  }

  const { data } = await service
    .from("purchase_orders")
    .select("code, external_code, status")
    .eq("company_id", companyId)
    .eq("id", entityId)
    .maybeSingle()

  return data
    ? {
        code: data.code,
        external_code: data.external_code,
        title: null as string | null,
        status: data.status,
      }
    : null
}

async function notifyRequisitionDecision(
  service: SupabaseClient,
  companyId: string,
  entityId: string,
  decision: "approved" | "rejected",
  reason?: string,
) {
  const { data: req } = await service
    .from("requisitions")
    .select("requester_id, requester_name, code")
    .eq("id", entityId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (!req?.requester_id) return

  const code = String(req.code ?? "")
  const isApproved = decision === "approved"

  await createNotification(
    {
      userId: req.requester_id,
      companyId,
      type: isApproved ? "requisition.approved" : "requisition.rejected",
      title: isApproved ? "Requisição aprovada" : "Requisição reprovada",
      body: isApproved
        ? `Sua requisição ${code} foi aprovada e está disponível para cotação.`
        : `Sua requisição ${code} foi reprovada. Motivo: ${reason ?? ""}`,
      entity: "requisition",
      entityId,
    },
    service,
  )

  const { data: prefs } = await service
    .from("notification_preferences")
    .select("requisition_approval_email")
    .eq("user_id", req.requester_id)
    .eq("company_id", companyId)
    .maybeSingle()

  const wantsEmail =
    (prefs as { requisition_approval_email?: boolean } | null)
      ?.requisition_approval_email ?? false

  if (!wantsEmail) return

  const { data: authData } = await service.auth.admin.getUserById(req.requester_id)
  const toEmail = authData.user?.email
  if (!toEmail) return

  const subject = isApproved
    ? `Requisição Aprovada — ${code}`
    : `Requisição Reprovada — ${code}`
  const html = isApproved
    ? `<p>Sua requisição <strong>${code}</strong> foi aprovada.</p>
       <p>Ela já está disponível para abertura de cotação.</p>`
    : `<p>Sua requisição <strong>${code}</strong> foi reprovada.</p>
       <p><strong>Motivo:</strong> ${reason ?? ""}</p>`

  await sendEmail({ to: toEmail, subject, html })
}

async function notifyCatalogOrderDecision(
  service: SupabaseClient,
  companyId: string,
  purchaseOrderId: string,
  decision: "approved" | "rejected",
  reason?: string,
) {
  const { data: po } = await service
    .from("purchase_orders")
    .select("code, requisition_code, created_by")
    .eq("id", purchaseOrderId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (!po?.created_by) return

  const code = String(po.code ?? "")
  const isApproved = decision === "approved"

  await createNotification(
    {
      userId: po.created_by,
      companyId,
      type: isApproved ? "order.approved" : "order.rejected",
      title: isApproved
        ? "Pedido do catálogo aprovado"
        : "Pedido do catálogo reprovado",
      body: isApproved
        ? `O pedido ${code} foi aprovado e enviado ao fornecedor.`
        : `O pedido ${code} foi reprovado. Motivo: ${reason ?? ""}`,
      entity: "purchase_order",
      entityId: purchaseOrderId,
    },
    service,
  )
}

async function notifySupplierOrderSent(
  service: SupabaseClient,
  order: {
    id: string
    code: string
    supplier_name: string | null
    company_id: string
    supplier_id: string | null
  },
) {
  if (!order.supplier_id) return

  const { data: supplierProfiles } = await service
    .from("profiles")
    .select("id, full_name")
    .eq("supplier_id", order.supplier_id)
    .eq("company_id", order.company_id)
    .eq("profile_type", "supplier")
    .eq("status", "active")

  for (const supplierProfile of supplierProfiles ?? []) {
    await createNotification(
      {
        userId: supplierProfile.id,
        companyId: order.company_id,
        type: "order.sent",
        title: "Novo pedido de compra recebido",
        body: `O pedido ${order.code} foi emitido para você. Acesse o portal para visualizar e aceitar.`,
        entity: "purchase_order",
        entityId: order.id,
      },
      service,
    )

    const { data: prefs } = await service
      .from("notification_preferences")
      .select("order_approved_email")
      .eq("user_id", supplierProfile.id)
      .eq("company_id", order.company_id)
      .maybeSingle()

    const wantsEmail =
      (prefs as { order_approved_email?: boolean } | null)?.order_approved_email ??
      false
    if (!wantsEmail) continue

    const { data: authData } = await service.auth.admin.getUserById(
      supplierProfile.id,
    )
    const toEmail = authData.user?.email
    if (!toEmail) continue

    await sendEmail({
      to: toEmail,
      subject: `Novo Pedido de Compra — ${order.code}`,
      html: `<p>Olá, <strong>${supplierProfile.full_name ?? order.supplier_name ?? ""}</strong>!</p>
         <p>O pedido <strong>${order.code}</strong> foi emitido para você.</p>
         <p>Acesse o portal do fornecedor para visualizar os detalhes e confirmar o recebimento.</p>`,
    })
  }
}

async function applyPurchaseOrderSendAfterApproval(
  service: SupabaseClient,
  companyId: string,
  purchaseOrderId: string,
  options?: { notifyCatalogRequester?: boolean },
) {
  const { data: po, error: poErr } = await service
    .from("purchase_orders")
    .select("id, code, status, supplier_id, supplier_name, company_id")
    .eq("id", purchaseOrderId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (poErr) {
    return { ok: false as const, message: poErr.message }
  }
  if (!po) {
    return { ok: false as const, message: "Pedido não encontrado." }
  }
  if (po.status !== "draft" && po.status !== "awaiting_approval") {
    return {
      ok: false as const,
      message: `Pedido não está pendente de aprovação (status '${po.status}').`,
    }
  }

  const { error: updErr } = await service
    .from("purchase_orders")
    .update({ status: "sent" })
    .eq("id", purchaseOrderId)
    .eq("company_id", companyId)

  if (updErr) {
    return { ok: false as const, message: updErr.message }
  }

  try {
    await notifySupplierOrderSent(service, {
      id: po.id,
      code: String(po.code ?? ""),
      supplier_name: po.supplier_name,
      company_id: companyId,
      supplier_id: po.supplier_id,
    })
  } catch {
    /* notificação não bloqueia */
  }

  if (options?.notifyCatalogRequester) {
    await notifyCatalogOrderDecision(service, companyId, purchaseOrderId, "approved")
  }
  return { ok: true as const }
}

async function applyCatalogOrderRejection(
  service: SupabaseClient,
  companyId: string,
  purchaseOrderId: string,
  reason: string,
  decidedByName?: string,
) {
  const { data: po, error: poErr } = await service
    .from("purchase_orders")
    .select("id, code, status, requisition_code")
    .eq("id", purchaseOrderId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (poErr) {
    return { ok: false as const, message: poErr.message }
  }
  if (!po) {
    return { ok: false as const, message: "Pedido não encontrado." }
  }

  const requisitionCode =
    typeof po.requisition_code === "string" ? po.requisition_code.trim() : ""

  if (requisitionCode) {
    const { error: reqErr } = await service
      .from("requisitions")
      .update({
        status: "rejected",
        rejection_reason: reason,
        ...(decidedByName?.trim()
          ? { approver_name: decidedByName.trim() }
          : {}),
      })
      .eq("company_id", companyId)
      .eq("code", requisitionCode)

    if (reqErr) {
      return { ok: false as const, message: reqErr.message }
    }
  }

  try {
    await service.rpc("release_contract_balance", { p_order_id: purchaseOrderId })
  } catch {
    /* best-effort */
  }

  const { error: cancelErr } = await service
    .from("purchase_orders")
    .update({
      status: "cancelled",
      cancellation_reason: reason,
      contract_balance_applied: "released",
    })
    .eq("id", purchaseOrderId)
    .eq("company_id", companyId)

  if (cancelErr) {
    return { ok: false as const, message: cancelErr.message }
  }

  await notifyCatalogOrderDecision(
    service,
    companyId,
    purchaseOrderId,
    "rejected",
    reason,
  )
  return { ok: true as const }
}

/** Reprova alçada de Pedido (order): volta o PO para draft para o comprador corrigir. */
async function applyOrderApprovalRejection(
  service: SupabaseClient,
  companyId: string,
  purchaseOrderId: string,
  reason: string,
) {
  const { data: po, error: poErr } = await service
    .from("purchase_orders")
    .select("id, code, status, created_by")
    .eq("id", purchaseOrderId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (poErr) {
    return { ok: false as const, message: poErr.message }
  }
  if (!po) {
    return { ok: false as const, message: "Pedido não encontrado." }
  }
  if (po.status !== "awaiting_approval" && po.status !== "draft") {
    return {
      ok: false as const,
      message: `Pedido não está pendente de aprovação (status '${po.status}').`,
    }
  }

  const { error: updErr } = await service
    .from("purchase_orders")
    .update({
      status: "draft",
      cancellation_reason: reason,
    })
    .eq("id", purchaseOrderId)
    .eq("company_id", companyId)

  if (updErr) {
    return { ok: false as const, message: updErr.message }
  }

  if (po.created_by) {
    await createNotification(
      {
        userId: po.created_by,
        companyId,
        type: "order.rejected",
        title: "Pedido reprovado na alçada",
        body: `O pedido ${po.code ?? ""} foi reprovado e voltou para rascunho. Motivo: ${reason}`,
        entity: "purchase_order",
        entityId: purchaseOrderId,
      },
      service,
    )
  }

  return { ok: true as const }
}

/** @deprecated alias */
const applyCatalogOrderApproval = (
  service: SupabaseClient,
  companyId: string,
  purchaseOrderId: string,
) =>
  applyPurchaseOrderSendAfterApproval(service, companyId, purchaseOrderId, {
    notifyCatalogRequester: true,
  })


/** Cria fila de aprovação ao criar REQ via API (espelha o portal). */
export async function enqueueRequisitionApprovalIfNeeded(
  service: SupabaseClient,
  companyId: string,
  requisitionId: string,
  costCenter: string | null,
): Promise<void> {
  const enabled = await isTenantFeatureEnabled(companyId, "approval_requisition")
  if (!enabled) return

  const { data: approverData } = await service.rpc("get_approver_for_requisition", {
    p_company_id: companyId,
    p_cost_center: costCenter ?? "*",
  })

  const approver = Array.isArray(approverData) ? approverData[0] : approverData
  if (!approver?.approver_id) return

  await service.from("approval_requests").insert({
    company_id: companyId,
    flow: "requisition",
    entity_id: requisitionId,
    approver_id: approver.approver_id,
    approver_name: approver.approver_name ?? null,
    status: "pending",
  })
}

export async function approveApprovalRequest(
  service: SupabaseClient,
  companyId: string,
  requestId: string,
  options?: { decidedByName?: string },
) {
  const { data: row, error } = await service
    .from("approval_requests")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", requestId)
    .maybeSingle()

  if (error) {
    return { ok: false as const, code: "INTERNAL_ERROR" as const, message: error.message }
  }
  if (!row) {
    return { ok: false as const, code: "NOT_FOUND" as const }
  }

  const flow = row.flow as ApprovalFlow
  if (row.status !== "pending") {
    return {
      ok: false as const,
      code: "CONFLICT" as const,
      message: `Solicitação já decidida (status '${row.status}').`,
    }
  }

  if (flow === "order") {
    const featureOk = await isTenantFeatureEnabled(companyId, "approval_order")
    if (!featureOk) {
      return {
        ok: false as const,
        code: "FORBIDDEN" as const,
        message: "Módulo de aprovação de pedidos desabilitado.",
      }
    }

    const decidedAt = new Date().toISOString()
    const { error: updErr } = await service
      .from("approval_requests")
      .update({ status: "approved", decided_at: decidedAt })
      .eq("id", requestId)
      .eq("company_id", companyId)

    if (updErr) {
      return {
        ok: false as const,
        code: "INTERNAL_ERROR" as const,
        message: updErr.message,
      }
    }

    const applied = await applyPurchaseOrderSendAfterApproval(
      service,
      companyId,
      row.entity_id as string,
    )
    if (!applied.ok) {
      return {
        ok: false as const,
        code: "INTERNAL_ERROR" as const,
        message: applied.message,
      }
    }

    const entity = await loadEntitySummary(
      service,
      companyId,
      flow,
      row.entity_id as string,
    )

    return {
      ok: true as const,
      approval: mapApprovalToApi(
        {
          ...(row as ApprovalRequestRow),
          status: "approved",
          decided_at: decidedAt,
        },
        entity,
      ),
      entity_fully_approved: true,
    }
  }

  if (flow === "catalog_order") {
    const featureOk = await isTenantFeatureEnabled(
      companyId,
      "approval_catalog_order",
    )
    if (!featureOk) {
      return {
        ok: false as const,
        code: "FORBIDDEN" as const,
        message: "Módulo de aprovação de pedido do catálogo desabilitado.",
      }
    }

    const decidedAt = new Date().toISOString()
    const { error: updErr } = await service
      .from("approval_requests")
      .update({ status: "approved", decided_at: decidedAt })
      .eq("id", requestId)
      .eq("company_id", companyId)

    if (updErr) {
      return {
        ok: false as const,
        code: "INTERNAL_ERROR" as const,
        message: updErr.message,
      }
    }

    const applied = await applyCatalogOrderApproval(
      service,
      companyId,
      row.entity_id as string,
    )
    if (!applied.ok) {
      return {
        ok: false as const,
        code: "INTERNAL_ERROR" as const,
        message: applied.message,
      }
    }

    const entity = await loadEntitySummary(
      service,
      companyId,
      flow,
      row.entity_id as string,
    )

    return {
      ok: true as const,
      approval: mapApprovalToApi(
        {
          ...(row as ApprovalRequestRow),
          status: "approved",
          decided_at: decidedAt,
        },
        entity,
      ),
      entity_fully_approved: true,
    }
  }

  const featureOk = await isTenantFeatureEnabled(companyId, "approval_requisition")
  if (!featureOk) {
    return {
      ok: false as const,
      code: "FORBIDDEN" as const,
      message: "Módulo de aprovação de requisições desabilitado.",
    }
  }

  const decidedAt = new Date().toISOString()
  const { error: updErr } = await service
    .from("approval_requests")
    .update({ status: "approved", decided_at: decidedAt })
    .eq("id", requestId)
    .eq("company_id", companyId)

  if (updErr) {
    return { ok: false as const, code: "INTERNAL_ERROR" as const, message: updErr.message }
  }

  const { data: siblings } = await service
    .from("approval_requests")
    .select("status")
    .eq("entity_id", row.entity_id)
    .eq("flow", flow)
    .eq("company_id", companyId)

  const statuses = (siblings ?? []) as { status: string }[]
  const total = statuses.filter((r) => r.status !== "rejected").length
  const approved = statuses.filter((r) => r.status === "approved").length
  const isAllApproved = total > 0 && total === approved

  let entityApproved = false
  if (isAllApproved) {
    const approverName = options?.decidedByName?.trim() || row.approver_name || "API / ERP"
    const { error: entityErr } = await service
      .from("requisitions")
      .update({
        status: "approved",
        approved_at: decidedAt,
        approver_name: approverName,
      })
      .eq("id", row.entity_id)
      .eq("company_id", companyId)

    if (entityErr) {
      return { ok: false as const, code: "INTERNAL_ERROR" as const, message: entityErr.message }
    }
    entityApproved = true
    await notifyRequisitionDecision(service, companyId, row.entity_id as string, "approved")
    triggerRequisitionOutbound(
      companyId,
      row.entity_id as string,
      "requisition.approved",
    )
  }

  const entity = await loadEntitySummary(
    service,
    companyId,
    flow,
    row.entity_id as string,
  )

  return {
    ok: true as const,
    approval: mapApprovalToApi(
      { ...(row as ApprovalRequestRow), status: "approved", decided_at: decidedAt },
      entity,
    ),
    entity_fully_approved: entityApproved,
  }
}

export async function rejectApprovalRequest(
  service: SupabaseClient,
  companyId: string,
  requestId: string,
  reason: string,
  options?: { decidedByName?: string },
) {
  const trimmed = reason.trim()
  if (!trimmed) {
    return {
      ok: false as const,
      code: "VALIDATION_ERROR" as const,
      message: "Campo reason é obrigatório.",
    }
  }

  const { data: row, error } = await service
    .from("approval_requests")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", requestId)
    .maybeSingle()

  if (error) {
    return { ok: false as const, code: "INTERNAL_ERROR" as const, message: error.message }
  }
  if (!row) {
    return { ok: false as const, code: "NOT_FOUND" as const }
  }

  const flow = row.flow as ApprovalFlow
  if (row.status !== "pending") {
    return {
      ok: false as const,
      code: "CONFLICT" as const,
      message: `Solicitação já decidida (status '${row.status}').`,
    }
  }

  if (flow === "order") {
    const featureOk = await isTenantFeatureEnabled(companyId, "approval_order")
    if (!featureOk) {
      return {
        ok: false as const,
        code: "FORBIDDEN" as const,
        message: "Módulo de aprovação de pedidos desabilitado.",
      }
    }

    const decidedAt = new Date().toISOString()
    const { error: updErr } = await service
      .from("approval_requests")
      .update({
        status: "rejected",
        rejection_reason: trimmed,
        decided_at: decidedAt,
      })
      .eq("id", requestId)
      .eq("company_id", companyId)

    if (updErr) {
      return {
        ok: false as const,
        code: "INTERNAL_ERROR" as const,
        message: updErr.message,
      }
    }

    const applied = await applyOrderApprovalRejection(
      service,
      companyId,
      row.entity_id as string,
      trimmed,
    )
    if (!applied.ok) {
      return {
        ok: false as const,
        code: "INTERNAL_ERROR" as const,
        message: applied.message,
      }
    }

    const entity = await loadEntitySummary(
      service,
      companyId,
      flow,
      row.entity_id as string,
    )

    return {
      ok: true as const,
      approval: mapApprovalToApi(
        {
          ...(row as ApprovalRequestRow),
          status: "rejected",
          rejection_reason: trimmed,
          decided_at: decidedAt,
        },
        entity,
      ),
    }
  }

  if (flow === "catalog_order") {
    const featureOk = await isTenantFeatureEnabled(
      companyId,
      "approval_catalog_order",
    )
    if (!featureOk) {
      return {
        ok: false as const,
        code: "FORBIDDEN" as const,
        message: "Módulo de aprovação de pedido do catálogo desabilitado.",
      }
    }

    const decidedAt = new Date().toISOString()
    const { error: updErr } = await service
      .from("approval_requests")
      .update({
        status: "rejected",
        rejection_reason: trimmed,
        decided_at: decidedAt,
      })
      .eq("id", requestId)
      .eq("company_id", companyId)

    if (updErr) {
      return {
        ok: false as const,
        code: "INTERNAL_ERROR" as const,
        message: updErr.message,
      }
    }

    const applied = await applyCatalogOrderRejection(
      service,
      companyId,
      row.entity_id as string,
      trimmed,
      options?.decidedByName,
    )
    if (!applied.ok) {
      return {
        ok: false as const,
        code: "INTERNAL_ERROR" as const,
        message: applied.message,
      }
    }

    const entity = await loadEntitySummary(
      service,
      companyId,
      flow,
      row.entity_id as string,
    )

    return {
      ok: true as const,
      approval: mapApprovalToApi(
        {
          ...(row as ApprovalRequestRow),
          status: "rejected",
          rejection_reason: trimmed,
          decided_at: decidedAt,
        },
        entity,
      ),
    }
  }

  const featureOk = await isTenantFeatureEnabled(companyId, "approval_requisition")
  if (!featureOk) {
    return {
      ok: false as const,
      code: "FORBIDDEN" as const,
      message: "Módulo de aprovação de requisições desabilitado.",
    }
  }

  const decidedAt = new Date().toISOString()
  const { error: updErr } = await service
    .from("approval_requests")
    .update({
      status: "rejected",
      rejection_reason: trimmed,
      decided_at: decidedAt,
    })
    .eq("id", requestId)
    .eq("company_id", companyId)

  if (updErr) {
    return { ok: false as const, code: "INTERNAL_ERROR" as const, message: updErr.message }
  }

  const { error: entityErr } = await service
    .from("requisitions")
    .update({
      status: "rejected",
      rejection_reason: trimmed,
      ...(options?.decidedByName?.trim()
        ? { approver_name: options.decidedByName.trim() }
        : {}),
    })
    .eq("id", row.entity_id)
    .eq("company_id", companyId)

  if (entityErr) {
    return { ok: false as const, code: "INTERNAL_ERROR" as const, message: entityErr.message }
  }

  await notifyRequisitionDecision(
    service,
    companyId,
    row.entity_id as string,
    "rejected",
    trimmed,
  )
  triggerRequisitionOutbound(
    companyId,
    row.entity_id as string,
    "requisition.rejected",
  )

  const entity = await loadEntitySummary(
    service,
    companyId,
    flow,
    row.entity_id as string,
  )

  return {
    ok: true as const,
    approval: mapApprovalToApi(
      {
        ...(row as ApprovalRequestRow),
        status: "rejected",
        rejection_reason: trimmed,
        decided_at: decidedAt,
      },
      entity,
    ),
  }
}

export async function getApprovalRequest(
  service: SupabaseClient,
  companyId: string,
  requestId: string,
) {
  const { data: row, error } = await service
    .from("approval_requests")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", requestId)
    .maybeSingle()

  if (error) {
    return { ok: false as const, code: "INTERNAL_ERROR" as const, message: error.message }
  }
  if (!row) {
    return { ok: false as const, code: "NOT_FOUND" as const }
  }

  const entity = await loadEntitySummary(
    service,
    companyId,
    row.flow as ApprovalFlow,
    row.entity_id as string,
  )

  return {
    ok: true as const,
    approval: mapApprovalToApi(row as ApprovalRequestRow, entity),
  }
}
