import type { PurchaseOrderApi } from "@/lib/api/external/mappers/purchase-order"
import type { TenantFeatureConfig } from "@/lib/settings/tenant-feature-settings"

/** Remove campos não habilitados nas configurações do tenant no payload outbound ERP. */
export function applyImplantationToPurchaseOrderPayload(
  payload: PurchaseOrderApi,
  config: TenantFeatureConfig,
): PurchaseOrderApi {
  const items = payload.items.map((item) => {
    const next = { ...item }

    if (!config.porEnabled) {
      delete (next as { price_unit?: unknown }).price_unit
      if (next.unit_price != null && next.quantity != null) {
        next.total_price = Number(
          (Number(next.quantity) * Number(next.unit_price)).toFixed(2),
        )
      }
    }

    if (!config.accountAssignmentEnabled) {
      delete (next as { account_configuration?: unknown }).account_configuration
      delete (next as { account_assignments?: unknown }).account_assignments
      if (config.erpVendor !== "sap") {
        delete (next as { sap_extensions?: unknown }).sap_extensions
      }
    } else if (config.erpVendor !== "sap") {
      next.sap_extensions = {}
    }

    return next
  })

  const result = { ...payload, items }

  if (!config.accountAssignmentEnabled && config.erpVendor !== "sap") {
    delete (result as { sap_header_extensions?: unknown }).sap_header_extensions
  }

  return result
}
