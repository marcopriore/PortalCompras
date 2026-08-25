import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import {
  buildSavingReport,
  parseReportDateRange,
} from "@/lib/api/external/report-service"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import { runWithApiKey } from "@/lib/api/external/with-api-key"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  return runWithApiKey(
    request,
    async ({ ctx }) => {
      const enabled = await isTenantFeatureEnabled(ctx.companyId, "reports")
      if (!enabled) {
        return apiError(
          "Módulo de relatórios não habilitado para este tenant.",
          "FORBIDDEN",
          403,
        )
      }

      const searchParams = new URL(request.url).searchParams
      const range = parseReportDateRange(searchParams)
      if (typeof range === "string") {
        return apiError(range, "VALIDATION_ERROR", 400)
      }

      const category = searchParams.get("category")?.trim() || null
      const supplierCode = searchParams.get("supplier_code")?.trim() || null

      const service = createServiceRoleClient()
      const result = await buildSavingReport(service, ctx.companyId, range, {
        category,
        supplierCode,
      })

      if (!result.ok) {
        if ("code" in result && result.code === "NOT_FOUND") {
          return apiError(result.message, "NOT_FOUND", 404)
        }
        return apiError("Erro ao gerar relatório de saving.", "INTERNAL_ERROR", 500)
      }

      return apiSuccess(result.report)
    },
    { requiredScope: "reports:read" },
  )
}
