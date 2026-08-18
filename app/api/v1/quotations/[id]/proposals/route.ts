import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import {
  buildRoundsWithProposals,
  type QuotationItemContext,
} from "@/lib/api/external/mappers/quotation-proposals"
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

      const searchParams = new URL(request.url).searchParams
      const roundNumberRaw = searchParams.get("round_number")
      const supplierCode = searchParams.get("supplier_code")?.trim() || null
      const statusFilter = searchParams.get("status")?.trim() || null

      const service = createServiceRoleClient()
      const { data: quotation, error } = await resolveQuotationRow(
        service,
        ctx.companyId,
        idOrCode,
      )

      if (error) {
        return apiError("Erro ao buscar cotação.", "INTERNAL_ERROR", 500)
      }

      if (!quotation) {
        return apiError(`Cotação não encontrada: ${idOrCode}`, "NOT_FOUND", 404)
      }

      const quotationId = quotation.id as string

      let roundsQuery = service
        .from("quotation_rounds")
        .select("id, round_number, status, response_deadline, created_at, closed_at")
        .eq("quotation_id", quotationId)
        .order("round_number", { ascending: true })

      if (roundNumberRaw) {
        const roundNumber = Number(roundNumberRaw)
        if (!Number.isFinite(roundNumber) || roundNumber < 1) {
          return apiError("round_number inválido.", "VALIDATION_ERROR", 400)
        }
        roundsQuery = roundsQuery.eq("round_number", Math.floor(roundNumber))
      }

      const [roundsRes, itemsRes, proposalsRes] = await Promise.all([
        roundsQuery,
        service
          .from("quotation_items")
          .select(
            "id, material_code, material_description, long_description, unit_of_measure, quantity, target_price, last_purchase_price, average_price",
          )
          .eq("quotation_id", quotationId),
        service
          .from("quotation_proposals")
          .select(
            "id, round_id, supplier_id, status, total_price, payment_condition, delivery_days, validity_date, observations, updated_at, suppliers(code, name, cnpj), proposal_items(quotation_item_id, round_id, unit_price, tax_percent, delivery_days, item_status, observations)",
          )
          .eq("quotation_id", quotationId)
          .order("updated_at", { ascending: false }),
      ])

      if (roundsRes.error) {
        return apiError("Erro ao buscar rodadas.", "INTERNAL_ERROR", 500)
      }
      if (itemsRes.error) {
        return apiError("Erro ao buscar itens da cotação.", "INTERNAL_ERROR", 500)
      }
      if (proposalsRes.error) {
        return apiError("Erro ao buscar propostas.", "INTERNAL_ERROR", 500)
      }

      const quotationItems = new Map<string, QuotationItemContext>()
      for (const row of itemsRes.data ?? []) {
        const r = row as Record<string, unknown>
        quotationItems.set(String(r.id), {
          id: String(r.id),
          material_code: r.material_code != null ? String(r.material_code) : null,
          material_description: String(r.material_description ?? ""),
          long_description: r.long_description != null ? String(r.long_description) : null,
          unit_of_measure: r.unit_of_measure != null ? String(r.unit_of_measure) : null,
          quantity: Number(r.quantity ?? 0),
          target_price: r.target_price != null ? Number(r.target_price) : null,
          last_purchase_price:
            r.last_purchase_price != null ? Number(r.last_purchase_price) : null,
          average_price: r.average_price != null ? Number(r.average_price) : null,
        })
      }

      let proposals = (proposalsRes.data ?? []) as Record<string, unknown>[]

      if (statusFilter) {
        proposals = proposals.filter((p) => String(p.status) === statusFilter)
      }

      if (supplierCode) {
        proposals = proposals.filter((p) => {
          const suppliers = p.suppliers as
            | { code: string }
            | { code: string }[]
            | null
          const supplier = Array.isArray(suppliers) ? suppliers[0] : suppliers
          return supplier?.code === supplierCode
        })
      }

      const rounds = buildRoundsWithProposals(
        (roundsRes.data ?? []) as Record<string, unknown>[],
        proposals,
        quotationItems,
      )

      return apiSuccess({
        quotation: mapQuotationToApi(quotation),
        rounds,
      })
    },
    { requiredScope: "quotations:read" },
  )
}
