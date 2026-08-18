import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { isOutboundIntegrationAction } from "@/lib/integrations/types"
import { triggerOutboundIntegration } from "@/lib/integrations/trigger-outbound"
import { requireIntegrationsAdmin } from "@/lib/api/require-tenant-admin"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: string
      entity_id?: string
      source?: string
    }
    const action = body.action ?? ""
    const entityId = body.entity_id ?? ""
    const source = body.source ?? "portal"

    if (!isOutboundIntegrationAction(action)) {
      return NextResponse.json({ error: "action inválida." }, { status: 400 })
    }
    if (!entityId) {
      return NextResponse.json({ error: "entity_id é obrigatório." }, { status: 400 })
    }

    let companyId: string

    if (source === "monitor") {
      const monitorAuth = await requireIntegrationsAdmin()
      if ("error" in monitorAuth) return monitorAuth.error
      companyId = monitorAuth.companyId
    } else {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id, is_superadmin")
        .eq("id", user.id)
        .single()

      if (!profile?.company_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      companyId = profile.company_id as string
      if (profile.is_superadmin) {
        const cookieStore = await cookies()
        const selected = cookieStore.get("selected_company_id")
        if (selected?.value) {
          companyId = decodeURIComponent(selected.value)
        }
      }
    }

    const result = await triggerOutboundIntegration(companyId, action, entityId)

    return NextResponse.json({ ok: true, ...result })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
