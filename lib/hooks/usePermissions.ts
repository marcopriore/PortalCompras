import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"

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

export type PermissionKey =
  | "quotation.create"
  | "quotation.cancel"
  | "quotation.equalize"
  | "quotation.edit"
  | "order.create"
  | "order.edit"
  | "requisition.create"
  | "requisition.approve"
  | "view_only"
  | "approval.requisition"
  | "approval.order"

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
]

const ALL_PERMISSIONS: PermissionKey[] = [
  "quotation.create",
  "quotation.cancel",
  "quotation.equalize",
  "quotation.edit",
  "order.create",
  "order.edit",
  "requisition.create",
  "requisition.approve",
  "view_only",
  "approval.requisition",
  "approval.order",
]

export function usePermissions(): UsePermissionsReturn {
  const { userId, companyId, isSuperAdmin, loading: userLoading } = useUser()

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
      if (isSuperAdmin) {
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

      setLoading(true)
      const supabase = createClient()

      try {
        const [tenantFeaturesRes, userProfileRes] = await Promise.all([
          supabase
            .from("tenant_features")
            .select("feature_key, enabled")
            .eq("company_id", companyId),
          supabase
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .single(),
        ])

        const userRole = (userProfileRes.data as any)?.role as string | null

        const tenantFeaturesData = (tenantFeaturesRes.data ?? []) as {
          feature_key: FeatureKey
          enabled: boolean
        }[]

        let rolePermissionsData: { permission_key: PermissionKey; enabled: boolean }[] = []
        if (userRole) {
          const rolePermissionsRes = await supabase
            .from("role_permissions")
            .select("permission_key, enabled")
            .eq("company_id", companyId)
            .eq("role", userRole)

          rolePermissionsData = ((rolePermissionsRes.data ?? []) as any) as {
            permission_key: PermissionKey
            enabled: boolean
          }[]
        }

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
          if (row.permission_key) nextPermissions[row.permission_key] = Boolean(row.enabled)
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

    // aguardar userLoading para evitar fetch sem userId/companyId ainda carregados
    if (!userLoading) load()

    return () => {
      alive = false
    }
  }, [companyId, userId, isSuperAdmin, userLoading])

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

