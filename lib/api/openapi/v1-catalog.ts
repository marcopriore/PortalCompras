export type ApiDocField = {
  name: string
  type: string
  required?: boolean
  description: string
  example?: string | number | boolean | null
}

export type ApiDocEndpoint = {
  id: string
  group: string
  method: "GET" | "POST" | "PUT" | "DELETE"
  path: string
  title: string
  description: string
  scope?: string
  tenantFeature?: string
  queryParams?: ApiDocField[]
  pathParams?: ApiDocField[]
  bodyFields?: ApiDocField[]
  requestExample?: string
  responseExample?: string
}

export const API_V1_BASE = "/api/v1"

export const API_ERROR_CODES = [
  { code: "UNAUTHORIZED", http: 401, description: "API key ausente ou inválida" },
  { code: "FORBIDDEN", http: 403, description: "Escopo insuficiente ou módulo desabilitado" },
  { code: "NOT_FOUND", http: 404, description: "Recurso não encontrado" },
  { code: "VALIDATION_ERROR", http: 400, description: "Payload ou parâmetros inválidos" },
  { code: "CONFLICT", http: 409, description: "Conflito (ex.: código duplicado)" },
  { code: "RATE_LIMITED", http: 429, description: "Limite de requisições excedido" },
  { code: "INTERNAL_ERROR", http: 500, description: "Erro interno" },
] as const

export const API_DOC_ENDPOINTS: ApiDocEndpoint[] = [
  {
    id: "health",
    group: "Geral",
    method: "GET",
    path: "/health",
    title: "Health check",
    description:
      "Valida a API key, a feature api_integrations do tenant e retorna metadados da chave.",
    requestExample: undefined,
    responseExample: `{
  "data": {
    "status": "ok",
    "company_id": "00000000-0000-0000-0000-000000000001",
    "scopes": ["items:read", "orders:read"]
  }
}`,
  },
  {
    id: "items-list",
    group: "Itens",
    method: "GET",
    path: "/items",
    title: "Listar itens",
    description: "Catálogo de materiais do tenant com paginação e filtros.",
    scope: "items:read",
    tenantFeature: "items",
    queryParams: [
      { name: "page", type: "integer", description: "Página (1-based)", example: 1 },
      { name: "page_size", type: "integer", description: "Tamanho da página (máx. 100)", example: 50 },
      { name: "code", type: "string", description: "Filtro exato por código" },
      { name: "search", type: "string", description: "Busca em code e descrições" },
      { name: "updated_since", type: "string (ISO 8601)", description: "Itens alterados desde a data" },
    ],
    responseExample: `{
  "data": {
    "items": [{ "code": "MAT-001", "short_description": "Parafuso", "unit_of_measure": "UN" }],
    "page": 1, "page_size": 50, "total": 120, "total_pages": 3
  }
}`,
  },
  {
    id: "items-batch-post",
    group: "Itens",
    method: "POST",
    path: "/items/batch",
    title: "Criar itens (lote)",
    description: "Criação em lote. Rejeita codes duplicados com 409.",
    scope: "items:write",
    tenantFeature: "items",
    bodyFields: [
      { name: "items", type: "array", required: true, description: "Lista de itens (máx. 200)" },
      { name: "items[].code", type: "string", required: true, description: "Código único no tenant" },
      { name: "items[].short_description", type: "string", required: true, description: "Descrição curta" },
      { name: "items[].unit_of_measure", type: "string", required: true, description: "Unidade" },
      { name: "items[].commodity_group", type: "string", description: "Grupo de mercadoria" },
      { name: "items[].target_price", type: "number", description: "Preço alvo (Saving)" },
    ],
    requestExample: `{
  "items": [
    {
      "code": "MAT-API-001",
      "short_description": "Parafuso M8",
      "unit_of_measure": "UN",
      "commodity_group": "MRO"
    }
  ]
}`,
    responseExample: `{ "data": { "created": 1, "items": [...] } }`,
  },
  {
    id: "requisitions-post",
    group: "Requisições",
    method: "POST",
    path: "/requisitions",
    title: "Criar requisição",
    description:
      "Cria requisição com itens. external_code é obrigatório (chave do ERP). Valore gera code interno REQ-XXXX.",
    scope: "requisitions:write",
    tenantFeature: "requisitions",
    bodyFields: [
      { name: "external_code", type: "string", required: true, description: "Identificador único no ERP" },
      { name: "title", type: "string", required: true, description: "Título da requisição" },
      { name: "description", type: "string", description: "Descrição (máx. 500)" },
      { name: "cost_center", type: "string", description: "Centro de custo" },
      { name: "needed_by", type: "date (YYYY-MM-DD)", description: "Data necessidade" },
      { name: "priority", type: "enum", description: "normal | urgent | critical" },
      { name: "requester_name", type: "string", description: "Nome do solicitante no ERP" },
      { name: "items", type: "array", required: true, description: "Itens (mín. 1)" },
      { name: "items[].material_description", type: "string", required: true, description: "Descrição do item" },
      { name: "items[].quantity", type: "number", required: true, description: "Quantidade > 0" },
    ],
    requestExample: `{
  "external_code": "ERP-REQ-1001",
  "title": "Materiais manutenção",
  "items": [
    { "material_code": "MAT-001", "material_description": "Parafuso", "quantity": 50, "unit_of_measure": "UN" }
  ]
}`,
    responseExample: `{ "data": { "requisition": { "code": "REQ-0042", "external_code": "ERP-REQ-1001", "status": "pending" } } }`,
  },
  {
    id: "requisitions-delete",
    group: "Requisições",
    method: "DELETE",
    path: "/requisitions/{id}",
    title: "Cancelar requisição",
    description: "Soft cancel → status cancelled. Aceita UUID, code ou external_code.",
    scope: "requisitions:write",
    tenantFeature: "requisitions",
    pathParams: [
      { name: "id", type: "string", required: true, description: "UUID, code ou external_code" },
    ],
    responseExample: `{ "data": { "requisition": { "status": "cancelled" } } }`,
  },
  {
    id: "quotations-proposals",
    group: "Cotações",
    method: "GET",
    path: "/quotations/{id}/proposals",
    title: "Propostas por rodada",
    description:
      "Retorna quotation + rounds[] com proposals[] e items[] respondidos por fornecedor.",
    scope: "quotations:read",
    tenantFeature: "quotations",
    pathParams: [
      { name: "id", type: "string", required: true, description: "UUID ou code da cotação" },
    ],
    queryParams: [
      { name: "round_number", type: "integer", description: "Filtrar rodada" },
      { name: "supplier_code", type: "string", description: "Filtrar fornecedor" },
      { name: "status", type: "string", description: "invited | submitted | selected | rejected" },
    ],
    responseExample: `{
  "data": {
    "quotation": { "code": "COT-2026-0026" },
    "rounds": [{
      "round_number": 1,
      "proposals": [{
        "supplier": { "code": "FORN-001", "name": "Fornecedor A" },
        "items": [{ "material_code": "MAT-001", "unit_price": 10.5, "item_status": "accepted" }]
      }]
    }]
  }
}`,
  },
  {
    id: "purchase-orders-pdf",
    group: "Pedidos",
    method: "GET",
    path: "/purchase-orders/{id}/pdf",
    title: "PDF do pedido",
    description: "Retorna application/pdf (stream).",
    scope: "orders:read",
    tenantFeature: "orders",
    pathParams: [
      { name: "id", type: "string", required: true, description: "UUID, code ou external_code" },
    ],
    responseExample: "(binary PDF)",
  },
  {
    id: "contracts-list",
    group: "Contratos",
    method: "GET",
    path: "/contracts",
    title: "Listar contratos",
    description:
      "Lista contratos do tenant com paginação. Inclui saldos de cabeçalho (available_value).",
    scope: "contracts:read",
    tenantFeature: "contracts",
    queryParams: [
      { name: "page", type: "integer", description: "Página (1-based)", example: 1 },
      { name: "page_size", type: "integer", description: "Tamanho da página (máx. 100)", example: 50 },
      { name: "code", type: "string", description: "Filtro por code ou erp_code" },
      { name: "search", type: "string", description: "Busca em code, erp_code e title" },
      { name: "status", type: "string", description: "draft | pending_acceptance | active | expired | cancelled" },
      { name: "supplier_code", type: "string", description: "Código do fornecedor" },
      { name: "created_since", type: "string (ISO 8601)", description: "Criados desde a data" },
      { name: "updated_since", type: "string (ISO 8601)", description: "Alterados desde a data" },
    ],
    responseExample: `{
  "data": {
    "contracts": [{
      "code": "CTR-2026-0001",
      "status": "active",
      "supplier_code": "FORN-001",
      "available_value": 15000.5
    }],
    "page": 1, "page_size": 50, "total": 12, "total_pages": 1
  }
}`,
  },
  {
    id: "contracts-get",
    group: "Contratos",
    method: "GET",
    path: "/contracts/{id}",
    title: "Detalhe do contrato",
    description: "Retorna cabeçalho + itens (com saldos por linha). id = UUID, code ou erp_code.",
    scope: "contracts:read",
    tenantFeature: "contracts",
    pathParams: [
      { name: "id", type: "string", required: true, description: "UUID, code ou erp_code" },
    ],
    responseExample: `{
  "data": {
    "contract": {
      "code": "CTR-2026-0001",
      "status": "active",
      "available_value": 15000.5,
      "items": [{ "material_code": "MAT-001", "available_quantity": 10 }]
    }
  }
}`,
  },
  {
    id: "contracts-balance",
    group: "Contratos",
    method: "GET",
    path: "/contracts/{id}/balance",
    title: "Saldo do contrato",
    description:
      "Resumo de saldo (cabeçalho e itens): ceiling, consumido, reservado e disponível.",
    scope: "contracts:read",
    tenantFeature: "contracts",
    pathParams: [
      { name: "id", type: "string", required: true, description: "UUID, code ou erp_code" },
    ],
    responseExample: `{
  "data": {
    "balance": {
      "code": "CTR-2026-0001",
      "available_value": 15000.5,
      "items": [{ "material_code": "MAT-001", "available_quantity": 10 }]
    }
  }
}`,
  },
  {
    id: "contracts-acceptances",
    group: "Contratos",
    method: "GET",
    path: "/contracts/{id}/acceptances",
    title: "Aceites / recusas do contrato",
    description: "Histórico de aceites e recusas do fornecedor no contrato.",
    scope: "contracts:read",
    tenantFeature: "contracts",
    pathParams: [
      { name: "id", type: "string", required: true, description: "UUID, code ou erp_code" },
    ],
    responseExample: `{
  "data": {
    "code": "CTR-2026-0001",
    "acceptances": [{
      "action": "accepted",
      "created_at": "2026-08-01T12:00:00Z",
      "term_version": "1.0"
    }]
  }
}`,
  },
]

export function buildOpenApiSpec() {
  const paths: Record<string, Record<string, unknown>> = {}

  for (const ep of API_DOC_ENDPOINTS) {
    const fullPath = `${API_V1_BASE}${ep.path}`
    if (!paths[fullPath]) paths[fullPath] = {}

    paths[fullPath][ep.method.toLowerCase()] = {
      operationId: ep.id,
      summary: ep.title,
      description: [
        ep.description,
        ep.scope ? `**Escopo:** \`${ep.scope}\`` : "",
        ep.tenantFeature ? `**Feature tenant:** \`${ep.tenantFeature}\`` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      tags: [ep.group],
      security: [{ bearerAuth: [] }, { apiKeyHeader: [] }],
      responses: {
        "200": { description: "Sucesso" },
        "400": { description: "VALIDATION_ERROR" },
        "401": { description: "UNAUTHORIZED" },
        "403": { description: "FORBIDDEN" },
        "404": { description: "NOT_FOUND" },
        "409": { description: "CONFLICT" },
      },
    }
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Valore — Loja de API v1",
      version: "1.0.0",
      description:
        "API de integração ERP ↔ Valore. Autenticação via Bearer token (API key) ou header X-Api-Key.",
    },
    servers: [{ url: "/api/v1", description: "API v1" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Authorization: Bearer valore_...",
        },
        apiKeyHeader: {
          type: "apiKey",
          in: "header",
          name: "X-Api-Key",
        },
      },
    },
    paths,
  }
}

export const API_DOC_GROUPS = [...new Set(API_DOC_ENDPOINTS.map((e) => e.group))]
