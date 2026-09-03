import { describe, expect, it } from "vitest"
import {
  buildEmptyApiCapabilities,
  buildLegacyApiCapabilities,
} from "@/lib/settings/tenant-api-capabilities-registry"
import {
  isOutboundCapabilityEnabled,
  parseTenantApiCapabilities,
  serializeTenantApiCapabilities,
  validateTenantApiCapabilitiesPatch,
} from "@/lib/settings/tenant-api-capabilities"

describe("tenant-api-capabilities (matriz método)", () => {
  it("chave ausente = legado (inbound aberto + PO/contrato outbound)", () => {
    const caps = parseTenantApiCapabilities(null)
    expect(caps.inbound.items.GET).toBe(true)
    expect(caps.inbound.requisitions.POST).toBe(true)
    expect(caps.outbound.orders.POST).toBe(true)
    expect(caps.outbound.contracts.POST).toBe(true)
    expect(caps.outbound.requisitions.POST).toBeUndefined()
  })

  it("tenant novo começa tudo off", () => {
    const caps = buildEmptyApiCapabilities()
    expect(caps.inbound.items.GET).toBeUndefined()
    expect(caps.outbound.orders.POST).toBeUndefined()
  })

  it("mapeia ação outbound a partir do método", () => {
    const caps = buildLegacyApiCapabilities()
    caps.outbound.requisitions.POST = true
    caps.outbound.requisitions.GET = true
    expect(isOutboundCapabilityEnabled(caps, "requisition.created")).toBe(true)
    expect(isOutboundCapabilityEnabled(caps, "requisition.approved")).toBe(true)
    expect(isOutboundCapabilityEnabled(caps, "requisition.updated")).toBe(false)
  })

  it("migra formato v1 flat", () => {
    const v1 = JSON.stringify({
      inbound: { "inbound.items": true },
      outbound: { "purchase_order.create": true, "requisition.created": true },
    })
    const caps = parseTenantApiCapabilities(v1)
    expect(caps.inbound.items.GET).toBe(true)
    expect(caps.outbound.orders.POST).toBe(true)
    expect(caps.outbound.requisitions.POST).toBe(true)
  })

  it("round-trip e validação", () => {
    const caps = buildEmptyApiCapabilities()
    caps.inbound.items.GET = true
    caps.outbound.orders.PUT = true
    const again = parseTenantApiCapabilities(serializeTenantApiCapabilities(caps))
    expect(again.inbound.items.GET).toBe(true)
    expect(again.outbound.orders.PUT).toBe(true)

    const ok = validateTenantApiCapabilitiesPatch({
      inbound: { items: { GET: true } },
      outbound: { orders: { POST: true } },
    })
    expect(ok.ok).toBe(true)

    const bad = validateTenantApiCapabilitiesPatch({
      inbound: { foo: { GET: true } },
    })
    expect(bad.ok).toBe(false)
  })
})
