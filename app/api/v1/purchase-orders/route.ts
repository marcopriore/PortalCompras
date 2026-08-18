import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import {
  buildPaginationMeta,
  parseListQuery,
} from "@/lib/api/external/pagination"
import {
  mapPurchaseOrderToApi,
  PURCHASE_ORDER_LIST_SELECT,
  type PurchaseOrderItemRow,
} from "@/lib/api/external/mappers/purchase-order"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import { runWithApiKey } from "@/lib/api/external/with-api-key"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  return runWithApiKey(
    request,
    async ({ ctx }) => {
      const enabled = await isTenantFeatureEnabled(ctx.companyId, "orders")
      if (!enabled) {
        return apiError(
          "Módulo de pedidos não habilitado para este tenant.",
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
      const supplierCode = searchParams.get("supplier_code")?.trim() || null
      const createdSince = searchParams.get("created_since")?.trim() || null

      if (createdSince && Number.isNaN(Date.parse(createdSince))) {
        return apiError("Parâmetro created_since inválido. Use ISO 8601.", "VALIDATION_ERROR", 400)
      }

      const service = createServiceRoleClient()
      let query = service
        .from("purchase_orders")
        .select(PURCHASE_ORDER_LIST_SELECT, { count: "exact" })
        .eq("company_id", ctx.companyId)
        .order("created_at", { ascending: false })

      if (parsed.code) {
        query = query.or(`code.eq.${parsed.code},external_code.eq.${parsed.code}`)
      }

      if (parsed.search) {
        const term = `%${parsed.search}%`
        query = query.or(
          `code.ilike.${term},external_code.ilike.${term},supplier_name.ilike.${term},supplier_cnpj.ilike.${term}`,
        )
      }

      if (status) {
        query = query.eq("status", status)
      }

      if (supplierCode) {
        const { data: supplier } = await service
          .from("suppliers")
          .select("id")
          .eq("company_id", ctx.companyId)
          .eq("code", supplierCode)
          .maybeSingle()

        if (!supplier) {
          return apiSuccess({
            purchase_orders: [],
            ...buildPaginationMeta(parsed.page, parsed.pageSize, 0),
          })
        }

        query = query.eq("supplier_id", supplier.id)
      }

      if (createdSince) {
        query = query.gte("created_at", createdSince)
      }

      if (parsed.updatedSince) {
        query = query.gte("updated_at", parsed.updatedSince)
      }

      const { data, error, count } = await query.range(parsed.from, parsed.to)

      if (error) {
        return apiError("Erro ao listar pedidos.", "INTERNAL_ERROR", 500)
      }

      return apiSuccess({
        purchase_orders: (data ?? []).map((row) => mapPurchaseOrderToApi(row)),
        ...buildPaginationMeta(parsed.page, parsed.pageSize, count ?? 0),
      })
    },
    { requiredScope: "orders:read" },
  )
}
