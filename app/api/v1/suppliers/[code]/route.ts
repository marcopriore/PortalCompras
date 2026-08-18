import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import {
  mapSupplierToApi,
  SUPPLIER_SELECT,
  type SupplierRow,
} from "@/lib/api/external/mappers/supplier"
import {
  parseSupplierWriteInput,
  supplierInputToRow,
} from "@/lib/api/external/validators/supplier-write"
import { parseJsonBody } from "@/lib/api/external/parse-body"
import { runWithApiKey } from "@/lib/api/external/with-api-key"

export const runtime = "nodejs"

type RouteParams = {
  params: Promise<{ code: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { code: rawCode } = await params
  const code = decodeURIComponent(rawCode).trim()

  if (!code) {
    return apiError("Código do fornecedor é obrigatório.", "VALIDATION_ERROR", 400)
  }

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

      const service = createServiceRoleClient()
      const { data, error } = await service
        .from("suppliers")
        .select(SUPPLIER_SELECT)
        .eq("company_id", ctx.companyId)
        .eq("code", code)
        .maybeSingle()

      if (error) {
        return apiError("Erro ao buscar fornecedor.", "INTERNAL_ERROR", 500)
      }

      if (!data) {
        return apiError(`Fornecedor não encontrado: ${code}`, "NOT_FOUND", 404)
      }

      const supplier = data as SupplierRow

      const { data: categoryRows } = await service
        .from("supplier_categories")
        .select("category")
        .eq("company_id", ctx.companyId)
        .eq("supplier_id", supplier.id)

      const categories = (categoryRows ?? [])
        .map((row) => (row as { category: string }).category)
        .filter(Boolean)

      return apiSuccess({
        supplier: mapSupplierToApi(supplier, categories),
      })
    },
    { requiredScope: "suppliers:read" },
  )
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { code: rawCode } = await params
  const code = decodeURIComponent(rawCode).trim()

  if (!code) {
    return apiError("Código do fornecedor é obrigatório.", "VALIDATION_ERROR", 400)
  }

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

      const body = await parseJsonBody<Record<string, unknown>>(request)
      if (body instanceof Response) return body

      const result = parseSupplierWriteInput({ ...body, code })
      if (typeof result === "string") {
        return apiError(result, "VALIDATION_ERROR", 400)
      }

      const service = createServiceRoleClient()
      const { data, error } = await service
        .from("suppliers")
        .update(supplierInputToRow(ctx.companyId, result))
        .eq("company_id", ctx.companyId)
        .eq("code", code)
        .select(SUPPLIER_SELECT)
        .maybeSingle()

      if (error) {
        return apiError("Erro ao atualizar fornecedor.", "INTERNAL_ERROR", 500)
      }

      if (!data) {
        return apiError(`Fornecedor não encontrado: ${code}`, "NOT_FOUND", 404)
      }

      const supplier = data as SupplierRow
      const { data: categoryRows } = await service
        .from("supplier_categories")
        .select("category")
        .eq("company_id", ctx.companyId)
        .eq("supplier_id", supplier.id)

      const categories = (categoryRows ?? [])
        .map((row) => (row as { category: string }).category)
        .filter(Boolean)

      return apiSuccess({
        supplier: mapSupplierToApi(supplier, categories),
      })
    },
    { requiredScope: "suppliers:write" },
  )
}
