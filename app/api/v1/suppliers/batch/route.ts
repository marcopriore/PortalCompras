import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import {
  mapSupplierToApi,
  SUPPLIER_SELECT,
  type SupplierRow,
} from "@/lib/api/external/mappers/supplier"
import {
  parseSupplierWriteInput,
  supplierInputToRow,
} from "@/lib/api/external/validators/supplier-write"
import { parseBatchItems, parseJsonBody, parseSupplierBatch } from "@/lib/api/external/parse-body"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import { runWithApiKey } from "@/lib/api/external/with-api-key"

export const runtime = "nodejs"

async function ensureSuppliersModule(companyId: string) {
  const enabled = await isTenantFeatureEnabled(companyId, "suppliers")
  if (!enabled) {
    return apiError(
      "Módulo de fornecedores não habilitado para este tenant.",
      "FORBIDDEN",
      403,
    )
  }
  return null
}

export async function POST(request: NextRequest) {
  return runWithApiKey(
    request,
    async ({ ctx }) => {
      const moduleError = await ensureSuppliersModule(ctx.companyId)
      if (moduleError) return moduleError

      const body = await parseJsonBody<Record<string, unknown>>(request)
      if (body instanceof Response) return body

      const batch = parseSupplierBatch(body)
      if (typeof batch === "string") {
        return apiError(batch, "VALIDATION_ERROR", 400)
      }

      const parsed: ReturnType<typeof supplierInputToRow>[] = []
      const errors: { index: number; message: string }[] = []

      batch.forEach((raw, index) => {
        const result = parseSupplierWriteInput(raw)
        if (typeof result === "string") {
          errors.push({ index, message: result })
          return
        }
        parsed.push(supplierInputToRow(ctx.companyId, result))
      })

      if (errors.length > 0) {
        return apiError("Validação falhou.", "VALIDATION_ERROR", 400, { errors })
      }

      const codes = parsed.map((r) => r.code as string)
      const service = createServiceRoleClient()
      const { data: existing } = await service
        .from("suppliers")
        .select("code")
        .eq("company_id", ctx.companyId)
        .in("code", codes)

      const existingCodes = new Set((existing ?? []).map((r) => (r as { code: string }).code))
      if (existingCodes.size > 0) {
        return apiError(
          "Um ou mais códigos já existem. Use PUT para atualizar.",
          "CONFLICT",
          409,
          { codes: [...existingCodes] },
        )
      }

      const { data, error } = await service
        .from("suppliers")
        .insert(parsed)
        .select(SUPPLIER_SELECT)

      if (error) {
        return apiError("Erro ao criar fornecedores.", "INTERNAL_ERROR", 500)
      }

      return apiSuccess(
        {
          created: (data ?? []).length,
          suppliers: ((data ?? []) as SupplierRow[]).map((row) => mapSupplierToApi(row)),
        },
        201,
      )
    },
    { requiredScope: "suppliers:write" },
  )
}

export async function PUT(request: NextRequest) {
  return runWithApiKey(
    request,
    async ({ ctx }) => {
      const moduleError = await ensureSuppliersModule(ctx.companyId)
      if (moduleError) return moduleError

      const body = await parseJsonBody<Record<string, unknown>>(request)
      if (body instanceof Response) return body

      const batch = parseSupplierBatch(body)
      if (typeof batch === "string") {
        return apiError(batch, "VALIDATION_ERROR", 400)
      }

      const service = createServiceRoleClient()
      const updated: ReturnType<typeof mapSupplierToApi>[] = []
      const notFound: string[] = []
      const errors: { index: number; message: string }[] = []

      for (let index = 0; index < batch.length; index++) {
        const raw = batch[index]
        const result = parseSupplierWriteInput(raw)
        if (typeof result === "string") {
          errors.push({ index, message: result })
          continue
        }

        const { data, error } = await service
          .from("suppliers")
          .update(supplierInputToRow(ctx.companyId, result))
          .eq("company_id", ctx.companyId)
          .eq("code", result.code)
          .select(SUPPLIER_SELECT)
          .maybeSingle()

        if (error) {
          errors.push({ index, message: error.message })
          continue
        }
        if (!data) {
          notFound.push(result.code)
          continue
        }
        updated.push(mapSupplierToApi(data as SupplierRow))
      }

      if (errors.length > 0) {
        return apiError("Validação falhou.", "VALIDATION_ERROR", 400, { errors })
      }
      if (notFound.length > 0) {
        return apiError("Fornecedores não encontrados.", "NOT_FOUND", 404, { codes: notFound })
      }

      return apiSuccess({ updated: updated.length, suppliers: updated })
    },
    { requiredScope: "suppliers:write" },
  )
}
