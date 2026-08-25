import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { approveApprovalRequest } from "@/lib/api/external/approval-service"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import { isUuid } from "@/lib/api/external/parse-body"
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
      let decidedByName: string | undefined
      try {
        const raw = await request.json()
        if (
          raw &&
          typeof raw === "object" &&
          !Array.isArray(raw) &&
          typeof (raw as { decided_by_name?: unknown }).decided_by_name ===
            "string"
        ) {
          decidedByName = (raw as { decided_by_name: string }).decided_by_name
        }
      } catch {
        // body opcional no approve
      }

      const service = createServiceRoleClient()
      const result = await approveApprovalRequest(service, ctx.companyId, id, {
        decidedByName,
      })

      if (!result.ok) {
        if (result.code === "NOT_FOUND") {
          return apiError(`Aprovação não encontrada: ${id}`, "NOT_FOUND", 404)
        }
        if (result.code === "CONFLICT") {
          return apiError(result.message ?? "Conflito.", "CONFLICT", 409)
        }
        if (result.code === "FORBIDDEN") {
          return apiError(result.message ?? "Forbidden.", "FORBIDDEN", 403)
        }
        return apiError(
          result.message ?? "Erro ao aprovar.",
          "INTERNAL_ERROR",
          500,
        )
      }

      return apiSuccess({
        approval: result.approval,
        entity_fully_approved: result.entity_fully_approved,
      })
    },
    { requiredScope: "approvals:write" },
  )
}
