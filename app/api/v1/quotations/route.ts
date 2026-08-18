import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import {
  buildPaginationMeta,
  parseListQuery,
} from "@/lib/api/external/pagination"
import {
  mapQuotationToApi,
  QUOTATION_LIST_SELECT,
} from "@/lib/api/external/mappers/quotation"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import { runWithApiKey } from "@/lib/api/external/with-api-key"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  return runWithApiKey(
    request,
    async ({ ctx }) => {
      const enabled = await isTenantFeatureEnabled(ctx.companyId, "quotations")
      if (!enabled) {
        return apiError(
          "Módulo de cotações não habilitado para este tenant.",
          "FORBIDDEN",
          403,
        )
      }

      const searchParams = new URL(request.url).searchParams
      const parsed = parseListQuery(searchParams)
      if (typeof parsed === "string") {
        return apiError(parsed, "VALIDATION_ERROR", 400)
      }

      const status = searchParams.get("status")?.trim() || null
      const createdSince = searchParams.get("created_since")?.trim() || null

      if (createdSince && Number.isNaN(Date.parse(createdSince))) {
        return apiError("Parâmetro created_since inválido. Use ISO 8601.", "VALIDATION_ERROR", 400)
      }

      const service = createServiceRoleClient()
      let query = service
        .from("quotations")
        .select(QUOTATION_LIST_SELECT, { count: "exact" })
        .eq("company_id", ctx.companyId)
        .order("created_at", { ascending: false })

      if (parsed.code) {
        query = query.eq("code", parsed.code)
      }

      if (parsed.search) {
        const term = `%${parsed.search}%`
        query = query.or(`code.ilike.${term},description.ilike.${term}`)
      }

      if (status) {
        query = query.eq("status", status)
      }

      if (createdSince) {
        query = query.gte("created_at", createdSince)
      }

      if (parsed.updatedSince) {
        query = query.gte("created_at", parsed.updatedSince)
      }

      const { data, error, count } = await query.range(parsed.from, parsed.to)

      if (error) {
        return apiError("Erro ao listar cotações.", "INTERNAL_ERROR", 500)
      }

      return apiSuccess({
        quotations: (data ?? []).map((row) => mapQuotationToApi(row)),
        ...buildPaginationMeta(parsed.page, parsed.pageSize, count ?? 0),
      })
    },
    { requiredScope: "quotations:read" },
  )
}
