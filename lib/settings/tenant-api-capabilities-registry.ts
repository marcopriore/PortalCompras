import {
  isOutboundIntegrationAction,
  type OutboundIntegrationAction,
} from "@/lib/integrations/types"
import type { ApiScope } from "@/lib/api/external/scopes"

/** Chave em `company_settings` (JSON). */
export const API_CAPABILITIES_SETTING_KEY = "api_capabilities" as const

export const API_HTTP_METHODS = ["GET", "POST", "PUT", "DELETE"] as const
export type ApiHttpMethod = (typeof API_HTTP_METHODS)[number]

export const API_MATRIX_RESOURCES = [
  "items",
  "suppliers",
  "requisitions",
  "quotations",
  "orders",
  "contracts",
  "approvals",
  "reports",
] as const

export type ApiMatrixResource = (typeof API_MATRIX_RESOURCES)[number]

export type ApiMethodFlags = Partial<Record<ApiHttpMethod, boolean>>

export type TenantApiCapabilities = {
  inbound: Record<ApiMatrixResource, ApiMethodFlags>
  outbound: Record<ApiMatrixResource, ApiMethodFlags>
}

export type ApiMatrixCell =
  | { kind: "toggle"; method: ApiHttpMethod }
  | { kind: "na" }

export type ApiMatrixRowDefinition = {
  resource: ApiMatrixResource
  label: string
  endpoint: string
  cells: Record<ApiHttpMethod, ApiMatrixCell>
}

/**
 * Layout da matriz (Admin). `na` = traço; `toggle` = checkbox.
 * Alinhado ao mockup + métodos reais da Loja de API / outbound ERP.
 */
export const INBOUND_MATRIX_ROWS: ApiMatrixRowDefinition[] = [
  {
    resource: "items",
    label: "Itens",
    endpoint: "/api/v1/items",
    cells: {
      GET: { kind: "toggle", method: "GET" },
      POST: { kind: "toggle", method: "POST" },
      PUT: { kind: "toggle", method: "PUT" },
      DELETE: { kind: "toggle", method: "DELETE" },
    },
  },
  {
    resource: "suppliers",
    label: "Fornecedores",
    endpoint: "/api/v1/suppliers",
    cells: {
      GET: { kind: "toggle", method: "GET" },
      POST: { kind: "toggle", method: "POST" },
      PUT: { kind: "toggle", method: "PUT" },
      DELETE: { kind: "toggle", method: "DELETE" },
    },
  },
  {
    resource: "requisitions",
    label: "Requisições",
    endpoint: "/api/v1/requisitions",
    cells: {
      GET: { kind: "toggle", method: "GET" },
      POST: { kind: "toggle", method: "POST" },
      PUT: { kind: "toggle", method: "PUT" },
      DELETE: { kind: "na" },
    },
  },
  {
    resource: "quotations",
    label: "Cotações",
    endpoint: "/api/v1/quotations",
    cells: {
      GET: { kind: "toggle", method: "GET" },
      POST: { kind: "toggle", method: "POST" },
      PUT: { kind: "na" },
      DELETE: { kind: "na" },
    },
  },
  {
    resource: "orders",
    label: "Pedidos",
    endpoint: "/api/v1/purchase-orders",
    cells: {
      GET: { kind: "toggle", method: "GET" },
      POST: { kind: "na" },
      PUT: { kind: "na" },
      DELETE: { kind: "na" },
    },
  },
  {
    resource: "contracts",
    label: "Contratos",
    endpoint: "/api/v1/contracts",
    cells: {
      GET: { kind: "toggle", method: "GET" },
      POST: { kind: "na" },
      PUT: { kind: "na" },
      DELETE: { kind: "na" },
    },
  },
  {
    resource: "approvals",
    label: "Aprovações",
    endpoint: "/api/v1/approvals",
    cells: {
      GET: { kind: "toggle", method: "GET" },
      POST: { kind: "toggle", method: "POST" },
      PUT: { kind: "na" },
      DELETE: { kind: "na" },
    },
  },
  {
    resource: "reports",
    label: "Relatórios",
    endpoint: "/api/v1/reports",
    cells: {
      GET: { kind: "toggle", method: "GET" },
      POST: { kind: "na" },
      PUT: { kind: "na" },
      DELETE: { kind: "na" },
    },
  },
]

export const OUTBOUND_MATRIX_ROWS: ApiMatrixRowDefinition[] = [
  {
    resource: "items",
    label: "Itens",
    endpoint: "—",
    cells: {
      GET: { kind: "na" },
      POST: { kind: "na" },
      PUT: { kind: "na" },
      DELETE: { kind: "na" },
    },
  },
  {
    resource: "suppliers",
    label: "Fornecedores",
    endpoint: "—",
    cells: {
      GET: { kind: "na" },
      POST: { kind: "na" },
      PUT: { kind: "na" },
      DELETE: { kind: "na" },
    },
  },
  {
    resource: "requisitions",
    label: "Requisições",
    endpoint: "ERP (requisition.*)",
    cells: {
      GET: { kind: "toggle", method: "GET" },
      POST: { kind: "toggle", method: "POST" },
      PUT: { kind: "toggle", method: "PUT" },
      DELETE: { kind: "toggle", method: "DELETE" },
    },
  },
  {
    resource: "quotations",
    label: "Cotações",
    endpoint: "—",
    cells: {
      GET: { kind: "na" },
      POST: { kind: "na" },
      PUT: { kind: "na" },
      DELETE: { kind: "na" },
    },
  },
  {
    resource: "orders",
    label: "Pedidos",
    endpoint: "ERP (purchase_order.*)",
    cells: {
      GET: { kind: "na" },
      POST: { kind: "toggle", method: "POST" },
      PUT: { kind: "toggle", method: "PUT" },
      DELETE: { kind: "toggle", method: "DELETE" },
    },
  },
  {
    resource: "contracts",
    label: "Contratos",
    endpoint: "ERP (contract.create)",
    cells: {
      GET: { kind: "na" },
      POST: { kind: "toggle", method: "POST" },
      PUT: { kind: "na" },
      DELETE: { kind: "na" },
    },
  },
  {
    resource: "approvals",
    label: "Aprovações",
    endpoint: "—",
    cells: {
      GET: { kind: "na" },
      POST: { kind: "na" },
      PUT: { kind: "na" },
      DELETE: { kind: "na" },
    },
  },
  {
    resource: "reports",
    label: "Relatórios",
    endpoint: "—",
    cells: {
      GET: { kind: "na" },
      POST: { kind: "na" },
      PUT: { kind: "na" },
      DELETE: { kind: "na" },
    },
  },
]

/** Outbound: método da matriz → ação(ões) ERP. */
export const OUTBOUND_METHOD_TO_ACTIONS: Partial<
  Record<ApiMatrixResource, Partial<Record<ApiHttpMethod, OutboundIntegrationAction[]>>>
> = {
  orders: {
    POST: ["purchase_order.create"],
    PUT: ["purchase_order.update"],
    DELETE: ["purchase_order.delete"],
  },
  contracts: {
    POST: ["contract.create"],
  },
  requisitions: {
    /** GET = decisões (aprovada/rejeitada) enviadas ao ERP */
    GET: ["requisition.approved", "requisition.rejected"],
    POST: ["requisition.created"],
    PUT: ["requisition.updated"],
    DELETE: ["requisition.cancelled"],
  },
}

export function emptyMethodFlags(): ApiMethodFlags {
  return {}
}

export function buildEmptyApiCapabilities(): TenantApiCapabilities {
  const inbound = {} as Record<ApiMatrixResource, ApiMethodFlags>
  const outbound = {} as Record<ApiMatrixResource, ApiMethodFlags>
  for (const resource of API_MATRIX_RESOURCES) {
    inbound[resource] = emptyMethodFlags()
    outbound[resource] = emptyMethodFlags()
  }
  return { inbound, outbound }
}

/** Sem chave salva: preserva comportamento anterior à matriz. */
export function buildLegacyApiCapabilities(): TenantApiCapabilities {
  const caps = buildEmptyApiCapabilities()
  for (const row of INBOUND_MATRIX_ROWS) {
    for (const method of API_HTTP_METHODS) {
      if (row.cells[method].kind === "toggle") {
        caps.inbound[row.resource][method] = true
      }
    }
  }
  caps.outbound.orders.POST = true
  caps.outbound.orders.PUT = true
  caps.outbound.orders.DELETE = true
  caps.outbound.contracts.POST = true
  return caps
}

const SCOPE_RESOURCE: Partial<
  Record<ApiScope, { resource: ApiMatrixResource; writeMethods: ApiHttpMethod[] }>
> = {
  "items:read": { resource: "items", writeMethods: [] },
  "items:write": { resource: "items", writeMethods: ["POST", "PUT", "DELETE"] },
  "suppliers:read": { resource: "suppliers", writeMethods: [] },
  "suppliers:write": { resource: "suppliers", writeMethods: ["POST", "PUT", "DELETE"] },
  "requisitions:read": { resource: "requisitions", writeMethods: [] },
  "requisitions:write": { resource: "requisitions", writeMethods: ["POST", "PUT"] },
  "quotations:read": { resource: "quotations", writeMethods: [] },
  "quotations:write": { resource: "quotations", writeMethods: ["POST"] },
  "orders:read": { resource: "orders", writeMethods: [] },
  "contracts:read": { resource: "contracts", writeMethods: [] },
  "approvals:read": { resource: "approvals", writeMethods: [] },
  "approvals:write": { resource: "approvals", writeMethods: ["POST"] },
  "reports:read": { resource: "reports", writeMethods: [] },
}

export function resolveInboundCapability(
  scope: ApiScope,
  httpMethod: string,
): { resource: ApiMatrixResource; method: ApiHttpMethod } | null {
  const mapped = SCOPE_RESOURCE[scope]
  if (!mapped) return null
  const method = httpMethod.toUpperCase() as ApiHttpMethod
  if (!(API_HTTP_METHODS as readonly string[]).includes(method)) return null

  if (scope.endsWith(":read")) {
    return { resource: mapped.resource, method: "GET" }
  }

  if (!mapped.writeMethods.includes(method)) {
    // POST em rota de write ainda mapeia para POST mesmo se GET
    if (method === "GET") return { resource: mapped.resource, method: "GET" }
    return { resource: mapped.resource, method }
  }

  return { resource: mapped.resource, method }
}

export function isApiMatrixResource(value: string): value is ApiMatrixResource {
  return (API_MATRIX_RESOURCES as readonly string[]).includes(value)
}

export function isApiHttpMethod(value: string): value is ApiHttpMethod {
  return (API_HTTP_METHODS as readonly string[]).includes(value)
}

/** @deprecated aliases — matriz v2 usa API_MATRIX_RESOURCES + métodos HTTP */
export const INBOUND_API_CAPABILITIES = [
  "inbound.items",
  "inbound.suppliers",
  "inbound.requisitions",
  "inbound.quotations",
  "inbound.orders",
  "inbound.contracts",
  "inbound.approvals",
  "inbound.reports",
] as const

export function isInboundApiCapability(value: string): boolean {
  return (INBOUND_API_CAPABILITIES as readonly string[]).includes(value)
}

export function isOutboundApiCapability(value: string): boolean {
  return isOutboundIntegrationAction(value)
}

/** @deprecated use INBOUND_MATRIX_ROWS */
export const OUTBOUND_API_CAPABILITY_DEFINITIONS = OUTBOUND_MATRIX_ROWS
/** @deprecated use INBOUND_MATRIX_ROWS */
export const INBOUND_API_CAPABILITY_DEFINITIONS = INBOUND_MATRIX_ROWS

/** @deprecated aliases para UI antiga / testes */
export type InboundApiCapability = `inbound.${ApiMatrixResource}`
export type OutboundApiCapability = OutboundIntegrationAction
