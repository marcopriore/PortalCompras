import type { SupabaseClient } from "@supabase/supabase-js"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import {
  mapRequisitionToApi,
  type RequisitionItemRow,
} from "@/lib/api/external/mappers/requisition"
import {
  parseRequisitionWriteInput,
  requisitionHeaderToRow,
  requisitionItemsToRows,
  REQUISITION_CANCELLABLE_STATUSES,
  REQUISITION_EDITABLE_STATUSES,
  type RequisitionWriteInput,
} from "@/lib/api/external/validators/requisition-write"

async function generateRequisitionCode(
  service: SupabaseClient,
  companyId: string,
): Promise<string> {
  const { count } = await service
    .from("requisitions")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)

  return `REQ-${String((count ?? 0) + 1).padStart(4, "0")}`
}

async function resolveInitialStatus(
  service: SupabaseClient,
  companyId: string,
): Promise<"pending" | "approved"> {
  const approvalEnabled = await isTenantFeatureEnabled(companyId, "approval_requisition")
  return approvalEnabled ? "pending" : "approved"
}

async function loadRequisitionWithItems(
  service: SupabaseClient,
  requisitionId: string,
) {
  const { data: row } = await service
    .from("requisitions")
    .select("*")
    .eq("id", requisitionId)
    .single()

  if (!row) return null

  const { data: items } = await service
    .from("requisition_items")
    .select(
      "id, material_code, material_description, quantity, unit_of_measure, estimated_price, commodity_group, observations",
    )
    .eq("requisition_id", requisitionId)
    .order("created_at", { ascending: true })

  return mapRequisitionToApi(row, (items ?? []) as RequisitionItemRow[])
}

export async function createRequisitionFromApi(
  service: SupabaseClient,
  companyId: string,
  input: RequisitionWriteInput,
) {
  const { data: existing } = await service
    .from("requisitions")
    .select("id")
    .eq("company_id", companyId)
    .eq("external_code", input.external_code)
    .maybeSingle()

  if (existing) {
    return { ok: false as const, code: "CONFLICT" as const, external_code: input.external_code }
  }

  const code = await generateRequisitionCode(service, companyId)
  const status = await resolveInitialStatus(service, companyId)

  const header = requisitionHeaderToRow(companyId, input, code, status)
  if (status === "approved") {
    Object.assign(header, {
      approved_at: new Date().toISOString(),
      approver_name: "Aprovação automática (fluxo desabilitado)",
    })
  }

  const { data: created, error } = await service
    .from("requisitions")
    .insert(header)
    .select("*")
    .single()

  if (error || !created) {
    return { ok: false as const, code: "INTERNAL_ERROR" as const, message: error?.message }
  }

  const itemRows = requisitionItemsToRows(companyId, created.id as string, input.items)
  const { error: itemsError } = await service.from("requisition_items").insert(itemRows)

  if (itemsError) {
    await service.from("requisitions").delete().eq("id", created.id)
    return { ok: false as const, code: "INTERNAL_ERROR" as const, message: itemsError.message }
  }

  if (status === "pending") {
    const { enqueueRequisitionApprovalIfNeeded } = await import(
      "@/lib/api/external/approval-service"
    )
    await enqueueRequisitionApprovalIfNeeded(
      service,
      companyId,
      created.id as string,
      input.cost_center ?? null,
    )
  }

  const requisition = await loadRequisitionWithItems(service, created.id as string)
  return { ok: true as const, requisition, status }
}

export async function updateRequisitionFromApi(
  service: SupabaseClient,
  companyId: string,
  requisitionId: string,
  input: RequisitionWriteInput,
) {
  const { data: current, error: loadError } = await service
    .from("requisitions")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", requisitionId)
    .maybeSingle()

  if (loadError) {
    return { ok: false as const, code: "INTERNAL_ERROR" as const, message: loadError.message }
  }
  if (!current) {
    return { ok: false as const, code: "NOT_FOUND" as const }
  }

  if (!REQUISITION_EDITABLE_STATUSES.has(String(current.status))) {
    return {
      ok: false as const,
      code: "FORBIDDEN" as const,
      message: `Requisição não editável no status '${current.status}'.`,
    }
  }

  if (input.external_code !== current.external_code) {
    const { data: duplicate } = await service
      .from("requisitions")
      .select("id")
      .eq("company_id", companyId)
      .eq("external_code", input.external_code)
      .neq("id", requisitionId)
      .maybeSingle()

    if (duplicate) {
      return { ok: false as const, code: "CONFLICT" as const, external_code: input.external_code }
    }
  }

  const nextStatus = String(current.status) === "rejected" ? "pending" : String(current.status)

  const { error: updateError } = await service
    .from("requisitions")
    .update({
      external_code: input.external_code,
      title: input.title,
      description: input.description,
      cost_center: input.cost_center,
      needed_by: input.needed_by,
      priority: input.priority,
      requester_name: input.requester_name,
      status: nextStatus,
      rejection_reason: nextStatus === "pending" ? null : current.rejection_reason,
    })
    .eq("id", requisitionId)
    .eq("company_id", companyId)

  if (updateError) {
    return { ok: false as const, code: "INTERNAL_ERROR" as const, message: updateError.message }
  }

  const { error: deleteError } = await service
    .from("requisition_items")
    .delete()
    .eq("requisition_id", requisitionId)

  if (deleteError) {
    return { ok: false as const, code: "INTERNAL_ERROR" as const, message: deleteError.message }
  }

  const itemRows = requisitionItemsToRows(companyId, requisitionId, input.items)
  const { error: itemsError } = await service.from("requisition_items").insert(itemRows)

  if (itemsError) {
    return { ok: false as const, code: "INTERNAL_ERROR" as const, message: itemsError.message }
  }

  const requisition = await loadRequisitionWithItems(service, requisitionId)
  return { ok: true as const, requisition }
}

export async function cancelRequisitionFromApi(
  service: SupabaseClient,
  companyId: string,
  requisitionId: string,
) {
  const { data: current, error: loadError } = await service
    .from("requisitions")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", requisitionId)
    .maybeSingle()

  if (loadError) {
    return { ok: false as const, code: "INTERNAL_ERROR" as const, message: loadError.message }
  }
  if (!current) {
    return { ok: false as const, code: "NOT_FOUND" as const }
  }

  const status = String(current.status)
  if (status === "cancelled") {
    return { ok: false as const, code: "CONFLICT" as const, message: "Requisição já cancelada." }
  }
  if (!REQUISITION_CANCELLABLE_STATUSES.has(status)) {
    return {
      ok: false as const,
      code: "FORBIDDEN" as const,
      message: `Requisição não pode ser cancelada no status '${status}'.`,
    }
  }

  const { error } = await service
    .from("requisitions")
    .update({ status: "cancelled" })
    .eq("id", requisitionId)
    .eq("company_id", companyId)

  if (error) {
    return { ok: false as const, code: "INTERNAL_ERROR" as const, message: error.message }
  }

  const requisition = await loadRequisitionWithItems(service, requisitionId)
  return { ok: true as const, requisition }
}

export { parseRequisitionWriteInput }
