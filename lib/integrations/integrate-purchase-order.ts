import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import { loadTenantFeatureConfig } from "@/lib/settings/tenant-feature-settings"
import { companyAllowsOutboundCapability } from "@/lib/settings/tenant-api-capabilities"
import { logAuditServer } from "@/lib/audit-server"
import {
  buildErpErrorMessage,
  buildOutboundDispatchFailureMessage,
  duplicateExternalCodeMessage,
  ERP_ERROR_KIND,
  parseErpErrorMessage,
  statusForErpErrorKind,
  type PurchaseOrderIntegrationStatus,
} from "@/lib/integrations/erp-errors"
import {
  isOutboundAutoRetryExhausted,
  isTransientOutboundFailure,
  outboundAutoRetryDelayMs,
} from "@/lib/integrations/outbound-auto-retry"
import { dispatchOutboundIntegration } from "@/lib/integrations/dispatch"
import { loadPurchaseOrderOutboundPayload } from "@/lib/integrations/trigger-outbound"
import type { OutboundIntegrationAction } from "@/lib/integrations/types"
import {
  outboundActionToPurchaseOrderOperation,
  type PurchaseOrderErpOperation,
} from "@/lib/integrations/purchase-order-operations"

export type { PurchaseOrderErpOperation }
export { outboundActionToPurchaseOrderOperation }

export type IntegratePurchaseOrderResult = {
  success: boolean
  skipped: boolean
  status:
    | "processing"
    | "completed"
    | "error"
    | "integration_error"
    | "cancelled"
  externalCode?: string | null
  errorMessage?: string | null
}

const OPERATION_ACTION: Record<PurchaseOrderErpOperation, OutboundIntegrationAction> = {
  create: "purchase_order.create",
  update: "purchase_order.update",
  delete: "purchase_order.delete",
}

const INTEGRATABLE_STATUSES: Record<PurchaseOrderErpOperation, Set<string>> = {
  create: new Set(["processing", "error", "integration_error"]),
  update: new Set(["processing", "error", "integration_error"]),
  delete: new Set(["completed", "integration_error"]),
}

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

function failureStatusForMessage(
  operation: PurchaseOrderErpOperation,
  message: string,
): PurchaseOrderIntegrationStatus {
  if (operation === "delete") return "integration_error"
  const { kind } = parseErpErrorMessage(message)
  return kind ? statusForErpErrorKind(kind) : "integration_error"
}

async function markIntegrationFailure(
  service: ServiceClient,
  orderId: string,
  companyId: string,
  operation: PurchaseOrderErpOperation,
  message: string,
  previousStatus?: string | null,
): Promise<PurchaseOrderIntegrationStatus> {
  const status = failureStatusForMessage(operation, message)
  const { data: orderMeta } = await service
    .from("purchase_orders")
    .select("code")
    .eq("id", orderId)
    .eq("company_id", companyId)
    .maybeSingle()

  await updatePurchaseOrder(service, orderId, companyId, {
    status,
    erp_error_message: message,
  })

  if (status === "integration_error") {
    const { notifyIntegrationError } = await import(
      "@/lib/integrations/notify-integration-error"
    )
    void notifyIntegrationError({
      companyId,
      entity: "purchase_order",
      entityId: orderId,
      code: orderMeta?.code != null ? String(orderMeta.code) : orderId,
      message,
      previousStatus: previousStatus ?? null,
    })
  }

  return status
}

function buildDispatchErrorMessage(
  operation: PurchaseOrderErpOperation,
  result: {
    errorMessage?: string | null
    responseStatus?: number | null
    responseBody?: string | null
  },
): string {
  const transient = isTransientOutboundFailure({
    responseStatus: result.responseStatus ?? null,
    errorMessage: result.errorMessage,
  })
  const fallback =
    operation === "delete"
      ? "Falha ao cancelar o pedido no ERP."
      : operation === "update"
        ? "Falha ao atualizar o pedido no ERP."
        : "Falha na integração com o ERP."
  return buildOutboundDispatchFailureMessage(result, fallback, transient)
}

async function auditAutoRetryScheduled(input: {
  companyId: string
  orderId: string
  code?: string | null
  operation: PurchaseOrderErpOperation
  attempts: number
  errorMessage: string
  responseStatus: number | null
}): Promise<void> {
  const delay = outboundAutoRetryDelayMs(input.attempts)
  await logAuditServer({
    eventType: "integration.auto_retry_scheduled",
    companyId: input.companyId,
    entity: "purchase_orders",
    entityId: input.orderId,
    description: `Auto-retry agendado para pedido ${input.code ?? input.orderId} (${input.operation}) após tentativa ${input.attempts}${delay != null ? ` — próxima em ${Math.round(delay / 1000)}s` : ""}.`,
    metadata: {
      operation: input.operation,
      attempts: input.attempts,
      delayMs: delay,
      responseStatus: input.responseStatus,
      errorMessage: input.errorMessage,
      trigger: "transient_failure",
    },
  })
}

async function auditAutoRetryExhausted(input: {
  companyId: string
  orderId: string
  code?: string | null
  operation: PurchaseOrderErpOperation
  attempts: number
  errorMessage: string
}): Promise<void> {
  await logAuditServer({
    eventType: "integration.auto_retry_exhausted",
    companyId: input.companyId,
    entity: "purchase_orders",
    entityId: input.orderId,
    description: `Auto-retry esgotado para pedido ${input.code ?? input.orderId} (${input.operation}) após ${input.attempts} tentativas — intervenção manual no Monitor.`,
    metadata: {
      operation: input.operation,
      attempts: input.attempts,
      errorMessage: input.errorMessage,
    },
  })
}

export async function integratePurchaseOrderWithErp(
  companyId: string,
  orderId: string,
  operation: PurchaseOrderErpOperation = "create",
  options?: { cancellationReason?: string | null },
): Promise<IntegratePurchaseOrderResult> {
  const service = createServiceRoleClient()

  const { data: order, error: loadError } = await service
    .from("purchase_orders")
    .select("id, status, company_id, external_code")
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

  const currentStatus = String(order.status)
  if (!INTEGRATABLE_STATUSES[operation].has(currentStatus)) {
    return {
      success: false,
      skipped: false,
      status: currentStatus as IntegratePurchaseOrderResult["status"],
      errorMessage: "Pedido não está elegível para integração com o ERP.",
    }
  }

  const enabled = await isTenantFeatureEnabled(companyId, "api_integrations")
  if (!enabled) {
    if (operation === "create") {
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

    if (operation === "update") {
      return { success: true, skipped: true, status: "completed" }
    }

    const cancelUpdate = await updatePurchaseOrder(service, orderId, companyId, {
      status: "cancelled",
      cancellation_reason:
        options?.cancellationReason?.trim() || "Pedido cancelado pelo comprador",
      erp_error_message: null,
    })
    if (!cancelUpdate.ok) {
      return {
        success: false,
        skipped: true,
        status: "completed",
        errorMessage: formatPersistError(cancelUpdate.message),
      }
    }
    return { success: true, skipped: true, status: "cancelled" }
  }

  const featureConfig = await loadTenantFeatureConfig(service, companyId)
  const action = OPERATION_ACTION[operation]
  const outboundAllowed =
    featureConfig.erpIntegrationEnabled &&
    (await companyAllowsOutboundCapability(service, companyId, action))

  if (!outboundAllowed) {
    if (operation === "create") {
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

    if (operation === "update") {
      return { success: true, skipped: true, status: "completed" }
    }

    const cancelUpdate = await updatePurchaseOrder(service, orderId, companyId, {
      status: "cancelled",
      cancellation_reason:
        options?.cancellationReason?.trim() || "Pedido cancelado pelo comprador",
      erp_error_message: null,
    })
    if (!cancelUpdate.ok) {
      return {
        success: false,
        skipped: true,
        status: "completed",
        errorMessage: formatPersistError(cancelUpdate.message),
      }
    }
    return { success: true, skipped: true, status: "cancelled" }
  }

  if (operation === "create") {
    const processingUpdate = await updatePurchaseOrder(service, orderId, companyId, {
      status: "processing",
      erp_error_message: null,
    })
    if (!processingUpdate.ok) {
      const errorMessage = formatPersistError(processingUpdate.message)
      const status = await markIntegrationFailure(
        service,
        orderId,
        companyId,
        operation,
        errorMessage,
        currentStatus,
      )
      return { success: false, skipped: false, status, errorMessage }
    }
  }

  const payload = await loadPurchaseOrderOutboundPayload(companyId, orderId)
  if (!payload) {
    const message = buildErpErrorMessage(
      ERP_ERROR_KIND.PAYLOAD,
      "Não foi possível montar o payload do pedido.",
    )
    const status = await markIntegrationFailure(
      service,
      orderId,
      companyId,
      operation,
      message,
      currentStatus,
    )
    return { success: false, skipped: false, status, errorMessage: message }
  }

  const result = await dispatchOutboundIntegration({
    companyId,
    action: OPERATION_ACTION[operation],
    entity: "purchase_orders",
    entityId: orderId,
    entityCode: payload.code,
    payload,
  })

  if (result.success) {
    if (operation === "create") {
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
        const status = await markIntegrationFailure(
          service,
          orderId,
          companyId,
          operation,
          errorMessage,
          currentStatus,
        )
        return { success: false, skipped: false, status, errorMessage }
      }

      return {
        success: true,
        skipped: false,
        status: "completed",
        externalCode: result.externalCode ?? null,
      }
    }

    if (operation === "update") {
      const updateOk = await updatePurchaseOrder(service, orderId, companyId, {
        status: "completed",
        erp_error_message: null,
      })
      if (!updateOk.ok) {
        const errorMessage = formatPersistError(updateOk.message)
        const status = await markIntegrationFailure(
          service,
          orderId,
          companyId,
          operation,
          errorMessage,
          currentStatus,
        )
        return { success: false, skipped: false, status, errorMessage }
      }
      return { success: true, skipped: false, status: "completed" }
    }

    const cancelUpdate = await updatePurchaseOrder(service, orderId, companyId, {
      status: "cancelled",
      cancellation_reason:
        options?.cancellationReason?.trim() || "Pedido cancelado pelo comprador",
      erp_error_message: null,
    })
    if (!cancelUpdate.ok) {
      const errorMessage = formatPersistError(cancelUpdate.message)
      const status = await markIntegrationFailure(
        service,
        orderId,
        companyId,
        operation,
        errorMessage,
        currentStatus,
      )
      return { success: false, skipped: false, status, errorMessage }
    }
    return { success: true, skipped: false, status: "cancelled" }
  }

  // Concorrência local — não altera status do pedido
  if (
    result.responseStatus === 409 &&
    (result.errorMessage ?? "").toLowerCase().includes("em andamento")
  ) {
    return {
      success: false,
      skipped: false,
      status: currentStatus as IntegratePurchaseOrderResult["status"],
      errorMessage: result.errorMessage,
    }
  }

  const errorMessage = buildDispatchErrorMessage(operation, result)
  const attempts = result.attempts ?? 1
  const transient = isTransientOutboundFailure({
    responseStatus: result.responseStatus ?? null,
    errorMessage: result.errorMessage,
  })

  const { data: orderMeta } = await service
    .from("purchase_orders")
    .select("code")
    .eq("id", orderId)
    .eq("company_id", companyId)
    .maybeSingle()

  // Falha transitória: mantém em processamento e agenda auto-retry (até o teto)
  if (transient && !isOutboundAutoRetryExhausted(attempts)) {
    const pendingStatus =
      operation === "delete"
        ? (currentStatus === "completed" ? "completed" : "integration_error")
        : "processing"

    await updatePurchaseOrder(service, orderId, companyId, {
      status: pendingStatus,
      erp_error_message: errorMessage,
    })

    void auditAutoRetryScheduled({
      companyId,
      orderId,
      code: orderMeta?.code != null ? String(orderMeta.code) : null,
      operation,
      attempts,
      errorMessage,
      responseStatus: result.responseStatus ?? null,
    })

    return {
      success: false,
      skipped: false,
      status: pendingStatus as IntegratePurchaseOrderResult["status"],
      errorMessage,
    }
  }

  const status = await markIntegrationFailure(
    service,
    orderId,
    companyId,
    operation,
    errorMessage,
    currentStatus,
  )

  if (transient && isOutboundAutoRetryExhausted(attempts)) {
    void auditAutoRetryExhausted({
      companyId,
      orderId,
      code: orderMeta?.code != null ? String(orderMeta.code) : null,
      operation,
      attempts,
      errorMessage,
    })
  }

  return {
    success: false,
    skipped: false,
    status,
    errorMessage,
  }
}

