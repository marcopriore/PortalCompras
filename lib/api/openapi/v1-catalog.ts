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
    id: "requisitions-attachments-list",
    group: "Requisições",
    method: "GET",
    path: "/requisitions/{id}/attachments",
    title: "Listar anexos da requisição",
    description:
      "Lista anexos com URL assinada (1h). Aceita UUID, code ou external_code.",
    scope: "requisitions:read",
    tenantFeature: "requisitions",
    pathParams: [
      { name: "id", type: "string", required: true, description: "UUID, code ou external_code" },
    ],
    responseExample: `{
  "data": {
    "attachments": [{
      "id": "…",
      "file_name": "nf.pdf",
      "file_size": 12040,
      "content_type": "application/pdf",
      "created_at": "2026-08-25T12:00:00Z",
      "download_url": "https://…"
    }]
  }
}`,
  },
  {
    id: "requisitions-attachments-post",
    group: "Requisições",
    method: "POST",
    path: "/requisitions/{id}/attachments",
    title: "Enviar anexo da requisição",
    description:
      "Upload multipart/form-data (campo file). PDF, Excel ou imagem png/jpg; máx. 10MB. Bloqueado se a requisição estiver cancelled.",
    scope: "requisitions:write",
    tenantFeature: "requisitions",
    pathParams: [
      { name: "id", type: "string", required: true, description: "UUID, code ou external_code" },
    ],
    bodyFields: [
      {
        name: "file",
        type: "file (multipart)",
        required: true,
        description: "Arquivo PDF, Excel (.xls/.xlsx) ou imagem (png/jpg). Máx. 10MB.",
      },
    ],
    requestExample: `curl -X POST "$BASE/requisitions/ERP-REQ-1001/attachments" \\
  -H "Authorization: Bearer $API_KEY" \\
  -F "file=@nf.pdf;type=application/pdf"`,
    responseExample: `{
  "data": {
    "attachment": {
      "id": "…",
      "file_name": "nf.pdf",
      "download_url": "https://…"
    }
  }
}`,
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
    id: "quotations-invite",
    group: "Cotações",
    method: "POST",
    path: "/quotations/{id}/invites",
    title: "Convidar fornecedor",
    description:
      "Adiciona o fornecedor em quotation_suppliers. Se houver rodada active, cria quotation_proposals com status invited. Bloqueado se a cotação estiver completed ou cancelled.",
    scope: "quotations:write",
    tenantFeature: "quotations",
    pathParams: [
      { name: "id", type: "string", required: true, description: "UUID ou code da cotação" },
    ],
    bodyFields: [
      {
        name: "supplier_code",
        type: "string",
        required: true,
        description: "Código do fornecedor no tenant",
      },
    ],
    requestExample: `{ "supplier_code": "FORN-001" }`,
    responseExample: `{
  "data": {
    "invitation": {
      "quotation_code": "COT-2026-0026",
      "supplier_code": "FORN-001",
      "position": 2,
      "round_number": 1,
      "proposal_status": "invited"
    }
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
  {
    id: "approvals-list",
    group: "Aprovações",
    method: "GET",
    path: "/approvals",
    title: "Listar aprovações",
    description:
      "Fila de approval_requests. Default status=pending. Use status=all para todos.",
    scope: "approvals:read",
    queryParams: [
      { name: "page", type: "integer", description: "Página (1-based)", example: 1 },
      { name: "page_size", type: "integer", description: "Tamanho da página (máx. 100)", example: 50 },
      { name: "status", type: "string", description: "pending | approved | rejected | all (default pending)" },
      { name: "flow", type: "string", description: "requisition | order" },
      { name: "created_since", type: "string (ISO 8601)", description: "Criados desde a data" },
    ],
    responseExample: `{
  "data": {
    "approvals": [{
      "id": "…",
      "flow": "requisition",
      "status": "pending",
      "entity_code": "REQ-2026-0001",
      "entity_external_code": "ERP-99"
    }],
    "page": 1, "page_size": 50, "total": 3, "total_pages": 1
  }
}`,
  },
  {
    id: "approvals-get",
    group: "Aprovações",
    method: "GET",
    path: "/approvals/{id}",
    title: "Detalhe da aprovação",
    description: "id = UUID da approval_request.",
    scope: "approvals:read",
    pathParams: [
      { name: "id", type: "string", required: true, description: "UUID da approval_request" },
    ],
  },
  {
    id: "approvals-approve",
    group: "Aprovações",
    method: "POST",
    path: "/approvals/{id}/approve",
    title: "Aprovar",
    description:
      "Aprova a solicitação. Se todos os níveis não rejeitados estiverem aprovados, a requisição vai para approved. Fluxo order ainda não suportado na escrita.",
    scope: "approvals:write",
    pathParams: [
      { name: "id", type: "string", required: true, description: "UUID da approval_request" },
    ],
    bodyFields: [
      {
        name: "decided_by_name",
        type: "string",
        description: "Nome opcional gravado em approver_name da REQ quando concluir",
      },
    ],
    requestExample: `{ "decided_by_name": "ERP Integrador" }`,
    responseExample: `{ "data": { "approval": { "status": "approved" }, "entity_fully_approved": true } }`,
  },
  {
    id: "approvals-reject",
    group: "Aprovações",
    method: "POST",
    path: "/approvals/{id}/reject",
    title: "Reprovar",
    description: "Reprova imediatamente a requisição. reason obrigatório.",
    scope: "approvals:write",
    pathParams: [
      { name: "id", type: "string", required: true, description: "UUID da approval_request" },
    ],
    bodyFields: [
      { name: "reason", type: "string", required: true, description: "Motivo da reprovação" },
      { name: "decided_by_name", type: "string", description: "Nome opcional" },
    ],
    requestExample: `{ "reason": "Fora do orçamento", "decided_by_name": "ERP Integrador" }`,
    responseExample: `{ "data": { "approval": { "status": "rejected" } } }`,
  },
  {
    id: "reports-saving",
    group: "Relatórios",
    method: "GET",
    path: "/reports/saving",
    title: "Relatório de Saving",
    description:
      "Saving = (target_price − unit_price) × quantity em itens de pedido com vínculo a cotação. Positivo = economia. Status default: sent|processing|completed. Período default: 30d.",
    scope: "reports:read",
    tenantFeature: "reports",
    queryParams: [
      { name: "period", type: "string", description: "30d | 60d | 90d | current_month (default 30d)" },
      { name: "from", type: "string (ISO 8601)", description: "Início (usar com to)" },
      { name: "to", type: "string (ISO 8601)", description: "Fim (usar com from)" },
      { name: "category", type: "string", description: "Filtro por quotations.category" },
      { name: "supplier_code", type: "string", description: "Filtro por código do fornecedor" },
    ],
    responseExample: `{
  "data": {
    "from": "…", "to": "…", "period": "30d",
    "sign_convention": "positive_means_economy",
    "summary": { "saving_total": 12500.5, "line_count": 42, "order_count": 18 },
    "by_month": [{ "month": "2026-08", "saving": 12500.5 }],
    "by_category": [{ "category": "TI", "saving": 8000 }]
  }
}`,
  },
  {
    id: "reports-spend",
    group: "Relatórios",
    method: "GET",
    path: "/reports/spend",
    title: "Relatório de Spend",
    description:
      "Soma de purchase_order_items.total_price. Status default: sent|processing|completed. Com include_previous=true compara janela anterior de mesmo comprimento.",
    scope: "reports:read",
    tenantFeature: "reports",
    queryParams: [
      { name: "period", type: "string", description: "30d | 60d | 90d | current_month (default 30d)" },
      { name: "from", type: "string (ISO 8601)", description: "Início (usar com to)" },
      { name: "to", type: "string (ISO 8601)", description: "Fim (usar com from)" },
      { name: "category", type: "string", description: "Filtro por quotations.category" },
      { name: "supplier_code", type: "string", description: "Filtro por código do fornecedor" },
      { name: "include_previous", type: "boolean", description: "true|1 — inclui spend anterior e variation_pct" },
    ],
    responseExample: `{
  "data": {
    "summary": { "spend_total": 250000, "previous_spend_total": 230000, "variation_pct": 0.087 },
    "by_category": [{ "category": "TI", "spend": 100000, "pct_of_total": 0.4 }],
    "by_supplier": [{ "supplier_name": "Fornecedor A", "orders": 12, "spend": 80000 }]
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
