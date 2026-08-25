import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getApprovalRequest } from "@/lib/api/external/approval-service"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import { isUuid } from "@/lib/api/external/parse-body"
import { runWithApiKey } from "@/lib/api/external/with-api-key"

export const runtime = "nodejs"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
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
    _request,
    async ({ ctx }) => {
      const service = createServiceRoleClient()
      const result = await getApprovalRequest(service, ctx.companyId, id)

      if (!result.ok) {
        if (result.code === "NOT_FOUND") {
          return apiError(`Aprovação não encontrada: ${id}`, "NOT_FOUND", 404)
        }
        return apiError(
          result.message ?? "Erro ao buscar aprovação.",
          "INTERNAL_ERROR",
          500,
        )
      }

      return apiSuccess({ approval: result.approval })
    },
    { requiredScope: "approvals:read" },
  )
}
