import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import {
  mapRequisitionToApi,
  type RequisitionItemRow,
} from "@/lib/api/external/mappers/requisition"
import { parseJsonBody } from "@/lib/api/external/parse-body"
import {
  cancelRequisitionFromApi,
  parseRequisitionWriteInput,
  updateRequisitionFromApi,
} from "@/lib/api/external/requisition-service"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import { resolveRequisitionRow } from "@/lib/api/external/resolve-entity"
import { runWithApiKey } from "@/lib/api/external/with-api-key"

export const runtime = "nodejs"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: rawId } = await params
  const idOrCode = decodeURIComponent(rawId).trim()

  if (!idOrCode) {
    return apiError("Identificador da requisição é obrigatório.", "VALIDATION_ERROR", 400)
  }

  return runWithApiKey(
    request,
    async ({ ctx }) => {
      const enabled = await isTenantFeatureEnabled(ctx.companyId, "requisitions")
      if (!enabled) {
        return apiError(
          "Módulo de requisições não habilitado para este tenant.",
          "FORBIDDEN",
          403,
        )
      }

      const service = createServiceRoleClient()
      const { data, error } = await resolveRequisitionRow(service, ctx.companyId, idOrCode)

      if (error) {
        return apiError("Erro ao buscar requisição.", "INTERNAL_ERROR", 500)
      }

      if (!data) {
        return apiError(`Requisição não encontrada: ${idOrCode}`, "NOT_FOUND", 404)
      }

      const { data: items } = await service
        .from("requisition_items")
        .select(
          "id, material_code, material_description, quantity, unit_of_measure, estimated_price, commodity_group, observations",
        )
        .eq("requisition_id", data.id)
        .order("created_at", { ascending: true })

      return apiSuccess({
        requisition: mapRequisitionToApi(data, (items ?? []) as RequisitionItemRow[]),
      })
    },
    { requiredScope: "requisitions:read" },
  )
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id: rawId } = await params
  const idOrCode = decodeURIComponent(rawId).trim()

  if (!idOrCode) {
    return apiError("Identificador da requisição é obrigatório.", "VALIDATION_ERROR", 400)
  }

  return runWithApiKey(
    request,
    async ({ ctx }) => {
      const enabled = await isTenantFeatureEnabled(ctx.companyId, "requisitions")
      if (!enabled) {
        return apiError(
          "Módulo de requisições não habilitado para este tenant.",
          "FORBIDDEN",
          403,
        )
      }

      const body = await parseJsonBody<Record<string, unknown>>(request)
      if (body instanceof Response) return body

      const parsed = parseRequisitionWriteInput(body)
      if (typeof parsed === "string") {
        return apiError(parsed, "VALIDATION_ERROR", 400)
      }

      const service = createServiceRoleClient()
      const { data: existing, error: resolveError } = await resolveRequisitionRow(
        service,
        ctx.companyId,
        idOrCode,
      )

      if (resolveError) {
        return apiError("Erro ao buscar requisição.", "INTERNAL_ERROR", 500)
      }
      if (!existing) {
        return apiError(`Requisição não encontrada: ${idOrCode}`, "NOT_FOUND", 404)
      }

      const result = await updateRequisitionFromApi(
        service,
        ctx.companyId,
        existing.id as string,
        parsed,
      )

      if (!result.ok) {
        if (result.code === "NOT_FOUND") {
          return apiError(`Requisição não encontrada: ${idOrCode}`, "NOT_FOUND", 404)
        }
        if (result.code === "CONFLICT") {
          return apiError(
            "external_code já existe.",
            "CONFLICT",
            409,
            { external_code: result.external_code },
          )
        }
        if (result.code === "FORBIDDEN") {
          return apiError(result.message, "FORBIDDEN", 403)
        }
        return apiError("Erro ao atualizar requisição.", "INTERNAL_ERROR", 500)
      }

      return apiSuccess({ requisition: result.requisition })
    },
    { requiredScope: "requisitions:write" },
  )
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: rawId } = await params
  const idOrCode = decodeURIComponent(rawId).trim()

  if (!idOrCode) {
    return apiError("Identificador da requisição é obrigatório.", "VALIDATION_ERROR", 400)
  }

  return runWithApiKey(
    request,
    async ({ ctx }) => {
      const enabled = await isTenantFeatureEnabled(ctx.companyId, "requisitions")
      if (!enabled) {
        return apiError(
          "Módulo de requisições não habilitado para este tenant.",
          "FORBIDDEN",
          403,
        )
      }

      const service = createServiceRoleClient()
      const { data: existing, error: resolveError } = await resolveRequisitionRow(
        service,
        ctx.companyId,
        idOrCode,
      )

      if (resolveError) {
        return apiError("Erro ao buscar requisição.", "INTERNAL_ERROR", 500)
      }
      if (!existing) {
        return apiError(`Requisição não encontrada: ${idOrCode}`, "NOT_FOUND", 404)
      }

      const result = await cancelRequisitionFromApi(
        service,
        ctx.companyId,
        existing.id as string,
      )

      if (!result.ok) {
        if (result.code === "NOT_FOUND") {
          return apiError(`Requisição não encontrada: ${idOrCode}`, "NOT_FOUND", 404)
        }
        if (result.code === "CONFLICT") {
          return apiError(result.message, "CONFLICT", 409)
        }
        if (result.code === "FORBIDDEN") {
          return apiError(result.message, "FORBIDDEN", 403)
        }
        return apiError("Erro ao cancelar requisição.", "INTERNAL_ERROR", 500)
      }

      return apiSuccess({ requisition: result.requisition })
    },
    { requiredScope: "requisitions:write" },
  )
}
