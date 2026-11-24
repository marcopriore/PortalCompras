"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { canWritePermission } from "@/lib/permissions/write-access"
import { queryKeys } from "@/lib/queries/keys"
import {
  emptyFeatures,
  emptyPermissions,
  fetchPermissions,
  fullAccessPermissions,
} from "@/lib/queries/permissions"

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
  | "approval_catalog_order"
  | "ai_analytics"
  | "ai_negotiation"
  | "ai_negotiation_autonomous"
  | "contracts"
  | "contract_balance"
  | "api_integrations"
  | "purchase_catalog"

export type PermissionKey =
  | "nav.dashboard"
  | "nav.requisitions"
  | "nav.quotations"
  | "nav.orders"
  | "nav.contracts"
  | "nav.items"
  | "nav.suppliers"
  | "nav.reports"
  | "nav.catalog"
  | "dashboard.metrics"
  | "dashboard.spend_category"
  | "dashboard.quotation_status"
  | "dashboard.recent_activity"
  | "dashboard.lead_time"
  | "dashboard.roi"
  | "reports.saving"
  | "reports.spend"
  | "reports.orders"
  | "reports.quotations"
  | "reports.export.spend_category"
  | "reports.export.supplier_performance"
  | "reports.export.saving"
  | "reports.export.process_time"
  | "quotation.create"
  | "quotation.edit"
  | "quotation.cancel"
  | "quotation.equalize.view"
  | "quotation.equalize.select"
  | "quotation.view_all"
  | "quotation.delegate"
  | "order.create"
  | "order.edit"
  | "order.edit_own"
  | "order.view_all"
  | "order.delegate"
  | "contract.view"
  | "contract.create"
  | "contract.edit"
  | "requisition.create.buyer"
  | "requisition.create.requester"
  | "requisition.approve"
  | "requisition.view_all"
  | "approval.requisition"
  | "approval.order"
  | "approval.catalog_order"
  | "approval.view_all"
  | "export.excel"
  | "import.excel"
  | "erp.sync"
  | "integration.monitor"
  | "supplier.create"
  | "supplier.edit"
  | "item.create"
  | "item.edit"
  | "user.manage"
  | "user.impersonate"
  | "settings.manage"
  | "portal.solicitante"
  | "view_only"
  | "catalog.view"
  | "catalog.order"
  | "catalog.buyer_review"

export type UsePermissionsReturn = {
  loading: boolean
  hasFeature: (feature: FeatureKey) => boolean
  hasPermission: (permission: PermissionKey) => boolean
  canWrite: (permission: PermissionKey) => boolean
  features: Record<FeatureKey, boolean>
  permissions: Record<PermissionKey, boolean>
}

export function usePermissions(): UsePermissionsReturn {
  const {
    userId,
    companyId,
    isSuperAdmin,
    isImpersonating,
    loading: userLoading,
  } = useUser()

  const enabled =
    !userLoading &&
    Boolean(companyId) &&
    Boolean(userId) &&
    !(isSuperAdmin && !isImpersonating)

  const query = useQuery({
    queryKey: queryKeys.permissions(companyId ?? "", userId ?? ""),
    enabled,
    queryFn: async () => {
      const supabase = createClient()
      return fetchPermissions(supabase, companyId!, userId!)
    },
    refetchOnWindowFocus: true,
  })

  const payload = React.useMemo(() => {
    if (isSuperAdmin && !isImpersonating) return fullAccessPermissions()
    return (
      query.data ?? {
        features: emptyFeatures(),
        permissions: emptyPermissions(),
      }
    )
  }, [isSuperAdmin, isImpersonating, query.data])

  const hasFeature = React.useCallback(
    (feature: FeatureKey) => Boolean(payload.features[feature]),
    [payload.features],
  )
  const hasPermission = React.useCallback(
    (permission: PermissionKey) => Boolean(payload.permissions[permission]),
    [payload.permissions],
  )
  const canWrite = React.useCallback(
    (permission: PermissionKey) =>
      canWritePermission(payload.permissions, permission),
    [payload.permissions],
  )

  const loading =
    userLoading ||
    (isSuperAdmin && !isImpersonating
      ? false
      : enabled
        ? query.isLoading
        : true)

  return {
    loading,
    hasFeature,
    hasPermission,
    canWrite,
    features: payload.features,
    permissions: payload.permissions,
  }
}

export default usePermissions
