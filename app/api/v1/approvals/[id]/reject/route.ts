import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { rejectApprovalRequest } from "@/lib/api/external/approval-service"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import { isUuid, parseJsonBody } from "@/lib/api/external/parse-body"
import { runWithApiKey } from "@/lib/api/external/with-api-key"

export const runtime = "nodejs"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: rawId } = await params
  const id = decodeURIComponent(rawId).trim()

  if (!id || !isUuid(id)) {
    return apiError(
      "id deve ser o UUID da approval_request.",
      "VALIDATION_ERROR",
      400,
    )
  }

  return runWithApiKey(
    request,
    async ({ ctx }) => {
      const body = await parseJsonBody<{
        reason?: unknown
        decided_by_name?: unknown
      }>(request)
      if (body instanceof Response) return body

      const reason = typeof body.reason === "string" ? body.reason : ""
      const decidedByName =
        typeof body.decided_by_name === "string" ? body.decided_by_name : undefined

      const service = createServiceRoleClient()
      const result = await rejectApprovalRequest(
        service,
        ctx.companyId,
        id,
        reason,
        { decidedByName },
      )

      if (!result.ok) {
        if (result.code === "NOT_FOUND") {
          return apiError(`Aprovação não encontrada: ${id}`, "NOT_FOUND", 404)
        }
        if (result.code === "VALIDATION_ERROR") {
          return apiError(result.message ?? "Validação.", "VALIDATION_ERROR", 400)
        }
        if (result.code === "CONFLICT") {
          return apiError(result.message ?? "Conflito.", "CONFLICT", 409)
        }
        if (result.code === "FORBIDDEN") {
          return apiError(result.message ?? "Forbidden.", "FORBIDDEN", 403)
        }
        return apiError(
          result.message ?? "Erro ao reprovar.",
          "INTERNAL_ERROR",
          500,
        )
      }

      return apiSuccess({ approval: result.approval })
    },
    { requiredScope: "approvals:write" },
  )
}
