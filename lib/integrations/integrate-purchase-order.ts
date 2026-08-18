import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import {
  buildErpErrorMessage,
  duplicateExternalCodeMessage,
  erpHttpErrorMessage,
  ERP_ERROR_KIND,
  parseErpErrorMessage,
  statusForErpErrorKind,
  type PurchaseOrderIntegrationStatus,
} from "@/lib/integrations/erp-errors"
import { dispatchOutboundIntegration } from "@/lib/integrations/dispatch"
import { loadPurchaseOrderOutboundPayload } from "@/lib/integrations/trigger-outbound"

export type IntegratePurchaseOrderResult = {
  success: boolean
  skipped: boolean
  status: "processing" | "completed" | "error" | "integration_error"
  externalCode?: string | null
  errorMessage?: string | null
}

const INTEGRATABLE_STATUSES = new Set(["processing", "error", "integration_error"])

type ServiceClient = ReturnType<typeof createServiceRoleClient>

async function updatePurchaseOrder(
  service: ServiceClient,
  orderId: string,
  companyId: string,
  patch: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  const { error } = await service
    .from("purchase_orders")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("company_id", companyId)

  if (!error) return { ok: true }

  return { ok: false, message: error.message, code: error.code }
}

function formatPersistError(
  message: string,
  context?: { externalCode?: string | null; code?: string },
): string {
  if (context?.code === "23505" && context.externalCode) {
    return duplicateExternalCodeMessage(context.externalCode)
  }
  return buildErpErrorMessage(
    ERP_ERROR_KIND.PERSIST,
    `Falha ao atualizar o pedido após integração: ${message}`,
  )
}

function failureStatusForMessage(message: string): PurchaseOrderIntegrationStatus {
  const { kind } = parseErpErrorMessage(message)
  return kind ? statusForErpErrorKind(kind) : "integration_error"
}

async function markIntegrationFailure(
  service: ServiceClient,
  orderId: string,
  companyId: string,
  message: string,
): Promise<PurchaseOrderIntegrationStatus> {
  const status = failureStatusForMessage(message)
  await updatePurchaseOrder(service, orderId, companyId, {
    status,
    erp_error_message: message,
  })
  return status
}

export async function integratePurchaseOrderWithErp(
  companyId: string,
  orderId: string,
): Promise<IntegratePurchaseOrderResult> {
  const service = createServiceRoleClient()

  const { data: order, error: loadError } = await service
    .from("purchase_orders")
    .select("id, status, company_id")
    .eq("id", orderId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (loadError || !order) {
    return {
      success: false,
      skipped: false,
      status: "integration_error",
      errorMessage: "Pedido não encontrado.",
    }
  }

  if (!INTEGRATABLE_STATUSES.has(String(order.status))) {
    return {
      success: false,
      skipped: false,
      status: String(order.status) as IntegratePurchaseOrderResult["status"],
      errorMessage: "Pedido não está elegível para integração com o ERP.",
    }
  }

  const enabled = await isTenantFeatureEnabled(companyId, "api_integrations")
  if (!enabled) {
    const skipUpdate = await updatePurchaseOrder(service, orderId, companyId, {
      status: "completed",
      erp_error_message: null,
    })
    if (!skipUpdate.ok) {
      return {
        success: false,
        skipped: true,
        status: "processing",
        errorMessage: formatPersistError(skipUpdate.message),
      }
    }

    return { success: true, skipped: true, status: "completed" }
  }

  const processingUpdate = await updatePurchaseOrder(service, orderId, companyId, {
    status: "processing",
    erp_error_message: null,
  })
  if (!processingUpdate.ok) {
    const errorMessage = formatPersistError(processingUpdate.message)
    const status = await markIntegrationFailure(service, orderId, companyId, errorMessage)
    return {
      success: false,
      skipped: false,
      status,
      errorMessage,
    }
  }

  const payload = await loadPurchaseOrderOutboundPayload(companyId, orderId)
  if (!payload) {
    const message = buildErpErrorMessage(
      ERP_ERROR_KIND.PAYLOAD,
      "Não foi possível montar o payload do pedido.",
    )
    const status = await markIntegrationFailure(service, orderId, companyId, message)
    return { success: false, skipped: false, status, errorMessage: message }
  }

  const result = await dispatchOutboundIntegration({
    companyId,
    action: "purchase_order.create",
    entity: "purchase_orders",
    entityId: orderId,
    entityCode: payload.code,
    payload,
  })

  if (result.success) {
    const completedUpdate = await updatePurchaseOrder(service, orderId, companyId, {
      status: "completed",
      external_code: result.externalCode ?? null,
      erp_error_message: null,
    })

    if (!completedUpdate.ok) {
      const errorMessage = formatPersistError(completedUpdate.message, {
        externalCode: result.externalCode,
        code: completedUpdate.code,
      })
      const status = await markIntegrationFailure(service, orderId, companyId, errorMessage)

      return {
        success: false,
        skipped: false,
        status,
        errorMessage,
      }
    }

    return {
      success: true,
      skipped: false,
      status: "completed",
      externalCode: result.externalCode ?? null,
    }
  }

  const errorMessage =
    result.errorMessage != null
      ? buildErpErrorMessage(ERP_ERROR_KIND.ERP_HTTP, result.errorMessage)
      : result.responseStatus != null
        ? erpHttpErrorMessage(result.responseStatus)
        : buildErpErrorMessage(
            ERP_ERROR_KIND.ERP_HTTP,
            "Falha na integração com o ERP.",
          )

  const status = await markIntegrationFailure(service, orderId, companyId, errorMessage)

  return {
    success: false,
    skipped: false,
    status,
    errorMessage,
  }
}
