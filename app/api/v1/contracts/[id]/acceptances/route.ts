import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import {
  mapContractAcceptanceToApi,
  type ContractAcceptanceRow,
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

      const { data: rows, error: accErr } = await service
        .from("contract_acceptances")
        .select(
          "id, action, notes, term_version, term_version_date, created_at, supplier_id",
        )
        .eq("contract_id", data.id)
        .eq("company_id", ctx.companyId)
        .order("created_at", { ascending: false })

      if (accErr) {
        return apiError("Erro ao listar aceites.", "INTERNAL_ERROR", 500)
      }

      return apiSuccess({
        contract_id: data.id,
        code: data.code,
        acceptances: ((rows ?? []) as ContractAcceptanceRow[]).map(
          mapContractAcceptanceToApi,
        ),
      })
    },
    { requiredScope: "contracts:read" },
  )
}
