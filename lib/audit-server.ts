import { loadImpersonationSession } from "@/lib/impersonation/server"
import { withImpersonationAuditMetadata } from "@/lib/impersonation/audit-metadata"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

type ServerAuditEventType =
  | "supplier.invite_sent"
  | "supplier.invite_accepted"
  | "supplier.user_created"
  | "supplier.user_deactivated"
  | "supplier.user_reactivated"
  | "supplier.user_updated"
  | "supplier.user_cancelled"
  | "supplier.import_excel"
  | "impersonation"

type LogAuditServerParams = {
  eventType: ServerAuditEventType
  description: string
  companyId?: string | null
  userId?: string | null
  userName?: string | null
  entity?: string | null
  entityId?: string | null
  metadata?: Record<string, unknown>
}

export async function logAuditServer(params: LogAuditServerParams): Promise<void> {
  try {
    const supabase = createServiceRoleClient()
    let resolvedName = params.userName ?? null

    if (!resolvedName && params.userId) {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", params.userId)
        .maybeSingle()
      resolvedName = data?.full_name ?? null
    }

    let impersonationSession = null
    if (params.userId && params.companyId) {
      impersonationSession = await loadImpersonationSession(params.userId, params.companyId)
    }

    await supabase.from("audit_logs").insert({
      event_type: params.eventType,
      description: params.description,
      company_id: params.companyId ?? null,
      user_id: params.userId ?? null,
      user_name: resolvedName,
      entity: params.entity ?? null,
      entity_id: params.entityId ?? null,
      metadata: withImpersonationAuditMetadata(params.metadata, impersonationSession) ?? null,
    })
  } catch {
    /* audit não deve quebrar fluxo principal */
  }
}
