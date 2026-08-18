import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import {
  buildPaginationMeta,
  parseListQuery,
  type ParsedListQuery,
} from "@/lib/api/external/pagination"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import { ITEM_SELECT, mapItemToApi, type ItemRow } from "@/lib/api/external/mappers/item"
import { runWithApiKey } from "@/lib/api/external/with-api-key"

export const runtime = "nodejs"

function applyItemFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filters: ParsedListQuery,
) {
  let q = query

  if (filters.code) {
    q = q.eq("code", filters.code)
  }

  if (filters.search) {
    const term = `%${filters.search}%`
    q = q.or(`code.ilike.${term},short_description.ilike.${term},long_description.ilike.${term}`)
  }

  if (filters.updatedSince) {
    q = q.or(
      `sync_at.gte.${filters.updatedSince},and(sync_at.is.null,created_at.gte.${filters.updatedSince})`,
    )
  }

  return q
}

export async function GET(request: NextRequest) {
  return runWithApiKey(
    request,
    async ({ ctx }) => {
      const enabled = await isTenantFeatureEnabled(ctx.companyId, "items")
      if (!enabled) {
        return apiError(
          "Módulo de itens não habilitado para este tenant.",
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
        .from("items")
        .select(ITEM_SELECT, { count: "exact" })
        .eq("company_id", ctx.companyId)
        .order("code", { ascending: true })

      query = applyItemFilters(query, parsed)

      const { data, error, count } = await query.range(parsed.from, parsed.to)

      if (error) {
        return apiError("Erro ao listar itens.", "INTERNAL_ERROR", 500)
      }

      const items = ((data ?? []) as ItemRow[]).map(mapItemToApi)

      return apiSuccess({
        items,
        ...buildPaginationMeta(parsed.page, parsed.pageSize, count ?? 0),
      })
    },
    { requiredScope: "items:read" },
  )
}
