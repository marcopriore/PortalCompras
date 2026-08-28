import type { AxisDeskChamadoStatus } from "@/lib/axisdesk/types"
import { getAxisDeskStatusLabel } from "@/lib/axisdesk/types"

export type AxisDeskWebhookEvent = {
  evento: "status_alterado" | "comentario"
  chamado_id: string
  tenant_id_externo: string
  solicitante_id_externo: string
  timestamp: string
  status_novo?: string
  mensagem?: string
  motivo?: string
  autor?: string
}

function truncateText(value: string, max = 120): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

export function buildSupportWebhookNotification(event: AxisDeskWebhookEvent): {
  type: string
  title: string
  body: string
} {
  if (event.evento === "status_alterado") {
    const statusLabel = event.status_novo
      ? getAxisDeskStatusLabel(event.status_novo as AxisDeskChamadoStatus)
      : "atualizado"
    return {
      type: "support.status_changed",
      title: "Chamado de suporte atualizado",
      body: `Seu chamado de suporte teve o status atualizado para ${statusLabel}.`,
    }
  }

  const message = event.mensagem?.trim() || event.motivo?.trim() || ""
  const preview = message ? truncateText(message) : "Nova mensagem da equipe de suporte."
  const authorPrefix = event.autor?.trim() ? `${event.autor.trim()}: ` : ""

  return {
    type: "support.comment",
    title: "Nova resposta no chamado de suporte",
    body: `A equipe de suporte respondeu seu chamado: "${authorPrefix}${preview}"`,
  }
}

export function resolveSupportDetailPath(profileType: string | null): string {
  return profileType === "requester" ? "/solicitante/suporte" : "/comprador/suporte"
}
