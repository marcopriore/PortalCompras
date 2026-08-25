import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  mapApprovalToApi,
  type ApprovalRequestRow,
} from "@/lib/api/external/approval-service"
import {
  buildPaginationMeta,
  parseListQuery,
} from "@/lib/api/external/pagination"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import { runWithApiKey } from "@/lib/api/external/with-api-key"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  return runWithApiKey(
    request,
    async ({ ctx }) => {
      const searchParams = new URL(request.url).searchParams
      const parsed = parseListQuery(searchParams)
      if (typeof parsed === "string") {
        return apiError(parsed, "VALIDATION_ERROR", 400)
      }

      const status = searchParams.get("status")?.trim() || "pending"
      const flowRaw = searchParams.get("flow")?.trim() || null
      const createdSince = searchParams.get("created_since")?.trim() || null

      if (flowRaw && flowRaw !== "requisition" && flowRaw !== "order") {
        return apiError(
          "Parâmetro flow inválido. Use requisition | order.",
          "VALIDATION_ERROR",
          400,
        )
      }

      if (createdSince && Number.isNaN(Date.parse(createdSince))) {
        return apiError(
          "Parâmetro created_since inválido. Use ISO 8601.",
          "VALIDATION_ERROR",
          400,
        )
      }

      const service = createServiceRoleClient()
      let query = service
        .from("approval_requests")
        .select("*", { count: "exact" })
        .eq("company_id", ctx.companyId)
        .order("created_at", { ascending: false })

      if (status && status !== "all") {
        query = query.eq("status", status)
      }

      if (flowRaw) {
        query = query.eq("flow", flowRaw)
      }

      if (createdSince) {
        query = query.gte("created_at", createdSince)
      }

      const { data, error, count } = await query.range(parsed.from, parsed.to)
      if (error) {
        return apiError("Erro ao listar aprovações.", "INTERNAL_ERROR", 500)
      }

      const rows = (data ?? []) as ApprovalRequestRow[]
      const reqIds = rows
        .filter((r) => r.flow === "requisition")
        .map((r) => r.entity_id)
      const poIds = rows.filter((r) => r.flow === "order").map((r) => r.entity_id)

      const entityById = new Map<
        string,
        {
          code?: string | null
          external_code?: string | null
          title?: string | null
          status?: string | null
        }
      >()

      if (reqIds.length > 0) {
        const { data: reqs } = await service
          .from("requisitions")
          .select("id, code, external_code, title, status")
          .eq("company_id", ctx.companyId)
          .in("id", reqIds)
        for (const r of reqs ?? []) {
          entityById.set(r.id as string, r)
        }
      }

      if (poIds.length > 0) {
        const { data: pos } = await service
          .from("purchase_orders")
          .select("id, code, external_code, status")
          .eq("company_id", ctx.companyId)
          .in("id", poIds)
        for (const p of pos ?? []) {
          entityById.set(p.id as string, {
            code: p.code,
            external_code: p.external_code,
            title: null,
            status: p.status,
          })
        }
      }

      return apiSuccess({
        approvals: rows.map((row) =>
          mapApprovalToApi(row, entityById.get(row.entity_id) ?? null),
        ),
        ...buildPaginationMeta(parsed.page, parsed.pageSize, count ?? 0),
      })
    },
    { requiredScope: "approvals:read" },
  )
}
