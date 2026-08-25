import type { SupabaseClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/email/send-email"
import { templateCatalogOrderCreated } from "@/lib/email/templates"
import type { CatalogPurchaseOrderCreated } from "@/lib/catalog/create-catalog-purchase-orders"

type NotifyCatalogCheckoutParams = {
  db: SupabaseClient
  companyId: string
  actorUserId: string
  actorName: string | null
  actorProfileType: string
  title: string
  purchaseOrders: CatalogPurchaseOrderCreated[]
}

async function getAuthEmail(
  db: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await db.auth.admin.getUserById(userId)
  if (error || !data.user?.email) return null
  return data.user.email
}

async function shouldSendEmail(
  db: SupabaseClient,
  userId: string,
  companyId: string,
  prefKey: string,
): Promise<boolean> {
  const { data } = await db
    .from("notification_preferences")
    .select(prefKey)
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (!data) return true
  const value = (data as unknown as Record<string, unknown>)[prefKey]
  return value !== false
}

/**
 * Notifica o autor do checkout e, se for solicitante, também os compradores do tenant.
 * Falhas não bloqueiam o checkout.
 */
export async function notifyCatalogCheckout(
  params: NotifyCatalogCheckoutParams,
): Promise<void> {
  const {
    db,
    companyId,
    actorUserId,
    actorName,
    actorProfileType,
    title,
    purchaseOrders,
  } = params

  if (purchaseOrders.length === 0) return

  const codes = purchaseOrders.map((p) => p.code).join(", ")
  const reqCodes = purchaseOrders.map((p) => p.requisitionCode).join(", ")
  const primary = purchaseOrders[0]
  const isRequester = actorProfileType === "requester"

  const recipientIds = new Set<string>([actorUserId])

  if (isRequester) {
    const { data: buyers } = await db
      .from("profiles")
      .select("id")
      .eq("company_id", companyId)
      .eq("profile_type", "buyer")
      .eq("status", "active")
      .limit(20)

    for (const row of buyers ?? []) {
      if (row.id) recipientIds.add(row.id as string)
    }
  }

  const { data: profiles } = await db
    .from("profiles")
    .select("id, full_name, profile_type")
    .in("id", [...recipientIds])

  for (const profile of profiles ?? []) {
    const userId = profile.id as string
    const isActor = userId === actorUserId
    const profileType = (profile.profile_type as string) ?? "buyer"
    const name = (profile.full_name as string) || "usuário"

    const useRequisitionLink = isActor && isRequester
    const entity = useRequisitionLink ? "requisition" : "purchase_order"
    const entityId = useRequisitionLink ? primary.requisitionId : primary.id
    const notifType = useRequisitionLink
      ? "requisition.catalog_completed"
      : "order.catalog_created"
    const notifTitle = isActor
      ? "Pedido do catálogo criado"
      : "Novo pedido via catálogo"
    const notifBody = isActor
      ? `Pedido(s) ${codes} e requisição(ões) ${reqCodes} gerados a partir do catálogo.`
      : `${actorName ?? "Solicitante"} finalizou o catálogo "${title}" — pedido(s) ${codes}.`

    try {
      await db.from("notifications").insert({
        user_id: userId,
        company_id: companyId,
        type: notifType,
        title: notifTitle,
        body: notifBody,
        entity,
        entity_id: entityId,
      })
    } catch {
      /* não bloqueia */
    }

    try {
      const prefOk = await shouldSendEmail(
        db,
        userId,
        companyId,
        "order_accepted_email",
      )
      if (!prefOk) continue

      const email = await getAuthEmail(db, userId)
      if (!email) continue

      const portalBase =
        profileType === "requester" ? "/solicitante" : "/comprador/pedidos"
      const linkPath = useRequisitionLink
        ? `/solicitante/${primary.requisitionId}`
        : `/comprador/pedidos/${primary.id}`

      const tpl = templateCatalogOrderCreated({
        recipientName: name,
        title,
        orderCodes: codes,
        requisitionCodes: reqCodes,
        linkPath,
        portalLabel: portalBase.includes("solicitante")
          ? "Ver requisição"
          : "Ver pedido",
      })

      await sendEmail({
        to: email,
        subject: tpl.subject,
        html: tpl.html,
      })
    } catch {
      /* não bloqueia */
    }
  }
}
