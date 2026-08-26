/** Catálogo canônico de permission keys (rules) do portal comprador. */

export type PermissionCatalogItem = {
  key: string
  label: string
  group: string
}

export const PERMISSION_CATALOG: PermissionCatalogItem[] = [
  { key: "nav.dashboard", label: "Dashboard", group: "Navegação" },
  { key: "nav.requisitions", label: "Requisições", group: "Navegação" },
  { key: "nav.quotations", label: "Cotações", group: "Navegação" },
  { key: "nav.orders", label: "Pedidos", group: "Navegação" },
  { key: "nav.contracts", label: "Contratos", group: "Navegação" },
  { key: "nav.items", label: "Itens", group: "Navegação" },
  { key: "nav.suppliers", label: "Fornecedores", group: "Navegação" },
  { key: "nav.reports", label: "Relatórios", group: "Navegação" },
  { key: "nav.catalog", label: "Catálogo de Compras", group: "Navegação" },
  { key: "dashboard.metrics", label: "Cards de métricas", group: "Dashboard" },
  {
    key: "dashboard.spend_category",
    label: "Gráfico Spend por Categoria",
    group: "Dashboard",
  },
  {
    key: "dashboard.quotation_status",
    label: "Gráfico Status das Cotações",
    group: "Dashboard",
  },
  {
    key: "dashboard.recent_activity",
    label: "Atividades Recentes",
    group: "Dashboard",
  },
  {
    key: "dashboard.lead_time",
    label: "Gráfico Lead Time Médio",
    group: "Dashboard",
  },
  {
    key: "dashboard.roi",
    label: "Painel de ROI (métricas e gráficos)",
    group: "Dashboard",
  },
  { key: "reports.saving", label: "Seção Saving", group: "Relatórios" },
  { key: "reports.spend", label: "Seção Spend", group: "Relatórios" },
  { key: "reports.orders", label: "Seção Pedidos", group: "Relatórios" },
  {
    key: "reports.quotations",
    label: "Seção Cotações & Fornecedores",
    group: "Relatórios",
  },
  {
    key: "reports.export.spend_category",
    label: "Exportar Spend por Categoria",
    group: "Relatórios",
  },
  {
    key: "reports.export.supplier_performance",
    label: "Exportar Performance de Fornecedores",
    group: "Relatórios",
  },
  {
    key: "reports.export.saving",
    label: "Exportar Saving Acumulado",
    group: "Relatórios",
  },
  {
    key: "reports.export.process_time",
    label: "Exportar Tempo do Processo",
    group: "Relatórios",
  },
  { key: "quotation.create", label: "Criar / Clonar Cotação", group: "Cotações" },
  { key: "quotation.edit", label: "Editar Cotação", group: "Cotações" },
  { key: "quotation.cancel", label: "Cancelar Cotação", group: "Cotações" },
  { key: "quotation.equalize.view", label: "Visualizar Equalização", group: "Cotações" },
  { key: "quotation.equalize.select", label: "Ações na Equalização", group: "Cotações" },
  {
    key: "quotation.view_all",
    label: "Ver Cotações de Todos (senão, só as próprias)",
    group: "Cotações",
  },
  {
    key: "quotation.delegate",
    label: "Delegar Cotação (de outros responsáveis)",
    group: "Cotações",
  },
  { key: "order.create", label: "Criar Pedido", group: "Pedidos" },
  { key: "order.edit", label: "Editar Qualquer Pedido", group: "Pedidos" },
  { key: "order.edit_own", label: "Editar Próprios Pedidos", group: "Pedidos" },
  { key: "order.view_all", label: "Ver Pedidos de Todos", group: "Pedidos" },
  {
    key: "order.delegate",
    label: "Delegar Pedido (de outros responsáveis)",
    group: "Pedidos",
  },
  { key: "contract.view", label: "Visualizar Contratos", group: "Contratos" },
  { key: "contract.create", label: "Criar Contratos", group: "Contratos" },
  { key: "contract.edit", label: "Editar Contratos", group: "Contratos" },
  {
    key: "requisition.create.buyer",
    label: "Criar Requisição (Comprador)",
    group: "Requisições",
  },
  {
    key: "requisition.create.requester",
    label: "Criar Requisição (Solicitante)",
    group: "Requisições",
  },
  { key: "requisition.approve", label: "Aprovar Requisições", group: "Requisições" },
  { key: "requisition.view_all", label: "Ver Requisições de Todos", group: "Requisições" },
  {
    key: "catalog.order",
    label: "Comprar no Catálogo (carrinho e checkout)",
    group: "Catálogo",
  },
  { key: "approval.requisition", label: "Fluxo Aprovação Requisição", group: "Aprovações" },
  { key: "approval.order", label: "Fluxo Aprovação Pedido", group: "Aprovações" },
  { key: "export.excel", label: "Exportar Excel", group: "Dados" },
  { key: "import.excel", label: "Importar Excel", group: "Dados" },
  {
    key: "erp.sync",
    label: "Sincronizar ERP (itens e fornecedores)",
    group: "Dados",
  },
  { key: "supplier.create", label: "Cadastrar Fornecedor", group: "Cadastros" },
  { key: "supplier.edit", label: "Editar Fornecedor", group: "Cadastros" },
  { key: "item.create", label: "Cadastrar Item", group: "Cadastros" },
  { key: "item.edit", label: "Editar Item", group: "Cadastros" },
  { key: "user.manage", label: "Gerenciar Usuários", group: "Administração" },
  {
    key: "user.impersonate",
    label: "Agir como outro usuário",
    group: "Administração",
  },
  {
    key: "settings.manage",
    label: "Gerenciar Configurações da Empresa",
    group: "Administração",
  },
  {
    key: "portal.solicitante",
    label: "Acessar Portal Solicitante",
    group: "Administração",
  },
  { key: "view_only", label: "Somente Visualização", group: "Geral" },
]

/** Papéis legados → grupos de sistema (seed/migração). */
export const LEGACY_ROLE_GROUPS: {
  code: string
  name: string
  description: string
}[] = [
  {
    code: "admin",
    name: "Administrador",
    description: "Grupo de sistema migrado do perfil Administrador",
  },
  {
    code: "buyer",
    name: "Comprador",
    description: "Grupo de sistema migrado do perfil Comprador",
  },
  {
    code: "manager",
    name: "Gestor de Compras",
    description: "Grupo de sistema migrado do perfil Gestor de Compras",
  },
  {
    code: "approver_requisition",
    name: "Aprov. Requisição",
    description: "Grupo de sistema migrado do perfil Aprovador de Requisição",
  },
  {
    code: "approver_order",
    name: "Aprov. Pedido",
    description: "Grupo de sistema migrado do perfil Aprovador de Pedido",
  },
  {
    code: "requester",
    name: "Requisitante",
    description: "Grupo de sistema migrado do perfil Requisitante",
  },
]

/** Ordem de exibição no editor de grupos / rules do usuário. */
const PERMISSION_GROUP_ORDER = [
  "Navegação",
  "Dashboard",
  "Relatórios",
  "Catálogo",
  "Cotações",
  "Pedidos",
  "Contratos",
  "Requisições",
  "Aprovações",
  "Dados",
  "Cadastros",
  "Administração",
  "Geral",
] as const

export function groupPermissionsByCategory(
  items: PermissionCatalogItem[] = PERMISSION_CATALOG,
): Map<string, PermissionCatalogItem[]> {
  const map = new Map<string, PermissionCatalogItem[]>()
  for (const item of items) {
    const list = map.get(item.group) ?? []
    list.push(item)
    map.set(item.group, list)
  }

  const ordered = new Map<string, PermissionCatalogItem[]>()
  for (const group of PERMISSION_GROUP_ORDER) {
    const list = map.get(group)
    if (list?.length) ordered.set(group, list)
  }
  for (const [group, list] of map) {
    if (!ordered.has(group)) ordered.set(group, list)
  }
  return ordered
}

export function isKnownPermissionKey(key: string): boolean {
  return PERMISSION_CATALOG.some((p) => p.key === key)
}
