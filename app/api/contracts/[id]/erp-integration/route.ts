import { NextResponse } from "next/server"
import { integrateContractWithErp } from "@/lib/integrations/integrate-contract-with-erp"
import { requireIntegrationsAdmin } from "@/lib/api/require-tenant-admin"

export const runtime = "nodejs"

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as { source?: string }
    const source = body.source

    if (source !== "monitor") {
      return NextResponse.json({ error: "Fonte inválida." }, { status: 400 })
    }

    const monitorAuth = await requireIntegrationsAdmin()
    if ("error" in monitorAuth) return monitorAuth.error
    const companyId = monitorAuth.companyId

    const { data: contract } = await monitorAuth.supabase
      .from("contracts")
      .select("status")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle()

    if (!contract) {
      return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 })
    }

    if (String(contract.status) !== "active") {
      return NextResponse.json(
        { error: "Contrato não está elegível para reenvio da integração." },
        { status: 400 },
      )
    }

    const result = await integrateContractWithErp(companyId, id, { force: true })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
