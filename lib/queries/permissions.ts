import type { SupabaseClient } from "@supabase/supabase-js"
import type { FeatureKey, PermissionKey } from "@/lib/hooks/usePermissions"

const ALL_FEATURES: FeatureKey[] = [
  "quotations",
  "equalization",
  "orders",
  "requisitions",
  "suppliers",
  "items",
  "reports",
  "users",
  "logs",
  "settings",
  "approval_requisition",
  "approval_order",
  "approval_catalog_order",
  "ai_analytics",
  "ai_negotiation",
  "ai_negotiation_autonomous",
  "contracts",
  "contract_balance",
  "api_integrations",
  "purchase_catalog",
]

const ALL_PERMISSIONS: PermissionKey[] = [
  "nav.dashboard",
  "nav.requisitions",
  "nav.quotations",
  "nav.orders",
  "nav.contracts",
  "nav.items",
  "nav.suppliers",
  "nav.reports",
  "nav.catalog",
  "dashboard.metrics",
  "dashboard.spend_category",
  "dashboard.quotation_status",
  "dashboard.recent_activity",
  "dashboard.lead_time",
  "dashboard.roi",
  "reports.saving",
  "reports.spend",
  "reports.orders",
  "reports.quotations",
  "reports.export.spend_category",
  "reports.export.supplier_performance",
  "reports.export.saving",
  "reports.export.process_time",
  "quotation.create",
  "quotation.edit",
  "quotation.cancel",
  "quotation.equalize.view",
  "quotation.equalize.select",
  "quotation.view_all",
  "quotation.delegate",
  "order.create",
  "order.edit",
  "order.edit_own",
  "order.view_all",
  "order.delegate",
  "contract.view",
  "contract.create",
  "contract.edit",
  "requisition.create.buyer",
  "requisition.create.requester",
  "requisition.approve",
  "requisition.view_all",
  "approval.requisition",
  "approval.order",
  "approval.catalog_order",
  "approval.view_all",
  "export.excel",
  "import.excel",
  "erp.sync",
  "integration.monitor",
  "supplier.create",
  "supplier.edit",
  "item.create",
  "item.edit",
  "user.manage",
  "user.impersonate",
  "settings.manage",
  "portal.solicitante",
  "view_only",
  "catalog.view",
  "catalog.order",
  "catalog.buyer_review",
]

export function emptyPermissions(): Record<PermissionKey, boolean> {
  const next = {} as Record<PermissionKey, boolean>
  ALL_PERMISSIONS.forEach((k) => {
    next[k] = false
  })
  return next
}

export function emptyFeatures(): Record<FeatureKey, boolean> {
  const next = {} as Record<FeatureKey, boolean>
  ALL_FEATURES.forEach((k) => {
    next[k] = false
  })
  return next
}

function applyPermissionKeys(
  target: Record<PermissionKey, boolean>,
  keys: string[],
) {
  for (const key of keys) {
    if (key in target) {
      target[key as PermissionKey] = true
    }
  }
}

export type PermissionsPayload = {
  features: Record<FeatureKey, boolean>
  permissions: Record<PermissionKey, boolean>
}

export function fullAccessPermissions(): PermissionsPayload {
  const features = emptyFeatures()
  const permissions = emptyPermissions()
  ALL_FEATURES.forEach((k) => {
    features[k] = true
  })
  ALL_PERMISSIONS.forEach((k) => {
    permissions[k] = true
  })
  permissions.view_only = false
  return { features, permissions }
}

export async function fetchPermissions(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
): Promise<PermissionsPayload> {
  const tenantFeaturesRes = await supabase
    .from("tenant_features")
    .select("feature_key, enabled")
    .eq("company_id", companyId)

  const nextFeatures = emptyFeatures()
  ;((tenantFeaturesRes.data ?? []) as {
    feature_key: FeatureKey
    enabled: boolean
  }[]).forEach((row) => {
    if (row.feature_key) nextFeatures[row.feature_key] = Boolean(row.enabled)
  })

  const nextPermissions = emptyPermissions()

  const groupLinksRes = await supabase
    .from("profile_permission_groups")
    .select("group_id")
    .eq("company_id", companyId)
    .eq("user_id", userId)

  if (!groupLinksRes.error) {
    const groupIds = ((groupLinksRes.data ?? []) as { group_id: string }[])
      .map((r) => r.group_id)
      .filter(Boolean)

    if (groupIds.length > 0) {
      const { data: groupRules } = await supabase
        .from("permission_group_rules")
        .select("permission_key")
        .eq("company_id", companyId)
        .in("group_id", groupIds)
        .eq("enabled", true)

      applyPermissionKeys(
        nextPermissions,
        ((groupRules ?? []) as { permission_key: string }[]).map(
          (r) => r.permission_key,
        ),
      )
    }
  }

  const profilePermissionsRes = await supabase
    .from("profile_permissions")
    .select("permission_key, enabled")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("enabled", true)

  ;((profilePermissionsRes.data ?? []) as {
    permission_key: PermissionKey
    enabled: boolean
  }[]).forEach((row) => {
    if (row.permission_key && row.enabled) {
      nextPermissions[row.permission_key] = true
    }
  })

  return { features: nextFeatures, permissions: nextPermissions }
}
