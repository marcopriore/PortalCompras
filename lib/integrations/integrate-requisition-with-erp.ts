import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import { loadTenantFeatureConfig } from "@/lib/settings/tenant-feature-settings"
import { companyAllowsOutboundCapability } from "@/lib/settings/tenant-api-capabilities"
import { duplicateExternalCodeMessage } from "@/lib/integrations/erp-errors"
import { dispatchOutboundIntegration } from "@/lib/integrations/dispatch"
import { loadRequisitionOutboundPayload } from "@/lib/integrations/trigger-outbound"
import type { OutboundIntegrationAction } from "@/lib/integrations/types"

export type RequisitionIntegrationAction = Extract<
  OutboundIntegrationAction,
  | "requisition.created"
  | "requisition.updated"
  | "requisition.approved"
  | "requisition.rejected"
  | "requisition.cancelled"
>

export type IntegrateRequisitionResult = {
  success: boolean
  skipped: boolean
  action: RequisitionIntegrationAction
  externalCode?: string | null
  errorMessage?: string | null
  persistError?: boolean
}

type ServiceClient = ReturnType<typeof createServiceRoleClient>

const REQUISITION_ACTIONS = new Set<string>([
  "requisition.created",
  "requisition.updated",
  "requisition.approved",
  "requisition.rejected",
  "requisition.cancelled",
])

export function isRequisitionIntegrationAction(
  action: string,
): action is RequisitionIntegrationAction {
  return REQUISITION_ACTIONS.has(action)
}

async function persistExternalCode(
  service: ServiceClient,
  companyId: string,
  requisitionId: string,
  externalCode: string,
): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  const { error } = await service
    .from("requisitions")
    .update({
      external_code: externalCode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requisitionId)
    .eq("company_id", companyId)
    .is("external_code", null)

  if (!error) return { ok: true }
  return { ok: false, message: error.message, code: error.code }
}

export async function integrateRequisitionWithErp(
  companyId: string,
  requisitionId: string,
  action: RequisitionIntegrationAction,
): Promise<IntegrateRequisitionResult> {
  const enabled = await isTenantFeatureEnabled(companyId, "api_integrations")
  if (!enabled) {
    return { success: true, skipped: true, action }
  }

  const service = createServiceRoleClient()
  const featureConfig = await loadTenantFeatureConfig(service, companyId)
  if (
    !featureConfig.erpIntegrationEnabled ||
    !(await companyAllowsOutboundCapability(service, companyId, action))
  ) {
    return { success: true, skipped: true, action }
  }

  const { data: existing } = await service
    .from("requisitions")
    .select("id")
    .eq("id", requisitionId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (!existing) {
    return {
      success: false,
      skipped: false,
      action,
      errorMessage: "Requisição não encontrada.",
    }
  }

  const payload = await loadRequisitionOutboundPayload(companyId, requisitionId)
  if (!payload) {
    return {
      success: false,
      skipped: false,
      action,
      errorMessage: "Não foi possível montar o payload da requisição.",
    }
  }

  const result = await dispatchOutboundIntegration({
    companyId,
    action,
    entity: "requisitions",
    entityId: requisitionId,
    entityCode: payload.code,
    payload,
  })

  if (!result.success) {
    return {
      success: false,
      skipped: false,
      action,
      errorMessage:
        result.errorMessage ??
        (result.responseStatus != null
          ? `ERP respondeu ${result.responseStatus}`
          : "Falha na integração com o ERP."),
    }
  }

  if (action === "requisition.created" && result.externalCode) {
    const persist = await persistExternalCode(
      service,
      companyId,
      requisitionId,
      result.externalCode,
    )

    if (!persist.ok) {
      const errorMessage =
        persist.code === "23505"
          ? duplicateExternalCodeMessage(result.externalCode)
          : `Falha ao gravar código ERP na requisição: ${persist.message}`

      return {
        success: false,
        skipped: false,
        action,
        externalCode: result.externalCode,
        errorMessage,
        persistError: true,
      }
    }
  }

  return {
    success: true,
    skipped: false,
    action,
    externalCode: result.externalCode ?? null,
  }
}
