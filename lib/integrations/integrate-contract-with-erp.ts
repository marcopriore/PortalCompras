import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import { logAuditServer } from "@/lib/audit-server"
import {
  mapContractToOutboundPayload,
  type ContractItemRow,
} from "@/lib/api/external/mappers/contract"
import {
  buildErpErrorMessage,
  buildOutboundDispatchFailureMessage,
  duplicateExternalCodeMessage,
  ERP_ERROR_KIND,
} from "@/lib/integrations/erp-errors"
import {
  isOutboundAutoRetryExhausted,
  isTransientOutboundFailure,
  outboundAutoRetryDelayMs,
} from "@/lib/integrations/outbound-auto-retry"
import { dispatchOutboundIntegration } from "@/lib/integrations/dispatch"

export type IntegrateContractResult = {
  success: boolean
  skipped: boolean
  erpCode?: string | null
  errorMessage?: string | null
}

type ServiceClient = ReturnType<typeof createServiceRoleClient>

const CONTRACT_SELECT = `
  *,
  suppliers(name, code),
  payment_conditions(code, description)
`

export async function loadContractOutboundPayload(
  companyId: string,
  contractId: string,
) {
  const service = createServiceRoleClient()
  const { data: row } = await service
    .from("contracts")
    .select(CONTRACT_SELECT)
    .eq("id", contractId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (!row) return null

  const { data: items } = await service
    .from("contract_items")
    .select(
      "material_code, material_description, unit_of_measure, quantity_contracted, unit_price, total_price, delivery_days, notes, eliminated",
    )
    .eq("contract_id", contractId)
    .eq("company_id", companyId)
    .order("material_code", { ascending: true })

  return mapContractToOutboundPayload(row, (items ?? []) as ContractItemRow[])
}

async function updateContractErpCode(
  service: ServiceClient,
  contractId: string,
  companyId: string,
  erpCode: string | null,
): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  const { error } = await service
    .from("contracts")
    .update({
      erp_code: erpCode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contractId)
    .eq("company_id", companyId)

  if (!error) return { ok: true }
  return { ok: false, message: error.message, code: error.code }
}

function buildDispatchErrorMessage(result: {
  errorMessage?: string | null
  responseStatus?: number | null
  responseBody?: string | null
}): string {
  const transient = isTransientOutboundFailure({
    responseStatus: result.responseStatus ?? null,
    errorMessage: result.errorMessage,
  })
  return buildOutboundDispatchFailureMessage(
    result,
    "Falha na integração do contrato com o ERP.",
    transient,
  )
}

async function notifyContractIntegrationFailure(input: {
  companyId: string
  contractId: string
  code: string
  message: string
}): Promise<void> {
  const { notifyIntegrationError } = await import(
    "@/lib/integrations/notify-integration-error"
  )
  void notifyIntegrationError({
    companyId: input.companyId,
    entity: "contract",
    entityId: input.contractId,
    code: input.code,
    message: input.message,
  })
}

export async function integrateContractWithErp(
  companyId: string,
  contractId: string,
  options?: { force?: boolean },
): Promise<IntegrateContractResult> {
  const service = createServiceRoleClient()

  const { data: contract, error: loadError } = await service
    .from("contracts")
    .select("id, status, company_id, erp_code, code")
    .eq("id", contractId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (loadError || !contract) {
    return {
      success: false,
      skipped: false,
      errorMessage: "Contrato não encontrado.",
    }
  }

  if (String(contract.status) !== "active") {
    return {
      success: false,
      skipped: false,
      errorMessage: "Contrato não está elegível para integração com o ERP.",
    }
  }

  const existingErpCode =
    contract.erp_code != null && String(contract.erp_code).trim()
      ? String(contract.erp_code).trim()
      : null

  if (existingErpCode && !options?.force) {
    return { success: true, skipped: true, erpCode: existingErpCode }
  }

  const enabled = await isTenantFeatureEnabled(companyId, "api_integrations")
  if (!enabled) {
    return { success: true, skipped: true, erpCode: existingErpCode }
  }

  const payload = await loadContractOutboundPayload(companyId, contractId)
  if (!payload) {
    const errorMessage = buildErpErrorMessage(
      ERP_ERROR_KIND.PAYLOAD,
      "Não foi possível montar o payload do contrato.",
    )
    const { notifyIntegrationError } = await import(
      "@/lib/integrations/notify-integration-error"
    )
    void notifyIntegrationError({
      companyId,
      entity: "contract",
      entityId: contractId,
      code: String(contract.code),
      message: errorMessage,
    })
    return {
      success: false,
      skipped: false,
      errorMessage,
    }
  }

  const result = await dispatchOutboundIntegration({
    companyId,
    action: "contract.create",
    entity: "contracts",
    entityId: contractId,
    entityCode: String(contract.code),
    payload,
  })

  if (!result.success) {
    const errorMessage = buildDispatchErrorMessage(result)
    const attempts = result.attempts ?? 1
    const transient = isTransientOutboundFailure({
      responseStatus: result.responseStatus ?? null,
      errorMessage: result.errorMessage,
    })

    if (transient && !isOutboundAutoRetryExhausted(attempts)) {
      const delay = outboundAutoRetryDelayMs(attempts)
      void logAuditServer({
        eventType: "integration.auto_retry_scheduled",
        companyId,
        entity: "contracts",
        entityId: contractId,
        description: `Auto-retry agendado para contrato ${contract.code} após tentativa ${attempts}${delay != null ? ` — próxima em ${Math.round(delay / 1000)}s` : ""}.`,
        metadata: {
          operation: "create",
          attempts,
          delayMs: delay,
          responseStatus: result.responseStatus ?? null,
          errorMessage,
          trigger: "transient_failure",
        },
      })
      return {
        success: false,
        skipped: false,
        errorMessage,
      }
    }

    void notifyContractIntegrationFailure({
      companyId,
      contractId,
      code: String(contract.code),
      message: errorMessage,
    })

    if (transient && isOutboundAutoRetryExhausted(attempts)) {
      void logAuditServer({
        eventType: "integration.auto_retry_exhausted",
        companyId,
        entity: "contracts",
        entityId: contractId,
        description: `Auto-retry esgotado para contrato ${contract.code} após ${attempts} tentativas — intervenção manual no Monitor.`,
        metadata: {
          operation: "create",
          attempts,
          errorMessage,
        },
      })
    }

    return {
      success: false,
      skipped: false,
      errorMessage,
    }
  }

  if (result.externalCode?.trim()) {
    const persist = await updateContractErpCode(
      service,
      contractId,
      companyId,
      result.externalCode.trim(),
    )

    if (!persist.ok) {
      const message =
        persist.code === "23505"
          ? duplicateExternalCodeMessage(result.externalCode.trim())
          : buildErpErrorMessage(
              ERP_ERROR_KIND.PERSIST,
              `Falha ao gravar código ERP do contrato: ${persist.message}`,
            )
      const { notifyIntegrationError } = await import(
        "@/lib/integrations/notify-integration-error"
      )
      void notifyIntegrationError({
        companyId,
        entity: "contract",
        entityId: contractId,
        code: String(contract.code),
        message,
      })
      return { success: false, skipped: false, errorMessage: message }
    }

    return {
      success: true,
      skipped: false,
      erpCode: result.externalCode.trim(),
    }
  }

  return { success: true, skipped: false, erpCode: existingErpCode }
}
