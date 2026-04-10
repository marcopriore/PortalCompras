import { createClient } from '@/lib/supabase/client'

type AuditEventType =
  | 'user.login'
  | 'user.logout'
  | 'user.created'
  | 'user.updated'
  | 'tenant.created'
  | 'tenant.updated'
  | 'quotation.created'
  | 'quotation.updated'
  | 'quotation.cancelled'
  | 'impersonation'
  | 'integration.items'
  | 'integration.suppliers'
  | 'integration.outbound'
  | 'supplier.login'
  | 'supplier.logout'
  | 'proposal.saved'
  | 'proposal.submitted'
  | 'proposal.imported'
  | 'purchase_order.accepted'
  | 'purchase_order.refused'
  | 'purchase_order.delivery_updated'
  | 'requisition.in_quotation'
  | 'requisition.approved'
  | 'requisition.created'

type LogAuditParams = {
  eventType: AuditEventType
  description: string
  companyId?: string | null
  userId?: string | null
  userName?: string | null
  entity?: string | null
  entityId?: string | null
  metadata?: Record<string, unknown>
}

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  )
}

export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    const supabase = createClient()

    let resolvedName = params.userName ?? null

    // Se userName não foi fornecido ou é um UUID, buscar full_name do perfil
    if (!resolvedName || (resolvedName && isUUID(resolvedName))) {
      const lookupId =
        params.userId ??
        (resolvedName && isUUID(resolvedName) ? resolvedName : null)
      if (lookupId) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', lookupId)
          .single()
        if (data?.full_name) {
          resolvedName = data.full_name as string
        }
      }
    }

    await supabase.from('audit_logs').insert({
      event_type: params.eventType,
      description: params.description,
      company_id: params.companyId ?? null,
      user_id: params.userId ?? null,
      user_name: resolvedName,
      entity: params.entity ?? null,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? null,
    })
  } catch {
    // Log não deve quebrar o fluxo principal
  }
}


