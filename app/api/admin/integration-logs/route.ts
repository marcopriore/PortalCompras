import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  fetchInboundLogDetail,
  fetchInboundLogs,
  fetchOutboundLogDetail,
  fetchOutboundLogs,
} from "@/lib/integrations/integration-logs-query"
import { parseIntegrationLogsQuery } from "@/lib/integrations/integration-logs-types"

export const runtime = "nodejs"

async function requireSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_superadmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { user }
}

export async function GET(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if ("error" in auth) return auth.error

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("company_id")?.trim() || null
    const logId = searchParams.get("id")

    const parsed = parseIntegrationLogsQuery(searchParams)
    if (typeof parsed === "string") {
      return NextResponse.json({ error: parsed }, { status: 400 })
    }

    const service = createServiceRoleClient()

    if (logId) {
      if (parsed.direction === "outbound") {
        const detail = await fetchOutboundLogDetail(service, companyId, logId)
        if (!detail) {
          return NextResponse.json({ error: "Log não encontrado." }, { status: 404 })
        }
        return NextResponse.json({ log: detail })
      }

      const detail = await fetchInboundLogDetail(service, companyId, logId)
      if (!detail) {
        return NextResponse.json({ error: "Log não encontrado." }, { status: 404 })
      }
      return NextResponse.json({ log: detail })
    }

    const result =
      parsed.direction === "outbound"
        ? await fetchOutboundLogs(service, companyId, parsed)
        : await fetchInboundLogs(service, companyId, parsed)

    const companyIds = [...new Set(result.logs.map((l) => l.company_id))]
    let companyMap: Record<string, string> = {}

    if (companyIds.length > 0) {
      const { data: companies } = await service
        .from("companies")
        .select("id, name")
        .in("id", companyIds)

      companyMap = Object.fromEntries(
        (companies ?? []).map((c) => [String(c.id), String(c.name)]),
      )
    }

    const logs = result.logs.map((log) => ({
      ...log,
      company_name: companyMap[log.company_id] ?? null,
    }))

    return NextResponse.json({
      direction: parsed.direction,
      page: parsed.page,
      page_size: parsed.pageSize,
      total: result.total,
      total_pages: Math.ceil(result.total / parsed.pageSize) || 0,
      logs,
    })
  } catch (err) {
    console.error("[admin integration-logs]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
