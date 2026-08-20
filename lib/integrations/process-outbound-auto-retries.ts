import { logAuditServer } from "@/lib/audit-server"
import { OUTBOUND_DISPATCH_IN_PROGRESS } from "@/lib/integrations/outbound-idempotency"
import {
  isOutboundAutoRetryDue,
  isOutboundAutoRetryExhausted,
  isTransientOutboundFailure,
} from "@/lib/integrations/outbound-auto-retry"
import {
  integratePurchaseOrderWithErp,
} from "@/lib/integrations/integrate-purchase-order"
import { outboundActionToPurchaseOrderOperation } from "@/lib/integrations/purchase-order-operations"
import { integrateContractWithErp } from "@/lib/integrations/integrate-contract-with-erp"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

const OUTBOUND_AUTO_RETRY_ACTIONS = [
  "purchase_order.create",
  "purchase_order.update",
  "purchase_order.delete",
  "contract.create",
] as const

type DeliveryLogRow = {
  id: string
  company_id: string
  action: string
  entity: string | null
  entity_id: string | null
  entity_code: string | null
  success: boolean
  response_status: number | null
  error_message: string | null
  attempts: number | null
  created_at: string
}

export type ProcessOutboundAutoRetriesResult = {
  scanned: number
  candidates: number
  retried: number
  skipped: number
}

function logKey(log: Pick<DeliveryLogRow, "company_id" | "action" | "entity_id">): string {
  return `${log.company_id}|${log.action}|${log.entity_id}`
}

async function isEntityStillPending(
  service: ReturnType<typeof createServiceRoleClient>,
  log: DeliveryLogRow,
): Promise<boolean> {
  if (!log.entity_id) return false

  if (log.entity === "purchase_orders") {
    const op = outboundActionToPurchaseOrderOperation(log.action)
    if (!op) return false
    const { data: order } = await service
      .from("purchase_orders")
      .select("status")
      .eq("id", log.entity_id)
      .eq("company_id", log.company_id)
      .maybeSingle()
    if (!order) return false
    const status = String(order.status)
    if (op === "delete") {
      return status === "completed" || status === "integration_error"
    }
    return status === "processing" || status === "error" || status === "integration_error"
  }

  if (log.entity === "contracts" && log.action === "contract.create") {
    const { data: contract } = await service
      .from("contracts")
      .select("status, erp_code")
      .eq("id", log.entity_id)
      .eq("company_id", log.company_id)
      .maybeSingle()
    if (!contract) return false
    if (String(contract.status) !== "active") return false
    const erp = contract.erp_code != null ? String(contract.erp_code).trim() : ""
    return !erp
  }

  return false
}

/**
 * Varre logs outbound recentes e retenta falhas transitórias cujo backoff já venceu.
 */
export async function processOutboundAutoRetries(
  options?: { limit?: number; lookbackHours?: number },
): Promise<ProcessOutboundAutoRetriesResult> {
  const limit = options?.limit ?? 25
  const lookbackHours = options?.lookbackHours ?? 24
  const service = createServiceRoleClient()
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString()

  const { data: logs, error } = await service
    .from("integration_delivery_logs")
    .select(
      "id, company_id, action, entity, entity_id, entity_code, success, response_status, error_message, attempts, created_at",
    )
    .eq("success", false)
    .neq("error_message", OUTBOUND_DISPATCH_IN_PROGRESS)
    .in("action", [...OUTBOUND_AUTO_RETRY_ACTIONS])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(300)

  if (error) {
    console.error("[auto-retry] query logs:", error.message)
    return { scanned: 0, candidates: 0, retried: 0, skipped: 0 }
  }

  const latestByKey = new Map<string, DeliveryLogRow>()
  for (const row of (logs ?? []) as DeliveryLogRow[]) {
    if (!row.entity_id) continue
    const key = logKey(row)
    if (!latestByKey.has(key)) latestByKey.set(key, row)
  }

  let retried = 0
  let skipped = 0
  let candidates = 0

  for (const log of latestByKey.values()) {
    const attempts = log.attempts ?? 1

    if (
      !isTransientOutboundFailure({
        responseStatus: log.response_status,
        errorMessage: log.error_message,
      })
    ) {
      skipped++
      continue
    }

    if (isOutboundAutoRetryExhausted(attempts)) {
      skipped++
      continue
    }

    if (!isOutboundAutoRetryDue({ attempts, createdAt: log.created_at })) {
      skipped++
      continue
    }

    const { data: newerSuccess } = await service
      .from("integration_delivery_logs")
      .select("id")
      .eq("company_id", log.company_id)
      .eq("action", log.action)
      .eq("entity_id", log.entity_id)
      .eq("success", true)
      .gt("created_at", log.created_at)
      .limit(1)
      .maybeSingle()

    if (newerSuccess) {
      skipped++
      continue
    }

    const pending = await isEntityStillPending(service, log)
    if (!pending) {
      skipped++
      continue
    }

    candidates++

    void logAuditServer({
      eventType: "integration.auto_retry",
      companyId: log.company_id,
      entity: log.entity,
      entityId: log.entity_id,
      description: `Auto-retry executado para ${log.entity_code ?? log.entity_id} (${log.action}) — tentativa seguinte após ${attempts} falha(s).`,
      metadata: {
        action: log.action,
        previousAttempts: attempts,
        responseStatus: log.response_status,
        previousLogId: log.id,
        trigger: "scheduler",
      },
    })

    try {
      if (log.entity === "purchase_orders") {
        const op = outboundActionToPurchaseOrderOperation(log.action)
        if (!op) {
          skipped++
          continue
        }
        await integratePurchaseOrderWithErp(log.company_id, log.entity_id!, op)
      } else if (log.entity === "contracts") {
        await integrateContractWithErp(log.company_id, log.entity_id!, { force: true })
      } else {
        skipped++
        continue
      }
      retried++
    } catch (err) {
      console.error(
        "[auto-retry] integrate failed:",
        err instanceof Error ? err.message : err,
      )
      skipped++
    }

    if (retried >= limit) break
  }

  return {
    scanned: latestByKey.size,
    candidates,
    retried,
    skipped,
  }
}
