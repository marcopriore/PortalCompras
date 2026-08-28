import type { SupabaseClient } from "@supabase/supabase-js"
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

export type WebhookRecipientFailureReason =
  | "profile_query_error"
  | "profile_not_found"
  | "profile_inactive"
  | "profile_supplier"
  | "company_mismatch"
  | "tenant_not_found"

export type WebhookRecipientResult =
  | {
      ok: true
      userId: string
      companyId: string
      profileType: string | null
    }
  | {
      ok: false
      reason: WebhookRecipientFailureReason
      logContext: Record<string, unknown>
    }

export async function resolveWebhookRecipient(
  service: SupabaseClient,
  solicitanteIdExterno: string,
  tenantIdExterno: string,
): Promise<WebhookRecipientResult> {
  const baseLog = {
    solicitante_id_externo: solicitanteIdExterno,
    tenant_id_externo: tenantIdExterno,
  }

  const { data: profile, error } = await service
    .from("profiles")
    .select("company_id, profile_type, status, is_superadmin")
    .eq("id", solicitanteIdExterno)
    .maybeSingle()

  if (error) {
    return {
      ok: false,
      reason: "profile_query_error",
      logContext: {
        ...baseLog,
        profile_found: false,
        db_error: error.message,
      },
    }
  }

  if (!profile) {
    return {
      ok: false,
      reason: "profile_not_found",
      logContext: {
        ...baseLog,
        profile_found: false,
        profile: null,
      },
    }
  }

  const profileSnapshot = {
    company_id: profile.company_id,
    profile_type: profile.profile_type,
    status: profile.status,
    is_superadmin: profile.is_superadmin,
  }

  const logWithProfile = {
    ...baseLog,
    profile_found: true,
    profile: profileSnapshot,
  }

  if (profile.status !== "active") {
    return {
      ok: false,
      reason: "profile_inactive",
      logContext: logWithProfile,
    }
  }

  if (profile.profile_type === "supplier") {
    return {
      ok: false,
      reason: "profile_supplier",
      logContext: logWithProfile,
    }
  }

  const isSuperAdmin = Boolean(profile.is_superadmin)
  const companyMatches = profile.company_id === tenantIdExterno

  if (!companyMatches && !isSuperAdmin) {
    return {
      ok: false,
      reason: "company_mismatch",
      logContext: {
        ...logWithProfile,
        company_matches: false,
        note:
          "profiles.id = solicitante_id_externo (auth user id); tenant_id_externo deve bater com profiles.company_id, exceto superadmin agindo em outro tenant",
      },
    }
  }

  if (!companyMatches && isSuperAdmin) {
    const { data: company, error: companyError } = await service
      .from("companies")
      .select("id")
      .eq("id", tenantIdExterno)
      .maybeSingle()

    if (companyError) {
      return {
        ok: false,
        reason: "profile_query_error",
        logContext: {
          ...logWithProfile,
          company_matches: false,
          is_superadmin: true,
          tenant_lookup_error: companyError.message,
        },
      }
    }

    if (!company) {
      return {
        ok: false,
        reason: "tenant_not_found",
        logContext: {
          ...logWithProfile,
          company_matches: false,
          is_superadmin: true,
        },
      }
    }
  }

  return {
    ok: true,
    userId: solicitanteIdExterno,
    companyId: tenantIdExterno,
    profileType: profile.profile_type,
  }
}
