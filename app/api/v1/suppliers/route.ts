import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import {
  buildPaginationMeta,
  parseListQuery,
} from "@/lib/api/external/pagination"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import {
  mapSupplierToApi,
  SUPPLIER_SELECT,
  type SupplierRow,
} from "@/lib/api/external/mappers/supplier"
import { runWithApiKey } from "@/lib/api/external/with-api-key"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  return runWithApiKey(
    request,
    async ({ ctx }) => {
      const enabled = await isTenantFeatureEnabled(ctx.companyId, "suppliers")
      if (!enabled) {
        return apiError(
          "Módulo de fornecedores não habilitado para este tenant.",
          "FORBIDDEN",
          403,
        )
      }

      const parsed = parseListQuery(new URL(request.url).searchParams)
      if (typeof parsed === "string") {
        return apiError(parsed, "VALIDATION_ERROR", 400)
      }

      const service = createServiceRoleClient()
      let query = service
        .from("suppliers")
        .select(SUPPLIER_SELECT, { count: "exact" })
        .eq("company_id", ctx.companyId)
        .order("code", { ascending: true })

      if (parsed.code) {
        query = query.eq("code", parsed.code)
      }

      if (parsed.search) {
        const term = `%${parsed.search}%`
        query = query.or(`code.ilike.${term},name.ilike.${term},cnpj.ilike.${term}`)
      }

      if (parsed.updatedSince) {
        query = query.gte("created_at", parsed.updatedSince)
      }

      const { data, error, count } = await query.range(parsed.from, parsed.to)

      if (error) {
        return apiError("Erro ao listar fornecedores.", "INTERNAL_ERROR", 500)
      }

      const suppliers = ((data ?? []) as SupplierRow[]).map((row) =>
        mapSupplierToApi(row),
      )

      return apiSuccess({
        suppliers,
        ...buildPaginationMeta(parsed.page, parsed.pageSize, count ?? 0),
      })
    },
    { requiredScope: "suppliers:read" },
  )
}
