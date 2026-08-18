import type { OutboundIntegrationAction } from "@/lib/integrations/types"

/** Dispara integração outbound em background (não bloqueia UI). */
export function triggerOutbound(action: OutboundIntegrationAction, entityId: string) {
  void fetch("/api/integrations/outbound", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, entity_id: entityId }),
  }).catch(() => {
    // Falha silenciosa — log fica no monitor de integração quando dispatch roda no servidor
  })
}
