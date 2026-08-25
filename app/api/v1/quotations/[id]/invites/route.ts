import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import { parseJsonBody } from "@/lib/api/external/parse-body"
import {
  inviteSupplierToQuotation,
  parseQuotationInviteInput,
} from "@/lib/api/external/quotation-invite-service"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import { resolveQuotationRow } from "@/lib/api/external/resolve-entity"
import { runWithApiKey } from "@/lib/api/external/with-api-key"

export const runtime = "nodejs"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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

      const body = await parseJsonBody<Record<string, unknown>>(request)
      if (body instanceof Response) return body

      const parsed = parseQuotationInviteInput(body)
      if (typeof parsed === "string") {
        return apiError(parsed, "VALIDATION_ERROR", 400)
      }

      const service = createServiceRoleClient()
      const { data, error } = await resolveQuotationRow(service, ctx.companyId, idOrCode)

      if (error) {
        return apiError("Erro ao buscar cotação.", "INTERNAL_ERROR", 500)
      }
      if (!data) {
        return apiError(`Cotação não encontrada: ${idOrCode}`, "NOT_FOUND", 404)
      }

      const result = await inviteSupplierToQuotation(
        service,
        ctx.companyId,
        {
          id: data.id as string,
          code: data.code as string,
          status: data.status as string,
        },
        parsed.supplier_code,
      )

      if (!result.ok) {
        if (result.code === "NOT_FOUND") {
          return apiError(result.message, "NOT_FOUND", 404)
        }
        if (result.code === "CONFLICT") {
          return apiError(result.message, "CONFLICT", 409)
        }
        return apiError("Erro ao convidar fornecedor.", "INTERNAL_ERROR", 500)
      }

      return apiSuccess({ invitation: result.invitation }, 201)
    },
    { requiredScope: "quotations:write" },
  )
}
