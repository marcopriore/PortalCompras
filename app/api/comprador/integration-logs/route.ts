import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { requireIntegrationsAdmin } from "@/lib/api/require-tenant-admin"
import {
  fetchInboundLogDetail,
  fetchInboundLogs,
  fetchOutboundLogDetail,
  fetchOutboundLogs,
} from "@/lib/integrations/integration-logs-query"
import { parseIntegrationLogsQuery } from "@/lib/integrations/integration-logs-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const auth = await requireIntegrationsAdmin()
    if ("error" in auth) return auth.error

    const { searchParams } = new URL(request.url)
    const logId = searchParams.get("id")
    const parsed = parseIntegrationLogsQuery(searchParams)

    if (typeof parsed === "string") {
      return NextResponse.json({ error: parsed }, { status: 400 })
    }

    const service = createServiceRoleClient()

    if (logId) {
      if (parsed.direction === "outbound") {
        const detail = await fetchOutboundLogDetail(service, auth.companyId, logId)
        if (!detail) {
          return NextResponse.json({ error: "Log não encontrado." }, { status: 404 })
        }
        return NextResponse.json({ log: detail })
      }

      const detail = await fetchInboundLogDetail(service, auth.companyId, logId)
      if (!detail) {
        return NextResponse.json({ error: "Log não encontrado." }, { status: 404 })
      }
      return NextResponse.json({ log: detail })
    }

    const result =
      parsed.direction === "outbound"
        ? await fetchOutboundLogs(service, auth.companyId, parsed)
        : await fetchInboundLogs(service, auth.companyId, parsed)

    return NextResponse.json({
      direction: parsed.direction,
      page: parsed.page,
      page_size: parsed.pageSize,
      total: result.total,
      total_pages: Math.ceil(result.total / parsed.pageSize) || 0,
      logs: result.logs,
    })
  } catch (err) {
    console.error("[integration-logs]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
