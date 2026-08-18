import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import {
  mapPurchaseOrderToApi,
  type PurchaseOrderItemRow,
} from "@/lib/api/external/mappers/purchase-order"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import { resolvePurchaseOrderRow } from "@/lib/api/external/resolve-entity"
import { runWithApiKey } from "@/lib/api/external/with-api-key"

export const runtime = "nodejs"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: rawId } = await params
  const idOrCode = decodeURIComponent(rawId).trim()

  if (!idOrCode) {
    return apiError("Identificador do pedido é obrigatório.", "VALIDATION_ERROR", 400)
  }

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

      const service = createServiceRoleClient()
      const { data, error } = await resolvePurchaseOrderRow(service, ctx.companyId, idOrCode)

      if (error) {
        return apiError("Erro ao buscar pedido.", "INTERNAL_ERROR", 500)
      }

      if (!data) {
        return apiError(`Pedido não encontrado: ${idOrCode}`, "NOT_FOUND", 404)
      }

      const { data: items } = await service
        .from("purchase_order_items")
        .select(
          "material_code, material_description, quantity, unit_of_measure, unit_price, total_price, delivery_days",
        )
        .eq("purchase_order_id", data.id)
        .order("material_code", { ascending: true })

      return apiSuccess({
        purchase_order: mapPurchaseOrderToApi(
          data,
          (items ?? []) as PurchaseOrderItemRow[],
        ),
      })
    },
    { requiredScope: "orders:read" },
  )
}
