import type { SupabaseClient } from "@supabase/supabase-js"
import type { OutboundIntegrationAction } from "@/lib/integrations/types"
import { isOutboundIntegrationAction } from "@/lib/integrations/types"
// Matriz v2 (GET/POST/PUT/DELETE) — não usar exports legados INBOUND_API_CAPABILITIES
import {
  API_CAPABILITIES_SETTING_KEY,
  API_HTTP_METHODS,
  API_MATRIX_RESOURCES,
  INBOUND_MATRIX_ROWS,
  OUTBOUND_MATRIX_ROWS,
  OUTBOUND_METHOD_TO_ACTIONS,
  buildEmptyApiCapabilities,
  buildLegacyApiCapabilities,
  isApiHttpMethod,
  isApiMatrixResource,
  type ApiHttpMethod,
  type ApiMatrixResource,
  type ApiMethodFlags,
  type TenantApiCapabilities,
} from "@/lib/settings/tenant-api-capabilities-registry"

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "string") {
    const v = value.trim().toLowerCase()
    if (v === "1" || v === "true" || v === "yes" || v === "on") return true
    if (v === "0" || v === "false" || v === "no" || v === "off") return false
  }
  return fallback
}

function parseMethodFlags(raw: unknown): ApiMethodFlags {
  const out: ApiMethodFlags = {}
  if (!raw || typeof raw !== "object") return out
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isApiHttpMethod(key)) out[key] = asBool(value, false)
  }
  return out
}

/** Formato antigo (v1): inbound.items boolean / outbound["purchase_order.create"] */
function migrateFromV1Flat(parsed: {
  inbound?: Record<string, unknown>
  outbound?: Record<string, unknown>
}): TenantApiCapabilities | null {
  const inbound = parsed.inbound
  const outbound = parsed.outbound
  if (!inbound && !outbound) return null

  const looksV2 =
    inbound &&
    typeof inbound === "object" &&
    API_MATRIX_RESOURCES.some((r) => {
      const cell = (inbound as Record<string, unknown>)[r]
      return cell != null && typeof cell === "object" && !Array.isArray(cell)
    })
  if (looksV2) return null

  const caps = buildEmptyApiCapabilities()

  if (inbound && typeof inbound === "object") {
    const map: Record<string, ApiMatrixResource> = {
      "inbound.items": "items",
      "inbound.suppliers": "suppliers",
      "inbound.requisitions": "requisitions",
      "inbound.quotations": "quotations",
      "inbound.orders": "orders",
      "inbound.contracts": "contracts",
      "inbound.approvals": "approvals",
      "inbound.reports": "reports",
    }
    for (const [key, value] of Object.entries(inbound)) {
      const resource = map[key] ?? (isApiMatrixResource(key) ? key : null)
      if (!resource || !asBool(value, false)) continue
      const row = INBOUND_MATRIX_ROWS.find((r) => r.resource === resource)
      if (!row) continue
      for (const method of API_HTTP_METHODS) {
        if (row.cells[method].kind === "toggle") {
          caps.inbound[resource][method] = true
        }
      }
    }
  }

  if (outbound && typeof outbound === "object") {
    const actionToCell: Partial<
      Record<OutboundIntegrationAction, { resource: ApiMatrixResource; method: ApiHttpMethod }>
    > = {
      "purchase_order.create": { resource: "orders", method: "POST" },
      "purchase_order.update": { resource: "orders", method: "PUT" },
      "purchase_order.delete": { resource: "orders", method: "DELETE" },
      "contract.create": { resource: "contracts", method: "POST" },
      "requisition.created": { resource: "requisitions", method: "POST" },
      "requisition.updated": { resource: "requisitions", method: "PUT" },
      "requisition.cancelled": { resource: "requisitions", method: "DELETE" },
      "requisition.approved": { resource: "requisitions", method: "GET" },
      "requisition.rejected": { resource: "requisitions", method: "GET" },
    }
    for (const [key, value] of Object.entries(outbound)) {
      if (!asBool(value, false)) continue
      if (!isOutboundIntegrationAction(key)) continue
      const cell = actionToCell[key]
      if (cell) caps.outbound[cell.resource][cell.method] = true
    }
  }

  return caps
}

export function parseTenantApiCapabilities(
  raw: string | null | undefined,
): TenantApiCapabilities {
  if (raw == null || String(raw).trim() === "") {
    return buildLegacyApiCapabilities()
  }

  try {
    const parsed = JSON.parse(String(raw)) as {
      inbound?: Record<string, unknown>
      outbound?: Record<string, unknown>
    }

    const migrated = migrateFromV1Flat(parsed)
    if (migrated) return migrated

    const caps = buildEmptyApiCapabilities()
    for (const resource of API_MATRIX_RESOURCES) {
      if (parsed.inbound && typeof parsed.inbound[resource] === "object") {
        caps.inbound[resource] = parseMethodFlags(parsed.inbound[resource])
      }
      if (parsed.outbound && typeof parsed.outbound[resource] === "object") {
        caps.outbound[resource] = parseMethodFlags(parsed.outbound[resource])
      }
    }
    return caps
  } catch {
    return buildLegacyApiCapabilities()
  }
}

export function serializeTenantApiCapabilities(
  caps: TenantApiCapabilities,
): string {
  return JSON.stringify(caps)
}

export function validateTenantApiCapabilitiesPatch(
  body: unknown,
):
  | { ok: true; capabilities: TenantApiCapabilities }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Matriz de APIs inválida." }
  }

  const raw = body as {
    inbound?: Record<string, unknown>
    outbound?: Record<string, unknown>
  }

  const capabilities = buildEmptyApiCapabilities()

  for (const direction of ["inbound", "outbound"] as const) {
    const block = raw[direction]
    if (block == null) continue
    if (typeof block !== "object") {
      return { ok: false, error: `Bloco ${direction} inválido.` }
    }
    for (const [resourceKey, methodsRaw] of Object.entries(block)) {
      if (!isApiMatrixResource(resourceKey)) {
        return { ok: false, error: `Recurso desconhecido: ${resourceKey}` }
      }
      if (methodsRaw == null) continue
      if (typeof methodsRaw !== "object") {
        return { ok: false, error: `Métodos inválidos em ${resourceKey}` }
      }
      const row =
        direction === "inbound"
          ? INBOUND_MATRIX_ROWS.find((r) => r.resource === resourceKey)
          : OUTBOUND_MATRIX_ROWS.find((r) => r.resource === resourceKey)
      for (const [methodKey, value] of Object.entries(
        methodsRaw as Record<string, unknown>,
      )) {
        if (!isApiHttpMethod(methodKey)) {
          return { ok: false, error: `Método inválido: ${methodKey}` }
        }
        if (row && row.cells[methodKey].kind === "na") {
          continue
        }
        if (typeof value !== "boolean") {
          return {
            ok: false,
            error: `Valor inválido para ${direction}.${resourceKey}.${methodKey}`,
          }
        }
        capabilities[direction][resourceKey][methodKey] = value
      }
    }
  }

  return { ok: true, capabilities }
}

export async function loadTenantApiCapabilities(
  supabase: SupabaseClient,
  companyId: string,
): Promise<TenantApiCapabilities> {
  const { data, error } = await supabase
    .from("company_settings")
    .select("value")
    .eq("company_id", companyId)
    .eq("key", API_CAPABILITIES_SETTING_KEY)
    .maybeSingle()

  if (error) {
    console.error("loadTenantApiCapabilities:", error)
    return buildLegacyApiCapabilities()
  }

  return parseTenantApiCapabilities(
    data?.value != null ? String(data.value) : null,
  )
}

export function isInboundMethodEnabled(
  caps: TenantApiCapabilities,
  resource: ApiMatrixResource,
  method: ApiHttpMethod,
): boolean {
  return Boolean(caps.inbound[resource]?.[method])
}

export function isOutboundCapabilityEnabled(
  caps: TenantApiCapabilities,
  action: OutboundIntegrationAction,
): boolean {
  for (const [resource, methods] of Object.entries(OUTBOUND_METHOD_TO_ACTIONS)) {
    if (!methods) continue
    for (const [method, actions] of Object.entries(methods)) {
      if (!actions?.includes(action)) continue
      return Boolean(
        caps.outbound[resource as ApiMatrixResource]?.[method as ApiHttpMethod],
      )
    }
  }
  return false
}

export async function companyAllowsInboundCapability(
  supabase: SupabaseClient,
  companyId: string,
  resource: ApiMatrixResource,
  method: ApiHttpMethod,
): Promise<boolean> {
  const caps = await loadTenantApiCapabilities(supabase, companyId)
  return isInboundMethodEnabled(caps, resource, method)
}

export async function companyAllowsOutboundCapability(
  supabase: SupabaseClient,
  companyId: string,
  action: OutboundIntegrationAction,
): Promise<boolean> {
  const caps = await loadTenantApiCapabilities(supabase, companyId)
  return isOutboundCapabilityEnabled(caps, action)
}

export function listEnabledOutboundActions(
  caps: TenantApiCapabilities,
): OutboundIntegrationAction[] {
  const out = new Set<OutboundIntegrationAction>()
  for (const [resource, methods] of Object.entries(OUTBOUND_METHOD_TO_ACTIONS)) {
    if (!methods) continue
    for (const [method, actions] of Object.entries(methods)) {
      if (!caps.outbound[resource as ApiMatrixResource]?.[method as ApiHttpMethod]) {
        continue
      }
      for (const action of actions ?? []) out.add(action)
    }
  }
  return [...out]
}

/** @deprecated */
export function isInboundCapabilityEnabled(
  caps: TenantApiCapabilities,
  key: string,
): boolean {
  const resource = key.replace(/^inbound\./, "")
  if (!isApiMatrixResource(resource)) return false
  return API_HTTP_METHODS.some((m) => isInboundMethodEnabled(caps, resource, m))
}
