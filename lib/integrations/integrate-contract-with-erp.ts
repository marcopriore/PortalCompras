import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import {
  mapContractToOutboundPayload,
  type ContractItemRow,
} from "@/lib/api/external/mappers/contract"
import {
  buildErpErrorMessage,
  duplicateExternalCodeMessage,
  ERP_ERROR_KIND,
  formatErpHttpFailure,
} from "@/lib/integrations/erp-errors"
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
  if (result.errorMessage?.trim()) {
    return buildErpErrorMessage(ERP_ERROR_KIND.ERP_HTTP, result.errorMessage.trim())
  }
  if (result.responseStatus != null) {
    return buildErpErrorMessage(
      ERP_ERROR_KIND.ERP_HTTP,
      formatErpHttpFailure(result.responseStatus, result.responseBody ?? null),
    )
  }
  return buildErpErrorMessage(
    ERP_ERROR_KIND.ERP_HTTP,
    "Falha na integração do contrato com o ERP.",
  )
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
    return {
      success: false,
      skipped: false,
      errorMessage: buildErpErrorMessage(
        ERP_ERROR_KIND.PAYLOAD,
        "Não foi possível montar o payload do contrato.",
      ),
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
    return {
      success: false,
      skipped: false,
      errorMessage: buildDispatchErrorMessage(result),
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
