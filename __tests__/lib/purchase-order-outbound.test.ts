import { describe, expect, it } from "vitest"
import { applyImplantationToPurchaseOrderPayload } from "@/lib/integrations/purchase-order-outbound"
import type { PurchaseOrderApi } from "@/lib/api/external/mappers/purchase-order"
import type { TenantFeatureConfig } from "@/lib/settings/tenant-feature-settings"

function basePayload(): PurchaseOrderApi {
  return {
    id: "po-1",
    code: "PO-001",
    status: "sent",
    items: [
      {
        material_code: "MAT-1",
        quantity: 10,
        unit_price: 1.5,
        price_unit: 10_000,
        total_price: 150_000,
        account_configuration: { category: "K" },
        account_assignments: [{ sequence: 1, apportionment_percent: 100, currency: "BRL" }],
        sap_extensions: { foo: "bar" },
      },
    ],
    sap_header_extensions: { header: true },
  } as unknown as PurchaseOrderApi
}

function withHeaderExtensions(payload: PurchaseOrderApi) {
  return payload as PurchaseOrderApi & {
    sap_header_extensions?: Record<string, unknown>
  }
}

function allEnabled() {
  return {
    accountAssignmentEnabled: true,
    porEnabled: true,
    erpIntegrationEnabled: true,
    erpVendor: "sap" as const,
  }
}

describe("applyImplantationToPurchaseOrderPayload", () => {
  it("remove POR e recalcula total quando POR desabilitado", () => {
    const payload = basePayload()
    const config = { ...allEnabled(), porEnabled: false }

    const result = applyImplantationToPurchaseOrderPayload(payload, config)

    expect(result.items[0].price_unit).toBeUndefined()
    expect(result.items[0].total_price).toBe(15)
  })

  it("remove account assignment quando desabilitado", () => {
    const payload = basePayload()
    const config = { ...allEnabled(), accountAssignmentEnabled: false, erpVendor: "other" as const }

    const result = applyImplantationToPurchaseOrderPayload(payload, config)

    expect(result.items[0].account_configuration).toBeUndefined()
    expect(result.items[0].account_assignments).toBeUndefined()
    expect(result.items[0].sap_extensions).toBeUndefined()
    expect(withHeaderExtensions(result).sap_header_extensions).toBeUndefined()
  })

  it("mantém extensões SAP quando account assignment ativo e vendor SAP", () => {
    const payload = basePayload()
    const result = applyImplantationToPurchaseOrderPayload(payload, allEnabled())

    expect(result.items[0].sap_extensions).toEqual({ foo: "bar" })
    expect(withHeaderExtensions(result).sap_header_extensions).toEqual({ header: true })
  })

  it("zera sap_extensions por item quando vendor não é SAP", () => {
    const payload = basePayload()
    const config = { ...allEnabled(), erpVendor: "other" as const }

    const result = applyImplantationToPurchaseOrderPayload(payload, config)

    expect(result.items[0].sap_extensions).toEqual({})
    expect(withHeaderExtensions(result).sap_header_extensions).toEqual({ header: true })
  })
})
