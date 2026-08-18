import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import { mapItemToApi, ITEM_SELECT } from "@/lib/api/external/mappers/item"
import {
  itemInputToRow,
  parseItemWriteInput,
} from "@/lib/api/external/validators/item-write"
import { parseBatchItems, parseJsonBody } from "@/lib/api/external/parse-body"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import { runWithApiKey } from "@/lib/api/external/with-api-key"

export const runtime = "nodejs"

async function ensureItemsModule(companyId: string) {
  const enabled = await isTenantFeatureEnabled(companyId, "items")
  if (!enabled) {
    return apiError(
      "Módulo de itens não habilitado para este tenant.",
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
      const moduleError = await ensureItemsModule(ctx.companyId)
      if (moduleError) return moduleError

      const body = await parseJsonBody<Record<string, unknown>>(request)
      if (body instanceof Response) return body

      const batch = parseBatchItems(body)
      if (typeof batch === "string") {
        return apiError(batch, "VALIDATION_ERROR", 400)
      }

      const parsed: ReturnType<typeof itemInputToRow>[] = []
      const errors: { index: number; message: string }[] = []

      batch.forEach((raw, index) => {
        const result = parseItemWriteInput(raw)
        if (typeof result === "string") {
          errors.push({ index, message: result })
          return
        }
        parsed.push(itemInputToRow(ctx.companyId, result))
      })

      if (errors.length > 0) {
        return apiError("Validação falhou.", "VALIDATION_ERROR", 400, { errors })
      }

      const codes = parsed.map((r) => r.code as string)
      const service = createServiceRoleClient()
      const { data: existing } = await service
        .from("items")
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

      const { data, error } = await service.from("items").insert(parsed).select(ITEM_SELECT)

      if (error) {
        return apiError("Erro ao criar itens.", "INTERNAL_ERROR", 500)
      }

      return apiSuccess(
        {
          created: (data ?? []).length,
          items: ((data ?? []) as Parameters<typeof mapItemToApi>[0][]).map(mapItemToApi),
        },
        201,
      )
    },
    { requiredScope: "items:write" },
  )
}

export async function PUT(request: NextRequest) {
  return runWithApiKey(
    request,
    async ({ ctx }) => {
      const moduleError = await ensureItemsModule(ctx.companyId)
      if (moduleError) return moduleError

      const body = await parseJsonBody<Record<string, unknown>>(request)
      if (body instanceof Response) return body

      const batch = parseBatchItems(body)
      if (typeof batch === "string") {
        return apiError(batch, "VALIDATION_ERROR", 400)
      }

      const service = createServiceRoleClient()
      const updated: ReturnType<typeof mapItemToApi>[] = []
      const notFound: string[] = []
      const errors: { index: number; message: string }[] = []

      for (let index = 0; index < batch.length; index++) {
        const raw = batch[index]
        const result = parseItemWriteInput(raw)
        if (typeof result === "string") {
          errors.push({ index, message: result })
          continue
        }

        const { data, error } = await service
          .from("items")
          .update(itemInputToRow(ctx.companyId, result))
          .eq("company_id", ctx.companyId)
          .eq("code", result.code)
          .select(ITEM_SELECT)
          .maybeSingle()

        if (error) {
          errors.push({ index, message: error.message })
          continue
        }
        if (!data) {
          notFound.push(result.code)
          continue
        }
        updated.push(mapItemToApi(data as Parameters<typeof mapItemToApi>[0]))
      }

      if (errors.length > 0) {
        return apiError("Validação falhou.", "VALIDATION_ERROR", 400, { errors })
      }
      if (notFound.length > 0) {
        return apiError("Itens não encontrados.", "NOT_FOUND", 404, { codes: notFound })
      }

      return apiSuccess({ updated: updated.length, items: updated })
    },
    { requiredScope: "items:write" },
  )
}
