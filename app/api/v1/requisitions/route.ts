import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import {
  buildPaginationMeta,
  parseListQuery,
} from "@/lib/api/external/pagination"
import {
  mapRequisitionToApi,
  REQUISITION_LIST_SELECT,
} from "@/lib/api/external/mappers/requisition"
import { parseJsonBody } from "@/lib/api/external/parse-body"
import {
  createRequisitionFromApi,
  parseRequisitionWriteInput,
} from "@/lib/api/external/requisition-service"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import { runWithApiKey } from "@/lib/api/external/with-api-key"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
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

      const searchParams = new URL(request.url).searchParams
      const parsed = parseListQuery(searchParams)
      if (typeof parsed === "string") {
        return apiError(parsed, "VALIDATION_ERROR", 400)
      }

      const status = searchParams.get("status")?.trim() || null
      const externalCode = searchParams.get("external_code")?.trim() || null
      const requesterName =
        searchParams.get("requester_name")?.trim() ||
        searchParams.get("requester_code")?.trim() ||
        null
      const createdSince = searchParams.get("created_since")?.trim() || null

      if (createdSince && Number.isNaN(Date.parse(createdSince))) {
        return apiError("Parâmetro created_since inválido. Use ISO 8601.", "VALIDATION_ERROR", 400)
      }

      const service = createServiceRoleClient()
      let query = service
        .from("requisitions")
        .select(REQUISITION_LIST_SELECT, { count: "exact" })
        .eq("company_id", ctx.companyId)
        .order("created_at", { ascending: false })

      if (parsed.code) {
        query = query.or(`code.eq.${parsed.code},external_code.eq.${parsed.code}`)
      }

      if (parsed.search) {
        const term = `%${parsed.search}%`
        query = query.or(`code.ilike.${term},title.ilike.${term},external_code.ilike.${term}`)
      }

      if (status) {
        query = query.eq("status", status)
      }

      if (externalCode) {
        query = query.eq("external_code", externalCode)
      }

      if (requesterName) {
        query = query.ilike("requester_name", `%${requesterName}%`)
      }

      if (createdSince) {
        query = query.gte("created_at", createdSince)
      }

      if (parsed.updatedSince) {
        query = query.gte("created_at", parsed.updatedSince)
      }

      const { data, error, count } = await query.range(parsed.from, parsed.to)

      if (error) {
        return apiError("Erro ao listar requisições.", "INTERNAL_ERROR", 500)
      }

      return apiSuccess({
        requisitions: (data ?? []).map((row) => mapRequisitionToApi(row)),
        ...buildPaginationMeta(parsed.page, parsed.pageSize, count ?? 0),
      })
    },
    { requiredScope: "requisitions:read" },
  )
}

export async function POST(request: NextRequest) {
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
      const result = await createRequisitionFromApi(service, ctx.companyId, parsed)

      if (!result.ok) {
        if (result.code === "CONFLICT") {
          return apiError(
            "external_code já existe.",
            "CONFLICT",
            409,
            { external_code: result.external_code },
          )
        }
        return apiError("Erro ao criar requisição.", "INTERNAL_ERROR", 500)
      }

      return apiSuccess({ requisition: result.requisition }, 201)
    },
    { requiredScope: "requisitions:write" },
  )
}
