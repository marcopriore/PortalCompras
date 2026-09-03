import type { SupabaseClient } from "@supabase/supabase-js"
import { createNotification } from "@/lib/notify"
import { sendEmail } from "@/lib/email/send-email"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import { triggerRequisitionOutbound } from "@/lib/integrations/trigger-requisition-outbound"

export type ApprovalFlow = "requisition" | "order"

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
  if (flow === "order") {
    return {
      ok: false as const,
      code: "FORBIDDEN" as const,
      message:
        "Aprovação de pedido via API ainda não é suportada (fluxo incompleto no portal).",
    }
  }

  if (row.status !== "pending") {
    return {
      ok: false as const,
      code: "CONFLICT" as const,
      message: `Solicitação já decidida (status '${row.status}').`,
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
  if (flow === "order") {
    return {
      ok: false as const,
      code: "FORBIDDEN" as const,
      message:
        "Reprovação de pedido via API ainda não é suportada (fluxo incompleto no portal).",
    }
  }

  if (row.status !== "pending") {
    return {
      ok: false as const,
      code: "CONFLICT" as const,
      message: `Solicitação já decidida (status '${row.status}').`,
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
