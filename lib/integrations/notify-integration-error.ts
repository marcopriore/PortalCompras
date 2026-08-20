import { createClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { createNotification } from "@/lib/notify"
import { sendEmail } from "@/lib/email/send-email"
import {
  getAppEmailBaseUrl,
  templateIntegrationError,
} from "@/lib/email/templates"
import { OUTBOUND_DISPATCH_IN_PROGRESS } from "@/lib/integrations/outbound-idempotency"

export type IntegrationErrorEntity = "purchase_order" | "contract"

type NotifyIntegrationErrorInput = {
  companyId: string
  entity: IntegrationErrorEntity
  entityId: string
  code: string
  message: string
  /** Evita spam em retries: se já era integration_error, não notifica de novo. */
  previousStatus?: string | null
}

function authAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function isTenantAdmin(profile: {
  role?: string | null
  roles?: string[] | null
}): boolean {
  const roles = Array.isArray(profile.roles) ? profile.roles : []
  return profile.role === "admin" || roles.includes("admin")
}

async function listTenantAdmins(companyId: string) {
  const service = createServiceRoleClient()
  const { data } = await service
    .from("profiles")
    .select("id, full_name, role, roles")
    .eq("company_id", companyId)
    .eq("status", "active")
    .neq("profile_type", "supplier")

  return (data ?? []).filter(isTenantAdmin)
}

async function recentlyNotified(
  companyId: string,
  type: string,
  entityId: string,
  withinMinutes = 60,
): Promise<boolean> {
  const service = createServiceRoleClient()
  const since = new Date(Date.now() - withinMinutes * 60_000).toISOString()
  const { count } = await service
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("type", type)
    .eq("entity_id", entityId)
    .gte("created_at", since)

  return (count ?? 0) > 0
}

/**
 * Alerta admins do tenant (sino + e-mail) quando a integração ERP falha
 * com status Valore `integration_error` (pedido) ou falha de contrato.
 * Nunca bloqueia o fluxo de integração.
 */
export async function notifyIntegrationError(
  input: NotifyIntegrationErrorInput,
): Promise<void> {
  try {
    if (input.entity === "purchase_order") {
      if (input.previousStatus === "integration_error") return
    }

    const type =
      input.entity === "purchase_order"
        ? "order.integration_error"
        : "contract.integration_error"

    if (await recentlyNotified(input.companyId, type, input.entityId)) {
      return
    }

    const admins = await listTenantAdmins(input.companyId)
    if (admins.length === 0) return

    const service = createServiceRoleClient()
    const authAdmin = authAdminClient()
    const entityLabel =
      input.entity === "purchase_order" ? "Pedido" : "Contrato"
    const title = "Erro de integração ERP"
    const bodyText =
      input.entity === "purchase_order"
        ? `Pedido ${input.code} ficou com Erro de Integração. Reenvie pelo Monitor de Integrações.`
        : `Contrato ${input.code} falhou na integração ERP. Reenvie pelo Monitor.`
    const entityTable =
      input.entity === "purchase_order" ? "purchase_order" : "contract"
    const detailUrl =
      input.entity === "purchase_order"
        ? `${getAppEmailBaseUrl()}/comprador/pedidos/${input.entityId}`
        : `${getAppEmailBaseUrl()}/comprador/contratos/${input.entityId}`
    const monitorUrl = `${getAppEmailBaseUrl()}/comprador/integracoes/monitor`

    const safeMessage =
      input.message === OUTBOUND_DISPATCH_IN_PROGRESS
        ? "Falha na integração com o ERP."
        : input.message

    for (const admin of admins) {
      const { data: prefs } = await service
        .from("notification_preferences")
        .select("integration_error_bell, integration_error_email")
        .eq("user_id", admin.id)
        .eq("company_id", input.companyId)
        .maybeSingle()

      const wantsBell = prefs?.integration_error_bell ?? true
      const wantsEmail = prefs?.integration_error_email ?? true

      if (wantsBell) {
        await createNotification(
          {
            userId: admin.id,
            companyId: input.companyId,
            type,
            title,
            body: bodyText,
            entity: entityTable,
            entityId: input.entityId,
          },
          service,
        )
      }

      if (wantsEmail) {
        const { data: authData } = await authAdmin.auth.admin.getUserById(admin.id)
        const toEmail = authData.user?.email
        if (!toEmail) continue

        const { subject, html } = templateIntegrationError({
          adminName: admin.full_name ?? "Administrador",
          entityLabel,
          code: input.code,
          message: safeMessage,
          detailUrl,
          monitorUrl,
        })
        await sendEmail({ to: toEmail, subject, html })
      }
    }
  } catch (e) {
    console.error("notifyIntegrationError:", e)
  }
}
