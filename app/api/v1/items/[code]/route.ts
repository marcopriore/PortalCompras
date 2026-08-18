import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import { ITEM_SELECT, mapItemToApi, type ItemRow } from "@/lib/api/external/mappers/item"
import {
  itemInputToRow,
  parseItemWriteInput,
} from "@/lib/api/external/validators/item-write"
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
    return apiError("Código do item é obrigatório.", "VALIDATION_ERROR", 400)
  }

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

      const service = createServiceRoleClient()
      const { data, error } = await service
        .from("items")
        .select(ITEM_SELECT)
        .eq("company_id", ctx.companyId)
        .eq("code", code)
        .maybeSingle()

      if (error) {
        return apiError("Erro ao buscar item.", "INTERNAL_ERROR", 500)
      }

      if (!data) {
        return apiError(`Item não encontrado: ${code}`, "NOT_FOUND", 404)
      }

      return apiSuccess({ item: mapItemToApi(data as ItemRow) })
    },
    { requiredScope: "items:read" },
  )
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { code: rawCode } = await params
  const code = decodeURIComponent(rawCode).trim()

  if (!code) {
    return apiError("Código do item é obrigatório.", "VALIDATION_ERROR", 400)
  }

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

      const body = await parseJsonBody<Record<string, unknown>>(request)
      if (body instanceof Response) return body

      const result = parseItemWriteInput({ ...body, code })
      if (typeof result === "string") {
        return apiError(result, "VALIDATION_ERROR", 400)
      }

      const service = createServiceRoleClient()
      const { data, error } = await service
        .from("items")
        .update(itemInputToRow(ctx.companyId, result))
        .eq("company_id", ctx.companyId)
        .eq("code", code)
        .select(ITEM_SELECT)
        .maybeSingle()

      if (error) {
        return apiError("Erro ao atualizar item.", "INTERNAL_ERROR", 500)
      }

      if (!data) {
        return apiError(`Item não encontrado: ${code}`, "NOT_FOUND", 404)
      }

      return apiSuccess({ item: mapItemToApi(data as ItemRow) })
    },
    { requiredScope: "items:write" },
  )
}
