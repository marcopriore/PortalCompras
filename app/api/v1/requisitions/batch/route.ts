import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import { parseJsonBody, parseRequisitionBatch } from "@/lib/api/external/parse-body"
import {
  createRequisitionFromApi,
  parseRequisitionWriteInput,
} from "@/lib/api/external/requisition-service"
import type { RequisitionWriteInput } from "@/lib/api/external/validators/requisition-write"
import type { mapRequisitionToApi } from "@/lib/api/external/mappers/requisition"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import { runWithApiKey } from "@/lib/api/external/with-api-key"

export const runtime = "nodejs"

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

      const batch = parseRequisitionBatch(body)
      if (typeof batch === "string") {
        return apiError(batch, "VALIDATION_ERROR", 400)
      }

      const parsed: RequisitionWriteInput[] = []
      const errors: { index: number; message: string }[] = []

      batch.forEach((raw, index) => {
        const result = parseRequisitionWriteInput(raw)
        if (typeof result === "string") {
          errors.push({ index, message: result })
          return
        }
        parsed.push(result)
      })

      if (errors.length > 0) {
        return apiError("Validação falhou.", "VALIDATION_ERROR", 400, { errors })
      }

      const externalCodes = parsed.map((r) => r.external_code)
      const duplicatesInBatch = externalCodes.filter(
        (code, i) => externalCodes.indexOf(code) !== i,
      )
      if (duplicatesInBatch.length > 0) {
        return apiError(
          "external_code duplicado no lote.",
          "VALIDATION_ERROR",
          400,
          { external_codes: [...new Set(duplicatesInBatch)] },
        )
      }

      const service = createServiceRoleClient()
      const created: ReturnType<typeof mapRequisitionToApi>[] = []
      const conflicts: string[] = []

      for (const input of parsed) {
        const result = await createRequisitionFromApi(service, ctx.companyId, input)
        if (!result.ok) {
          if (result.code === "CONFLICT") {
            conflicts.push(result.external_code)
            continue
          }
          return apiError("Erro ao criar requisições.", "INTERNAL_ERROR", 500)
        }
        if (result.requisition) created.push(result.requisition)
      }

      if (conflicts.length > 0) {
        return apiError(
          "Um ou mais external_code já existem.",
          "CONFLICT",
          409,
          { external_codes: conflicts, created: created.length },
        )
      }

      return apiSuccess({ created: created.length, requisitions: created }, 201)
    },
    { requiredScope: "requisitions:write" },
  )
}
