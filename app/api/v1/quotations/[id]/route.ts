import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import { mapQuotationToApi } from "@/lib/api/external/mappers/quotation"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import { resolveQuotationRow } from "@/lib/api/external/resolve-entity"
import { runWithApiKey } from "@/lib/api/external/with-api-key"

export const runtime = "nodejs"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: rawId } = await params
  const idOrCode = decodeURIComponent(rawId).trim()

  if (!idOrCode) {
    return apiError("Identificador da cotação é obrigatório.", "VALIDATION_ERROR", 400)
  }

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

      const service = createServiceRoleClient()
      const { data, error } = await resolveQuotationRow(service, ctx.companyId, idOrCode)

      if (error) {
        return apiError("Erro ao buscar cotação.", "INTERNAL_ERROR", 500)
      }

      if (!data) {
        return apiError(`Cotação não encontrada: ${idOrCode}`, "NOT_FOUND", 404)
      }

      const quotationId = data.id as string

      const [itemsRes, roundsRes, suppliersRes] = await Promise.all([
        service
          .from("quotation_items")
          .select(
            "material_code, material_description, long_description, unit_of_measure, quantity, target_price, last_purchase_price, average_price",
          )
          .eq("quotation_id", quotationId)
          .order("material_description", { ascending: true }),
        service
          .from("quotation_rounds")
          .select("id, round_number, status, response_deadline, created_at")
          .eq("quotation_id", quotationId)
          .order("round_number", { ascending: true }),
        service
          .from("quotation_suppliers")
          .select("supplier_id, position, suppliers(code, name, cnpj)")
          .eq("quotation_id", quotationId)
          .order("position", { ascending: true, nullsFirst: false }),
      ])

      const suppliers = (suppliersRes.data ?? []).map((row) => {
        const r = row as {
          supplier_id: string
          position: number | null
          suppliers:
            | { code: string; name: string; cnpj: string | null }
            | { code: string; name: string; cnpj: string | null }[]
            | null
        }
        const supplier = Array.isArray(r.suppliers) ? r.suppliers[0] : r.suppliers
        return {
          supplier_id: r.supplier_id,
          position: r.position,
          code: supplier?.code ?? null,
          name: supplier?.name ?? null,
          cnpj: supplier?.cnpj ?? null,
        }
      })

      return apiSuccess({
        quotation: {
          ...mapQuotationToApi(data),
          items: itemsRes.data ?? [],
          rounds: roundsRes.data ?? [],
          invited_suppliers: suppliers,
        },
      })
    },
    { requiredScope: "quotations:read" },
  )
}
