import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import {
  mapContractBalanceToApi,
  type ContractItemRow,
} from "@/lib/api/external/mappers/contract"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import { resolveContractRow } from "@/lib/api/external/resolve-entity"
import { runWithApiKey } from "@/lib/api/external/with-api-key"

export const runtime = "nodejs"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: rawId } = await params
  const idOrCode = decodeURIComponent(rawId).trim()

  if (!idOrCode) {
    return apiError(
      "Identificador do contrato é obrigatório.",
      "VALIDATION_ERROR",
      400,
    )
  }

  return runWithApiKey(
    request,
    async ({ ctx }) => {
      const enabled = await isTenantFeatureEnabled(ctx.companyId, "contracts")
      if (!enabled) {
        return apiError(
          "Módulo de contratos não habilitado para este tenant.",
          "FORBIDDEN",
          403,
        )
      }

      const service = createServiceRoleClient()
      const { data, error } = await resolveContractRow(
        service,
        ctx.companyId,
        idOrCode,
      )

      if (error) {
        return apiError("Erro ao buscar contrato.", "INTERNAL_ERROR", 500)
      }

      if (!data) {
        return apiError(`Contrato não encontrado: ${idOrCode}`, "NOT_FOUND", 404)
      }

      const { data: items } = await service
        .from("contract_items")
        .select(
          "id, material_code, material_description, unit_of_measure, quantity_contracted, quantity_consumed, reserved_quantity, unit_price, total_price, consumed_value, reserved_value, delivery_days, notes, eliminated",
        )
        .eq("contract_id", data.id)
        .eq("company_id", ctx.companyId)
        .order("created_at", { ascending: true })

      return apiSuccess({
        balance: mapContractBalanceToApi(
          data,
          (items ?? []) as ContractItemRow[],
        ),
      })
    },
    { requiredScope: "contracts:read" },
  )
}
