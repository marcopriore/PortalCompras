import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { IMPERSONATION_PERMISSION } from "@/lib/impersonation/constants"

export type FeatureKey =
  | "quotations"
  | "equalization"
  | "orders"
  | "requisitions"
  | "suppliers"
  | "items"
  | "reports"
  | "users"
  | "logs"
  | "settings"
  | "approval_requisition"
  | "approval_order"
  | "ai_analytics"
  | "ai_negotiation"
  | "contracts"
  | "contract_balance"
  | "api_integrations"

export type PermissionKey =
  | "nav.dashboard"
  | "nav.requisitions"
  | "nav.quotations"
  | "nav.orders"
  | "nav.contracts"
  | "nav.items"
  | "nav.suppliers"
  | "nav.reports"
  | "quotation.create"
  | "quotation.edit"
  | "quotation.cancel"
  | "quotation.equalize.view"
  | "quotation.equalize.select"
  | "quotation.view_all"
  | "order.create"
  | "order.edit"
  | "order.edit_own"
  | "order.view_all"
  | "contract.view"
  | "contract.create"
  | "contract.edit"
  | "requisition.create.buyer"
  | "requisition.create.requester"
  | "requisition.approve"
  | "requisition.view_all"
  | "approval.requisition"
  | "approval.order"
  | "export.excel"
  | "import.excel"
  | "supplier.create"
  | "supplier.edit"
  | "item.create"
  | "item.edit"
  | "user.manage"
  | "user.impersonate"
  | "settings.manage"
  | "portal.solicitante"
  | "view_only"

export type UsePermissionsReturn = {
  loading: boolean
  hasFeature: (feature: FeatureKey) => boolean
  hasPermission: (permission: PermissionKey) => boolean
  features: Record<FeatureKey, boolean>
  permissions: Record<PermissionKey, boolean>
}

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
  "ai_analytics",
  "ai_negotiation",
  "contracts",
  "contract_balance",
  "api_integrations",
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
  "quotation.create",
  "quotation.edit",
  "quotation.cancel",
  "quotation.equalize.view",
  "quotation.equalize.select",
  "quotation.view_all",
  "order.create",
  "order.edit",
  "order.edit_own",
  "order.view_all",
  "contract.view",
  "contract.create",
  "contract.edit",
  "requisition.create.buyer",
  "requisition.create.requester",
  "requisition.approve",
  "requisition.view_all",
  "approval.requisition",
  "approval.order",
  "export.excel",
  "import.excel",
  "supplier.create",
  "supplier.edit",
  "item.create",
  "item.edit",
  "user.manage",
  "user.impersonate",
  "settings.manage",
  "portal.solicitante",
  "view_only",
]

export function usePermissions(): UsePermissionsReturn {
  const {
    userId,
    companyId,
    roles,
    isSuperAdmin,
    isImpersonating,
    loading: userLoading,
  } = useUser()

  const [loading, setLoading] = React.useState(true)
  const [features, setFeatures] = React.useState<Record<FeatureKey, boolean>>(
    {} as Record<FeatureKey, boolean>,
  )
  const [permissions, setPermissions] = React.useState<Record<PermissionKey, boolean>>(
    {} as Record<PermissionKey, boolean>,
  )

  React.useEffect(() => {
    let alive = true

    const load = async () => {
      if (isSuperAdmin && !isImpersonating) {
        const f: Record<FeatureKey, boolean> = {} as Record<FeatureKey, boolean>
        const p: Record<PermissionKey, boolean> = {} as Record<PermissionKey, boolean>
        ALL_FEATURES.forEach((k) => {
          f[k] = true
        })
        ALL_PERMISSIONS.forEach((k) => {
          p[k] = true
        })

        if (!alive) return
        setFeatures(f)
        setPermissions(p)
        setLoading(false)
        return
      }

      if (!companyId || !userId) return

      if (roles.length === 0) {
        const nextPermissions = {} as Record<PermissionKey, boolean>
        ALL_PERMISSIONS.forEach((k) => {
          nextPermissions[k] = false
        })
        const nextFeatures = {} as Record<FeatureKey, boolean>
        ALL_FEATURES.forEach((k) => {
          nextFeatures[k] = false
        })
        if (!alive) return
        setFeatures(nextFeatures)
        setPermissions(nextPermissions)
        setLoading(false)
        return
      }

      const supabase = createClient()

      try {
        const [tenantFeaturesRes, rolePermissionsRes, profilePermissionsRes] =
          await Promise.all([
          supabase
            .from("tenant_features")
            .select("feature_key, enabled")
            .eq("company_id", companyId),
          supabase
            .from("role_permissions")
            .select("permission_key, enabled")
            .eq("company_id", companyId)
            .in("role", roles),
          supabase
            .from("profile_permissions")
            .select("permission_key, enabled")
            .eq("company_id", companyId)
            .eq("user_id", userId)
            .eq("enabled", true),
        ])

        const tenantFeaturesData = (tenantFeaturesRes.data ?? []) as {
          feature_key: FeatureKey
          enabled: boolean
        }[]

        const rolePermissionsData = ((rolePermissionsRes.data ?? []) as {
          permission_key: PermissionKey
          enabled: boolean
        }[])

        const nextFeatures = {} as Record<FeatureKey, boolean>
        ALL_FEATURES.forEach((k) => {
          nextFeatures[k] = false
        })
        tenantFeaturesData.forEach((row) => {
          if (row.feature_key) nextFeatures[row.feature_key] = Boolean(row.enabled)
        })

        const nextPermissions = {} as Record<PermissionKey, boolean>
        ALL_PERMISSIONS.forEach((k) => {
          nextPermissions[k] = false
        })
        rolePermissionsData.forEach((row) => {
          if (row.permission_key && row.enabled) {
            nextPermissions[row.permission_key] = true
          }
        })

        const profilePermissionsData = (profilePermissionsRes.data ?? []) as {
          permission_key: PermissionKey
          enabled: boolean
        }[]
        profilePermissionsData.forEach((row) => {
          if (row.permission_key === IMPERSONATION_PERMISSION && row.enabled) {
            nextPermissions["user.impersonate"] = true
          }
        })

        if (!alive) return
        setFeatures(nextFeatures)
        setPermissions(nextPermissions)
        setLoading(false)
      } catch {
        if (!alive) return
        setLoading(false)
      }
    }

    if (!userLoading) load()

    return () => {
      alive = false
    }
  }, [companyId, userId, roles, isSuperAdmin, isImpersonating, userLoading])

  const hasFeature = React.useCallback(
    (feature: FeatureKey) => Boolean(features[feature]),
    [features],
  )
  const hasPermission = React.useCallback(
    (permission: PermissionKey) => Boolean(permissions[permission]),
    [permissions],
  )

  return {
    loading: userLoading || loading,
    hasFeature,
    hasPermission,
    features,
    permissions,
  }
}

export default usePermissions

