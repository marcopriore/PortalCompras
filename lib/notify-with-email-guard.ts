export const NOTIFY_EMAIL_PREF_KEYS = [
  "new_requisition_email",
  "quotation_received_email",
  "order_accepted_email",
  "order_refused_email",
  "order_approved_email",
  "delivery_done_email",
  "daily_summary_email",
  "requisition_approval_email",
  "integration_error_email",
] as const

export type NotifyEmailPrefKey = (typeof NOTIFY_EMAIL_PREF_KEYS)[number]

const EMAIL_PREF_KEY_SET = new Set<string>(NOTIFY_EMAIL_PREF_KEYS)

export function isAllowedNotifyEmailPrefKey(
  key: string,
): key is NotifyEmailPrefKey {
  return EMAIL_PREF_KEY_SET.has(key)
}

/** Only *_email keys count; *_bell (default true) must not enable outbound mail. */
export function wantsNotifyEmail(
  prefs: Record<string, boolean> | null | undefined,
  emailPrefKey: string,
): boolean {
  if (!isAllowedNotifyEmailPrefKey(emailPrefKey)) return false
  return Boolean(prefs?.[emailPrefKey])
}

type NotifyCaller = {
  company_id: string | null
  profile_type: string | null
  supplier_id: string | null
  is_superadmin: boolean | null
}

type NotifyPurchaseOrder = {
  company_id: string
  supplier_id: string | null
}

/**
 * Same-tenant callers may notify colleagues (REQ → aprovador).
 * Cross-tenant only when a supplier is linked to that purchase order.
 */
export function canNotifyRecipient(params: {
  caller: NotifyCaller
  companyId: string
  entity?: string | null
  entityId?: string | null
  purchaseOrder?: NotifyPurchaseOrder | null
}): boolean {
  const { caller, companyId, entity, entityId, purchaseOrder } = params

  if (caller.is_superadmin) return true
  if (caller.company_id === companyId) return true

  const entityName = entity ?? ""
  if (
    !entityId ||
    (entityName !== "purchase_orders" && entityName !== "purchase_order")
  ) {
    return false
  }

  if (!purchaseOrder || purchaseOrder.company_id !== companyId) {
    return false
  }

  if (caller.profile_type === "supplier") {
    return Boolean(
      caller.supplier_id && purchaseOrder.supplier_id === caller.supplier_id,
    )
  }

  return purchaseOrder.company_id === caller.company_id
}
